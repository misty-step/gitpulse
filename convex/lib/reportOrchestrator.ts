"use node";

import { createHash } from "crypto";
import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { buildReportContext } from "./reportContext";
import {
  generateDailyReportFromContext,
  generateWeeklyReportFromContext,
} from "./reportGenerator";
import { getPromptVersion } from "./prompts";
import {
  computeCoverageSummary,
  isEventCited,
  validateCoverage,
} from "./coverage";
import { emitMetric } from "./metrics";
import { normalizeUrl } from "./url";

const TOKENS_PER_EVENT_ESTIMATE = 50;

export function getTokensPerEventEstimate(): number {
  const override = Number(process.env.REPORT_TOKENS_PER_EVENT_ESTIMATE);
  if (!Number.isNaN(override) && Number.isFinite(override) && override > 0) {
    return override;
  }
  return TOKENS_PER_EVENT_ESTIMATE;
}
const TOKEN_WARNING_THRESHOLD = 400_000;
const TOKEN_HARD_LIMIT = 475_000;

interface GenerateReportParams {
  userId: string; // Clerk user ID used in reports table
  user: Doc<"users">;
  kind: "daily" | "weekly";
  startDate: number;
  endDate: number;
}

type GenerateReportStage =
  | "collecting"
  | "generating"
  | "validating"
  | "saving"
  | "completed";

interface GenerateReportOptions {
  forceRegenerate?: boolean;
  onStage?: (stage: GenerateReportStage, meta?: Record<string, unknown>) => Promise<void> | void;
}

export async function generateReportForUser(
  ctx: ActionCtx,
  params: GenerateReportParams,
  options: GenerateReportOptions = {}
): Promise<Id<"reports"> | null> {
  const { user, kind, startDate, endDate } = params;
  const { startDate: windowStart, endDate: windowEnd } = normalizeWindow(kind, startDate, endDate);
  const stageReporter = async (
    stage: GenerateReportStage,
    meta?: Record<string, unknown>
  ) => {
    if (options.onStage) {
      await options.onStage(stage, meta);
    }
  };

  if (!user.githubUsername) {
    console.warn(
      `[Reports] Cannot generate ${kind} report for user ${params.userId} - missing githubUsername`
    );
    return null;
  }

  const events = await ctx.runQuery(api.events.listByActor, {
    actorId: user._id,
    startDate: windowStart,
    endDate: windowEnd,
    limit: 2000,
  });

  const expectedEventCount = await ctx.runQuery(
    internal.events.countByActorInternal,
    {
      actorId: user._id,
      startDate,
      endDate,
    }
  );

  if (events.length !== expectedEventCount) {
    emitMetric("report.event_count_mismatch", {
      userId: params.userId,
      kind,
      expected: expectedEventCount,
      seen: events.length,
      startDate,
      endDate,
    });

    throw new Error(
      `[Reports] Event count mismatch for ${user.githubUsername}: expected ${expectedEventCount}, saw ${events.length}`
    );
  }

  const cacheKey = buildCacheKey(kind, params.userId, windowStart, windowEnd, events);
  const cachedReport = await ctx.runQuery(internal.reports.getByCacheKey, {
    cacheKey,
  });

  enforceTokenBudget(events.length, {
    userId: params.userId,
    kind,
    startDate: windowStart,
    endDate: windowEnd,
  });

  if (!options.forceRegenerate && cachedReport) {
    emitMetric("report.cache_hit", {
      userId: params.userId,
      kind,
      cacheKey,
      latencyMs: 0,
    });
    return cachedReport._id;
  }

  emitMetric("report.cache_miss", {
    userId: params.userId,
    kind,
    cacheKey,
  });

  const repoIds = Array.from(new Set(events.map((event) => event.repoId)));
  const repoDocs = await Promise.all(
    repoIds.map((id) => ctx.runQuery(api.repos.getById, { id }))
  );
  const reposById = new Map<Id<"repos">, Doc<"repos"> | null>(
    repoIds.map((id, idx) => [id, repoDocs[idx] ?? null])
  );

  const { context, allowedUrls } = buildReportContext({
    events,
    reposById,
    startDate: windowStart,
    endDate: windowEnd,
  });

  await stageReporter("collecting", {
    eventCount: events.length,
    expectedEventCount,
  });

  const generator =
    kind === "daily"
      ? generateDailyReportFromContext
      : generateWeeklyReportFromContext;

  await stageReporter("generating", {
    cacheKey,
    repoCount: reposById.size,
  });

  const llmStart = Date.now();
  const generated = await generator(
    user.githubUsername,
    context,
    allowedUrls
  );
  const latencyMs = Date.now() - llmStart;

  await stageReporter("validating", {
    latencyMs,
  });

  try {
    validateCoverage(
      events,
      {
        markdown: generated.markdown,
        citations: generated.citations,
      },
      0.95
    );
  } catch (error) {
    emitMetric("report.coverage_failed", {
      userId: params.userId,
      kind,
    });
    throw error;
  }

  const citationSet = new Set(
    generated.citations.map(normalizeUrl).filter((value): value is string =>
      Boolean(value)
    )
  );

  const coverage = computeCoverageSummary(
    events.map((event) => ({
      scopeKey: resolveScopeKey(event, reposById.get(event.repoId) ?? null),
      used: isEventCited(event, citationSet),
    }))
  );

  const now = Date.now();

  const title =
    kind === "daily"
      ? `Daily Standup - ${new Date(windowEnd).toLocaleDateString()}`
      : `Weekly Retro - Week of ${new Date(windowStart).toLocaleDateString()}`;
  const description =
    kind === "daily"
      ? `Automated daily standup for ${user.githubUsername}`
      : `Automated weekly retrospective for ${user.githubUsername}`;

  await stageReporter("saving");

  const reportId = await ctx.runMutation(internal.reports.create, {
    userId: params.userId,
    title,
    description,
    startDate: windowStart,
    endDate: windowEnd,
    ghLogins: [user.githubUsername],
    markdown: generated.markdown,
    html: generated.html,
    citations: generated.citations,
    promptVersion: getPromptVersion(),
    provider: generated.provider,
    model: generated.model,
    generatedAt: now,
    isAutoGenerated: true,
    scheduleType: kind,
    cacheKey,
    coverageScore: coverage.coverageScore,
    coverageBreakdown: coverage.breakdown,
  });

  emitMetric("report_latency_ms", {
    userId: params.userId,
    kind,
    latencyMs,
    eventsConsidered: events.length,
  });

  emitMetric("llm_cost_usd", {
    userId: params.userId,
    kind,
    provider: generated.provider,
    model: generated.model,
    costUsd: estimateCost(generated.provider, generated.model, events.length),
  });

  await stageReporter("completed", {
    reportId,
  });

  return reportId;
}

