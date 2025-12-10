"use node";

/**
 * Sync Worker — Single-Repo Job Processor
 *
 * This worker processes ONE repository per job. No chaining, no multi-repo logic.
 *
 * Design (Ousterhout):
 * - Simple interface: processSyncJob({ jobId }) — that's it
 * - Hides: pagination, rate-limit handling, progress tracking
 * - Guarantees: idempotent retries, one repo per job
 *
 * Architecture: Job-per-repo
 * - Each job processes exactly ONE repo
 * - Batch tracks overall progress across all repos
 * - On completion: notifies batch via syncBatches.jobCompleted
 * - On failure: notifies batch via syncBatches.jobFailed
 */

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";
import {
  mintInstallationToken,
} from "../../lib/githubApp";
import {
  canonicalizeEvent,
  convertGitHubCommitToCommitLike,
} from "../../lib/canonicalizeEvent";
import { persistCanonicalEvent } from "../../lib/canonicalFactService";
import { getRepository, listCommits, RateLimitError } from "../../lib/github";
import { emitMetric } from "../../lib/metrics";
import { logger } from "../../lib/logger.js";

// Forward declaration for self-scheduling (rate-limit resume)
import { makeFunctionReference } from "convex/server";
const selfReference = makeFunctionReference<
  "action",
  { jobId: Id<"ingestionJobs"> }
>("actions/sync/processSyncJob:processSyncJob");

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BLOCKED_DELAY_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

interface JobResult {
  status: "completed" | "blocked" | "failed";
  eventsIngested: number;
  durationMs?: number;
  blockedUntil?: number;
  error?: string;
}

// ============================================================================
// Main Worker Action
// ============================================================================

/**
 * Process a sync job for ONE repository.
 *
 * Idempotency: Safe to call multiple times on the same job.
 * Completed/failed jobs are skipped. Blocked jobs resume from cursor.
 */
