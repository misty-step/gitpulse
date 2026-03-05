import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  Experimental_Agent as Agent,
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
};

export async function runGitPulseAgent(input: RunGitPulseAgentInput): Promise<AgentAnswer> {
  const window = TimeWindowSchema.parse(input.window);
  const scope = normalizeScope(input.scope);
  const activitySource = input.activitySource ?? fetchActivityWindow;

  const baseData = await activitySource({
    window,
    scope,
    githubToken: input.githubToken,
  });

  const metrics = computeMetrics(baseData.events);
  const citations = buildCitations(baseData.events);
  const fallbackInsights = deterministicInsights(metrics);

  let answer = buildFallbackAnswer({
    question: input.question,
    scope,
    window,
    metrics,
    warnings: baseData.warnings,
  });

  const llmAnswer = await maybeGenerateLlmAnswer({
    question: input.question,
    scope,
    window,
    githubToken: input.githubToken,
    fallbackAnswer: answer,
    modelId: input.modelId,
    activitySource,
  });

  if (llmAnswer) {
    answer = llmAnswer;
  }

  const insights = extractInsights(answer, fallbackInsights);
  const blocks = buildBlocks(metrics, baseData.events, insights);

  return AgentAnswerSchema.parse({
    answer,
    citations,
    blocks,
    metrics,
    events: baseData.events,
  });
}

type MaybeGenerateAnswerInput = {
  question: string;
  scope: Scope;
  window: TimeWindow;
  githubToken?: string;
  fallbackAnswer: string;
  modelId?: string;
  activitySource: ActivitySource;
};

async function maybeGenerateLlmAnswer(input: MaybeGenerateAnswerInput): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
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

  for (const modelId of modelChain) {
    const agent = new Agent({
      model: openrouter.chat(modelId),
      stopWhen: stepCountIs(llmConfig.maxSteps),
      system: buildAgentSystemPrompt(llmConfig.promptVersion),
      tools: {
        get_activity_window: tool({
          description: "Fetch git activity for a time window, repos/orgs/contributors scope.",
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

    const startedAt = Date.now();
    try {
      const result = await agent.generate({
        prompt: buildAgentUserPrompt({
          question: input.question,
          scope: input.scope,
          window: input.window,
        }),
      });

      const trimmed = result.text.trim();
      recordLlmAttempt({
        enabled: llmConfig.telemetryEnabled,
        modelId,
        status: trimmed.length > 0 ? "success" : "empty",
        latencyMs: Date.now() - startedAt,
        usage: extractUsage(result),
      });

      if (trimmed.length > 0) {
        return trimmed;
      }
    } catch (error) {
      recordLlmAttempt({
        enabled: llmConfig.telemetryEnabled,
        modelId,
        status: "error",
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

function extractUsage(result: unknown): { promptTokens?: number; completionTokens?: number; totalTokens?: number } {
  const usage = (result as { usage?: Record<string, unknown> }).usage;
  if (!usage) {
    return {};
  }

  const promptTokens = toNumber(usage.inputTokens ?? usage.promptTokens);
  const completionTokens = toNumber(usage.outputTokens ?? usage.completionTokens);
  const totalTokens = toNumber(usage.totalTokens);

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

function buildFallbackAnswer(input: {
  question: string;
  scope: Scope;
  window: TimeWindow;
  metrics: ReturnType<typeof computeMetrics>;
  warnings: string[];
}): string {
  const topContributor = input.metrics.contributors[0];
  const topRepo = input.metrics.repos[0];

  const warnings =
    input.warnings.length > 0
      ? `\n\nWarnings:\n${input.warnings.map((warning) => `- ${warning}`).join("\n")}`
      : "";

  return [
    `Question: ${input.question}`,
    `Window: ${input.window.from} -> ${input.window.to}`,
    `Scope: repos=${input.scope.repos.length || "all"}, orgs=${input.scope.orgs.length || "none"}, contributors=${input.scope.contributors.length || "all"}`,
    "",
    `Observed ${input.metrics.totalEvents} total events: ${input.metrics.commitCount} commits, ${input.metrics.pullRequestOpenedCount} PRs opened, ${input.metrics.pullRequestMergedCount} PRs merged, ${input.metrics.reviewCount} reviews.`,
    topContributor
      ? `Highest-activity contributor: ${topContributor.login} (${topContributor.eventCount} events).`
      : "No contributor activity found in this window.",
    topRepo
      ? `Highest-activity repository: ${topRepo.repo} (${topRepo.totalEvents} events).`
      : "No repository activity found in this window.",
    warnings,
  ].join("\n");
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

function extractInsights(answer: string, fallbackInsights: string[]): string[] {
  const bulletInsights = answer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  if (bulletInsights.length > 0) {
    return bulletInsights.slice(0, 6);
  }

  return fallbackInsights;
}
