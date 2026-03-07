import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  // Pinned in package.json because this agent relies on the current runtime
  // forwarding behavior from Agent.generate() to generateText().
  Experimental_Agent as Agent,
  type GenerateTextResult,
  type ToolSet,
  stepCountIs,
  tool,
} from "ai";
import {
  AgentAnswerSchema,
  ScopeSchema,
  TimeWindowSchema,
  type AgentAnswer,
  type Scope,
  type TimeWindow,
  normalizeScope,
} from "@gitpulse/schemas";
import { z } from "zod";

import {
  fetchActivityWindow,
  type ActivityWindowData,
  type FetchActivityInput,
} from "./github/activity";
import { buildModelChain, readLlmRuntimeConfig } from "./llm/config";
import { buildAgentSystemPrompt, buildAgentUserPrompt } from "./llm/prompt";
import { recordLlmAttempt } from "./llm/telemetry";
import { buildBlocks, buildCitations, computeMetrics } from "./metrics";

const MAX_EXPORTED_EVENTS = 100;

export type ActivitySource = (
  input: FetchActivityInput
) => Promise<ActivityWindowData>;

export type RunGitPulseAgentInput = {
  question: string;
  window: TimeWindow;
  scope?: Partial<Scope>;
  githubToken?: string;
  modelId?: string;
  activitySource?: ActivitySource;
  narrativeGenerator?: NarrativeGenerator;
};

export type LlmNarrativeResult = {
  text: string | null;
  warnings: string[];
};

export type NarrativeGenerator = (
  input: MaybeGenerateAnswerInput
) => Promise<LlmNarrativeResult>;

export async function runGitPulseAgent(input: RunGitPulseAgentInput): Promise<AgentAnswer> {
  const window = TimeWindowSchema.parse(input.window);
  const scope = normalizeScope(input.scope);
  // Production defaults to the live GitHub collector unless tests inject a stub source.
  const activitySource = input.activitySource ?? fetchActivityWindow;

  const baseData = await activitySource({
    window,
    scope,
    githubToken: input.githubToken,
  });

  const metrics = computeMetrics(baseData.events);
  const citations = buildCitations(baseData.events);

  const llmResult = await (input.narrativeGenerator ?? maybeGenerateLlmAnswer)({
    question: input.question,
    scope,
    window,
    githubToken: input.githubToken,
    modelId: input.modelId,
    activitySource,
  });

  const answer =
    llmResult.text ??
    buildFallbackAnswer({
      question: input.question,
      scope,
      window,
      metrics,
      warnings: [...baseData.warnings, ...llmResult.warnings],
    });

  const fallbackInsights = llmResult.text === null ? deterministicInsights(metrics) : [];
  const blocks = buildBlocks(metrics, baseData.events, fallbackInsights);

  return AgentAnswerSchema.parse({
    answer,
    citations,
    blocks,
    metrics,
    events: baseData.events.slice(0, MAX_EXPORTED_EVENTS),
  });
}

export type MaybeGenerateAnswerInput = {
  question: string;
  scope: Scope;
  window: TimeWindow;
  githubToken?: string;
  modelId?: string;
  activitySource: ActivitySource;
};