export const processSyncJob = internalAction({
  args: {
    jobId: v.id("ingestionJobs"),
  },
  handler: async (ctx, args): Promise<JobResult> => {
    const { jobId } = args;
    const startTime = Date.now();

    // 1. Load job state
    const job = await ctx.runQuery(internal.ingestionJobs.getById, { jobId });

    if (!job) {
      logger.error({ jobId }, "Job not found");
      return { status: "failed", eventsIngested: 0, error: "Job not found" };
    }

    // 2. Skip if already terminal
    if (job.status === "completed" || job.status === "failed") {
      logger.info({ jobId, status: job.status }, "Job already finished");
      return {
        status: job.status as "completed" | "failed",
        eventsIngested: job.eventsIngested ?? 0,
      };
    }

    // 3. Load installation
    if (!job.installationId) {
      return failJob(ctx, job, "Job missing installationId");
    }

    const installation = await ctx.runQuery(
      api.installations.getByInstallationId,
      { installationId: job.installationId }
    );

    if (!installation) {
      return failJob(ctx, job, "Installation not found");
    }

    // 4. Mark job as running
    await ctx.runMutation(internal.ingestionJobs.resume, {
      jobId,
    });

    emitMetric("sync.job.started", {
      jobId,
      installationId: job.installationId,
      repoFullName: job.repoFullName,
    });

    // 5. Process this repo
    try {
      const result = await processRepo(ctx, job, installation);

      if (result.status === "blocked") {
        emitMetric("sync.job.blocked", {
          jobId,
          blockedUntil: result.blockedUntil,
          reason: "rate_limit",
        });
        return result;
      }

      if (result.status === "completed") {
        const durationMs = Date.now() - startTime;

        // Note: We no longer call syncBatches.jobCompleted here.
        // Batch status is computed lazily from job statuses to avoid OCC conflicts.
        // Finalization happens when getStatus detects all jobs are done.

        emitMetric("sync.job.completed", {
          jobId,
          repoFullName: job.repoFullName,
          eventsIngested: result.eventsIngested,
          durationMs,
        });

        return { ...result, durationMs };
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return failJob(ctx, job, errorMessage);
    }
  },
});

// ============================================================================
// Core Processing Logic
// ============================================================================

/**
 * Process a single repository's timeline events.
 */
async function processRepo(
  ctx: ActionCtx,
  job: Doc<"ingestionJobs">,
  installation: Doc<"installations">
): Promise<JobResult> {
  const { _id: jobId, repoFullName, installationId, since, until } = job;

  if (!installationId) {
    throw new Error("Missing installationId");
  }

  const sinceISO = since
    ? new Date(since).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Mint token
  const { token } = await mintInstallationToken(installationId);

  // Fetch repo metadata
  let repoDetails: Awaited<ReturnType<typeof getRepository>> | null = null;
  try {
    repoDetails = await getRepository(token, repoFullName);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return handleRateLimit(ctx, jobId, error.reset, job.eventsIngested ?? 0);
    }
    throw error;
  }

  // Track events ingested
  let eventsIngested = job.eventsIngested ?? 0;

  const sinceTs = since ?? Date.now() - 30 * 24 * 60 * 60 * 1000;
  const untilTs = until ?? Date.now();

  // Debug logging for time window analysis
  const windowDays = (untilTs - sinceTs) / (24 * 60 * 60 * 1000);
  logger.info(
    {
      jobId,
      repoFullName,
      sinceTs: new Date(sinceTs).toISOString(),
      untilTs: new Date(untilTs).toISOString(),
      windowDays: Math.round(windowDays * 10) / 10,
      sinceFromJob: since !== undefined,
    },
    "Processing repo with time window"
  );

  // ========================================================================
  // Commits-Only Sync Strategy
  // ========================================================================
  // Using Commits API exclusively because:
  // - No 300-event pagination limit (unlike Events API)
  // - Server-side `since` filtering (faster, less data transfer)
  // - Simpler code, fewer API calls
  // - Sufficient for commit-centric reporting (no PR/review metadata needed)

  logger.info(
    { jobId, repoFullName, sinceISO },
    "Fetching commits via Commits API"
  );

  try {
    const commits = await listCommits(token, repoFullName, sinceISO);

    // Update progress at 50% after fetching commits
    await ctx.runMutation(internal.ingestionJobs.updateProgress, {
      jobId,
      progress: 50,
      eventsIngested,
    });

    const totalCommits = commits.length;
    for (let i = 0; i < totalCommits; i++) {
      const commit = commits[i];

      // Convert Commits API format to CommitLike
      const commitLike = convertGitHubCommitToCommitLike(commit);

      // Canonicalize commit
      const canonical = canonicalizeEvent({
        kind: "commit",
        payload: commitLike,
        repository: repoDetails!,
      });

      if (canonical) {
        const persistResult = await persistCanonicalEvent(ctx, canonical, {
          installationId,
          repoPayload: repoDetails!,
        });

        if (persistResult.status === "inserted") {
          eventsIngested++;
        }
      }

      // Update progress every 50 commits
      if ((i + 1) % 50 === 0 || i === totalCommits - 1) {
        const progress = 50 + Math.round(((i + 1) / totalCommits) * 50);
        await ctx.runMutation(internal.ingestionJobs.updateProgress, {
          jobId,
          progress: Math.min(progress, 99),
          eventsIngested,
        });
      }
    }

    logger.info(
      { jobId, repoFullName, commitsProcessed: commits.length, eventsIngested },
      "Commits API sync completed"
    );
  } catch (error) {
    // Commits API is our only data source now - fail the job on error
    if (error instanceof RateLimitError) {
      return handleRateLimit(ctx, jobId, error.reset, eventsIngested);
    }
    logger.error(
      { jobId, repoFullName, error: String(error) },
      "Commits API fetch failed"
    );
    throw error;
  }

  // Mark job completed
  await ctx.runMutation(internal.ingestionJobs.complete, {
    jobId,
    eventsIngested,
  });

  logger.info(
    { jobId, repoFullName, eventsIngested },
    "Repo sync completed"
  );

  return { status: "completed", eventsIngested };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle rate limit by blocking job and scheduling resume.
 */
async function handleRateLimit(
  ctx: ActionCtx,
  jobId: Id<"ingestionJobs">,
  blockedUntil: number,
  eventsIngested: number,
  cursor?: string
): Promise<JobResult> {
  await ctx.runMutation(internal.ingestionJobs.markBlocked, {
    jobId,
    blockedUntil,
    cursor,
    rateLimitRemaining: 0,
    rateLimitReset: blockedUntil,
  });

  await ctx.scheduler.runAt(blockedUntil, selfReference, { jobId });

  logger.info(
    { jobId, blockedUntil: new Date(blockedUntil).toISOString() },
    "Job blocked due to rate limit, scheduled resume"
  );

  return { status: "blocked", eventsIngested, blockedUntil };
}

/**
 * Mark job as failed.
 */
async function failJob(
  ctx: ActionCtx,
  job: Doc<"ingestionJobs">,
  errorMessage: string
): Promise<JobResult> {
  const { _id: jobId } = job;

  await ctx.runMutation(internal.ingestionJobs.fail, {
    jobId,
    errorMessage,
  });

  // Note: We no longer call syncBatches.jobFailed here.
  // Batch status is computed lazily from job statuses to avoid OCC conflicts.

  emitMetric("sync.job.failed", { jobId, error: errorMessage });
  logger.error({ jobId, error: errorMessage }, "Sync job failed");

  return { status: "failed", eventsIngested: 0, error: errorMessage };
}