export function buildCacheKey(
  kind: string,
  userId: string,
  startDate: number,
  endDate: number,
  events: Doc<"events">[]
): string {
  const contentHashes = events
    .map((event) => event.contentHash ?? String(event._id))
    .sort()
    .join(",");

  return createHash("sha256")
    .update([kind, userId, startDate, endDate, contentHashes].join("|"))
    .digest("hex");
}

/**
 * Normalize time windows so that cache keys are stable for a given calendar bucket.
 * Daily -> UTC midnight bucket; Weekly -> 7-day window aligned to UTC midnight ending at endDate.
 */
export function normalizeWindow(
  kind: "daily" | "weekly",
  startDate: number,
  endDate: number
): { startDate: number; endDate: number } {
  const DAY = 24 * 60 * 60 * 1000;

  if (kind === "daily") {
    const dayStart = Math.floor(endDate / DAY) * DAY;
    return { startDate: dayStart, endDate: dayStart + DAY };
  }

  // weekly: align end to next day boundary, start 7 days before
  const endAligned = Math.floor(endDate / DAY) * DAY + DAY;
  return { startDate: endAligned - 7 * DAY, endDate: endAligned };
}

export function resolveScopeKey(
  event: Doc<"events">,
  repo: Doc<"repos"> | null
): string {
  if (repo?.fullName) {
    return `repo:${repo.fullName}`;
  }
  return `repoId:${event.repoId}`;
}

export function estimateCost(provider: string, model: string, eventCount: number): number {
  // Rough placeholder: cost scales with event count to keep visibility in logs
  const base = provider === "google" ? 0.0005 : 0.0008;
  return Number((base * Math.max(eventCount, 1)).toFixed(6));
}

function enforceTokenBudget(
  eventCount: number,
  meta: { userId: string; kind: string; startDate: number; endDate: number }
): void {
  const estimatedTokens = eventCount * getTokensPerEventEstimate();

  if (estimatedTokens > TOKEN_HARD_LIMIT) {
    emitMetric("report.token_budget_exceeded", {
      ...meta,
      estimatedTokens,
      eventCount,
    });

    throw new Error(
      `[Reports] Estimated token usage ${estimatedTokens.toLocaleString()} exceeds safety limit (${TOKEN_HARD_LIMIT.toLocaleString()} tokens). ` +
        "Please narrow the date range or scope before regenerating."
    );
  }

  if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
    emitMetric("report.token_budget_warning", {
      ...meta,
      estimatedTokens,
      eventCount,
    });

    console.warn(
      `[Reports] Estimated token usage ${estimatedTokens.toLocaleString()} tokens for ${meta.kind} report ` +
        `is nearing the safety limit (${TOKEN_HARD_LIMIT.toLocaleString()} tokens). Consider narrowing the window.`
    );
  }
}

export { normalizeUrl };