async function maybeGenerateLlmAnswer(input: MaybeGenerateAnswerInput): Promise<LlmNarrativeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { text: null, warnings: [] };
  }

  const llmConfig = readLlmRuntimeConfig();
  const modelChain = buildModelChain({
    config: llmConfig,
    overrideModel: input.modelId,
  });
  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": llmConfig.referer,
      "X-Title": llmConfig.appName,
    },
  });
  const startedAt = Date.now();
  let sawEmptyResponse = false;
  let sawError = false;

  for (const [index, modelId] of modelChain.entries()) {
    const remainingBudgetMs = llmConfig.maxTotalMs - (Date.now() - startedAt);
    if (remainingBudgetMs <= 0) {
      return {
        text: null,
        warnings: ["LLM narrative budget exhausted; using deterministic fallback."],
      };
    }

    const agent = new Agent({
      model: openrouter.chat(modelId),
      stopWhen: stepCountIs(llmConfig.maxSteps),
      system: buildAgentSystemPrompt(llmConfig.promptVersion),
      tools: {
        get_activity_window: tool({
          description:
            "Fetch git activity for a time window, repos/orgs/contributors scope. Returns top 60 most recent events sorted descending by timestamp plus deterministic metrics.",
          inputSchema: z.object({
            window: TimeWindowSchema.optional(),
            scope: ScopeSchema.optional(),
          }),
          execute: async (args) => {
            const data = await input.activitySource({
              githubToken: input.githubToken,
              window: args.window ?? input.window,
              scope: normalizeScope(args.scope ?? input.scope),
            });

            const metrics = computeMetrics(data.events);
            return {
              window: data.window,
              repos: data.repos,
              metrics,
              events: data.events.slice(0, 60),
              warnings: data.warnings,
            };
          },
        }),
        compare_windows: tool({
          description: "Compare two windows and return deltas for key metrics.",
          inputSchema: z.object({
            current: TimeWindowSchema,
            previous: TimeWindowSchema,
            scope: ScopeSchema.optional(),
          }),
          execute: async (args) => {
            const normalizedScope = normalizeScope(args.scope ?? input.scope);
            const [currentData, previousData] = await Promise.all([
              input.activitySource({
                githubToken: input.githubToken,
                window: args.current,
                scope: normalizedScope,
              }),
              input.activitySource({
                githubToken: input.githubToken,
                window: args.previous,
                scope: normalizedScope,
              }),
            ]);

            const current = computeMetrics(currentData.events);
            const previous = computeMetrics(previousData.events);

            return {
              current,
              previous,
              delta: {
                totalEvents: current.totalEvents - previous.totalEvents,
                commits: current.commitCount - previous.commitCount,
                openedPrs: current.pullRequestOpenedCount - previous.pullRequestOpenedCount,
                mergedPrs: current.pullRequestMergedCount - previous.pullRequestMergedCount,
                reviews: current.reviewCount - previous.reviewCount,
              },
            };
          },
        }),
      },
    });

    const attemptStartedAt = Date.now();
    const attemptController = new AbortController();
    const timeoutId = setTimeout(() => attemptController.abort(), remainingBudgetMs);

    try {
      // ai@5.0.144 forwards generate() options to generateText() at runtime,
      // including abortSignal, even though the public Agent.generate typing omits it.
      const generateInput: Parameters<typeof agent.generate>[0] & {
        abortSignal: AbortSignal;
      } = {
        prompt: buildAgentUserPrompt({
          question: input.question,
          scope: input.scope,
          window: input.window,
        }),
        abortSignal: attemptController.signal,
      };
      const result = await agent.generate(generateInput as Parameters<typeof agent.generate>[0]);

      const trimmed = result.text.trim();
      recordLlmAttempt({
        enabled: llmConfig.telemetryEnabled,
        modelId,
        status: trimmed.length > 0 ? "success" : "empty",
        latencyMs: Date.now() - attemptStartedAt,
        usage: extractUsage(result),
      });

      if (trimmed.length > 0) {
        return { text: trimmed, warnings: [] };
      }

      sawEmptyResponse = true;
    } catch (error) {
      sawError = true;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error("[gitpulse.llm] attempt failed", {
        modelId,
        error: errorMessage,
      });

      recordLlmAttempt({
        enabled: llmConfig.telemetryEnabled,
        modelId,
        status: "error",
        latencyMs: Date.now() - attemptStartedAt,
        error: errorMessage,
      });

      if (attemptController.signal.aborted) {
        return {
          text: null,
          warnings: ["LLM narrative budget exhausted; using deterministic fallback."],
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (index < modelChain.length - 1) {
      const retryDelayMs = nextRetryDelayMs({
        startedAt,
        maxTotalMs: llmConfig.maxTotalMs,
        retryDelayMs: llmConfig.retryDelayMs,
      });

      if (retryDelayMs === null) {
        return {
          text: null,
          warnings: ["LLM narrative budget exhausted; using deterministic fallback."],
        };
      }

      await sleep(retryDelayMs);
    }
  }

  if (sawError) {
    return {
      text: null,
      warnings: [
        ...(sawEmptyResponse ? ["LLM returned empty narrative output for one or more models."] : []),
        "LLM narrative unavailable after fallback attempts; using deterministic fallback.",
      ],
    };
  }

  if (sawEmptyResponse) {
    return {
      text: null,
      warnings: ["LLM returned empty narrative output; using deterministic fallback."],
    };
  }

  return { text: null, warnings: [] };
}

function extractUsage<TOOLS extends ToolSet, OUTPUT>(
  result: GenerateTextResult<TOOLS, OUTPUT>
): { promptTokens?: number; completionTokens?: number; totalTokens?: number } {
  const promptTokens = toNumber(result.usage.inputTokens);
  const completionTokens = toNumber(result.usage.outputTokens);
  const totalTokens = toNumber(result.usage.totalTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return value;
}

export function backoffWithJitter(
  delayMs: number,
  randomSource: () => number = Math.random
): number {
  if (delayMs === 0) {
    return 0;
  }

  const jitter = Math.floor(randomSource() * Math.max(100, Math.floor(delayMs / 3)));
  return delayMs + jitter;
}

function nextRetryDelayMs(input: {
  startedAt: number;
  maxTotalMs: number;
  retryDelayMs: number;
}): number | null {
  const remainingMs = input.maxTotalMs - (Date.now() - input.startedAt);
  if (remainingMs <= 0) {
    return null;
  }

  return Math.min(backoffWithJitter(input.retryDelayMs), remainingMs);
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildFallbackAnswer(input: {
  question: string;
  scope: Scope;
  window: TimeWindow;
  metrics: ReturnType<typeof computeMetrics>;
  warnings: string[];
}): string {
  const topContributor = input.metrics.contributors[0];
  const topRepo = input.metrics.repos[0];

  const warningLines =
    input.warnings.length > 0
      ? ["", "Warnings:", ...input.warnings.map((warning) => `- ${warning}`)]
      : [];

  return [
    `Question: ${input.question}`,
    `Window: ${input.window.from} -> ${input.window.to}`,
    `Scope: repos=${formatScopeValues(input.scope.repos, "none")}, orgs=${formatScopeValues(input.scope.orgs, "none")}, contributors=${formatScopeValues(input.scope.contributors, "all")}`,
    "",
    `Observed ${input.metrics.totalEvents} total events: ${input.metrics.commitCount} commits, ${input.metrics.pullRequestOpenedCount} PRs opened, ${input.metrics.pullRequestMergedCount} PRs merged, ${input.metrics.reviewCount} reviews.`,
    topContributor
      ? `Highest-activity contributor: ${topContributor.login} (${topContributor.eventCount} events).`
      : "No contributor activity found in this window.",
    topRepo
      ? `Highest-activity repository: ${topRepo.repo} (${topRepo.totalEvents} events).`
      : "No repository activity found in this window.",
    ...warningLines,
  ].join("\n");
}

function formatScopeValues(values: string[], emptyLabel: string): string {
  return values.length === 0 ? emptyLabel : values.join(", ");
}

function deterministicInsights(metrics: ReturnType<typeof computeMetrics>): string[] {
  const insights: string[] = [];

  if (metrics.totalEvents === 0) {
    insights.push("No tracked activity in this scope and time window.");
    return insights;
  }

  if (metrics.pullRequestOpenedCount > metrics.pullRequestMergedCount) {
    insights.push(
      `PR intake exceeds merges by ${metrics.pullRequestOpenedCount - metrics.pullRequestMergedCount}; backlog may be growing.`,
    );
  }

  if (metrics.reviewCount < metrics.pullRequestOpenedCount) {
    insights.push("Review activity is below PR creation rate; review throughput may be a bottleneck.");
  }

  const topRepo = metrics.repos[0];
  if (topRepo) {
    insights.push(`${topRepo.repo} is carrying the most activity (${topRepo.totalEvents} events).`);
  }

  const topContributor = metrics.contributors[0];
  if (topContributor) {
    insights.push(`${topContributor.login} leads activity with ${topContributor.eventCount} events.`);
  }

  return insights.slice(0, 5);
}
