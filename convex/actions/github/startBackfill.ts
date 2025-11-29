"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import {
  fetchRepoTimeline,
  mintInstallationToken,
  shouldPause,
} from "../../lib/githubApp";
import { ErrorCode } from "../../lib/types";
import { canonicalizeEvent } from "../../lib/canonicalizeEvent";
import { persistCanonicalEvent } from "../../lib/canonicalFactService";
import { getRepository, RateLimitError } from "../../lib/github";
import { logger } from "../../lib/logger.js";

const MAX_REPOS_PER_INVOCATION = 10;
const DEFAULT_BLOCKED_DELAY_MS = 5 * 60 * 1000;

interface BackfillResult {
  status: "completed" | "blocked";
  eventsIngested: number;
  blockedUntil?: number;
}

interface BackfillInternalArgs {
  installationId: number;
  userId: string;
  repositories: string[];
  since: number;
  until?: number;
  existingJobId?: Id<"ingestionJobs">;
  initialEventsIngested?: number;
  initialProgress?: number;
  initialCursor?: string;
}

type BackfillReturn = {
  ok: boolean;
  jobs: Array<{
    repo: string;
    jobId: string;
    status: string;
    blockedUntil?: number;
    eventsIngested?: number;
  }>;
};

/**
 * Admin version of startBackfill - bypasses auth for CLI usage
 *
 * Use this when you need to run a backfill directly from the command line.
 */
export async function adminStartBackfillHandler(
  ctx: ActionCtx,
  args: {
    installationId: number;
    clerkUserId: string;
    repositories: string[];
    since: number;
    until?: number;
  },
): Promise<BackfillReturn> {
  // Admin version - no auth check, uses provided clerkUserId
  return runBackfillInternal(ctx, {
    installationId: args.installationId,
    userId: args.clerkUserId,
    repositories: args.repositories,
    since: args.since,
    until: args.until,
  });
}

export const adminStartBackfill = internalAction({
  args: {
    installationId: v.number(),
    clerkUserId: v.string(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: adminStartBackfillHandler,
});

export const startBackfill = internalAction({
  args: {
    installationId: v.number(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillReturn> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error(
        `[${ErrorCode.NOT_AUTHENTICATED}] GitHub backfill requires authentication`,
      );
    }

    const installation = await ctx.runQuery(
      api.installations.getByInstallationId,
      {
        installationId: args.installationId,
      },
    );

    if (!installation) {
      throw new Error(
        `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} not registered`,
      );
    }

    if (
      installation.clerkUserId &&
      installation.clerkUserId !== identity.subject
    ) {
      throw new Error(
        `[${ErrorCode.UNAUTHORIZED}] User ${identity.subject} cannot manage installation ${args.installationId}`,
      );
    }

    return runBackfillInternal(ctx, {
      installationId: args.installationId,
      userId: identity.subject,
      repositories:
        args.repositories.length > 0
          ? args.repositories
          : (installation.repositories ?? []),
      since: args.since,
      until: args.until,
    });
  },
});

/**
 * Continue a rate-limited backfill job
 *
 * This is called by the scheduler when a rate-limited job is ready to resume.
 * It doesn't require auth - uses the userId stored in the job.
 */
export const continueBackfill = internalAction({
  args: {
    jobId: v.id("ingestionJobs"),
  },
  handler: async (ctx, args): Promise<BackfillReturn> => {
    // Load job state from database
    const job = await ctx.runQuery(internal.ingestionJobs.getById, {
      jobId: args.jobId,
    });

    if (!job) {
      logger.error({ jobId: args.jobId }, "Job not found");
      return { ok: false, jobs: [] };
    }

    if (job.status === "completed" || job.status === "failed") {
      logger.info(
        { jobId: args.jobId, status: job.status },
        "Job already finished, skipping",
      );
      return { ok: true, jobs: [] };
    }

    if (!job.installationId) {
      logger.error({ jobId: args.jobId }, "Job missing installationId");
      await ctx.runMutation(internal.ingestionJobs.fail, {
        jobId: job._id,
        errorMessage: "Missing installationId; marking failed",
      });
      return { ok: false, jobs: [] };
    }

    // SERIAL CONTINUATION LOGIC:
    // If the job is "completed" but has remaining repos, we are chaining to the next repo.
    // If the job is "running" or "blocked", we are resuming the SAME repo.

    const initialEventsIngested = job.eventsIngested ?? 0;
    const initialProgress = job.progress ?? 0;
    const initialCursor = job.cursor ?? undefined;

    let repositories: string[] = [];

    if (
      job.status === "completed" &&
      job.reposRemaining &&
      job.reposRemaining.length > 0
    ) {
      // We are moving to the next repo in the chain
      repositories = job.reposRemaining;
      logger.info(
        {
          previousJobId: args.jobId,
          nextRepo: repositories[0],
        },
        "Chaining to next repo",
      );
    } else if (job.status !== "completed") {
      // We are resuming the current repo (from block/pause)
      repositories =
        job.reposRemaining && job.reposRemaining.length > 0
          ? [job.repoFullName, ...job.reposRemaining]
          : [job.repoFullName];

      logger.info(
        {
          jobId: args.jobId,
          repo: job.repoFullName,
        },
        "Resuming paused job",
      );
    } else {
      logger.info({ jobId: args.jobId }, "Job finished and no repos remaining");
      return { ok: true, jobs: [] };
    }

    const remainingRepos = repositories.slice(1);
    const reuseExistingJob = job.status === "blocked";

    return runBackfillInternal(ctx, {
      installationId: job.installationId,
      userId: job.userId,
      repositories,
      since: job.since ?? Date.now() - 30 * 24 * 60 * 60 * 1000, // Default: 30 days
      until: job.until,
      existingJobId: reuseExistingJob ? job._id : undefined,
      initialEventsIngested,
      initialProgress,
      initialCursor,
    });
  },
});

// Implementation of runBackfillInternal (declared above)
async function runBackfillInternal(
  ctx: ActionCtx,
  args: BackfillInternalArgs,
): Promise<BackfillReturn> {
  const installation = await ctx.runQuery(
    api.installations.getByInstallationId,
    {
      installationId: args.installationId,
    },
  );

  if (!installation) {
    throw new Error(
      `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} not registered`,
    );
  }

  const reposToProcess = args.repositories.slice(0, MAX_REPOS_PER_INVOCATION);

  if (reposToProcess.length === 0) {
    throw new Error(
      `[${ErrorCode.INVALID_INPUT}] No repositories available for installation ${args.installationId}`,
    );
  }

  const sinceISO = new Date(args.since).toISOString();
  const untilISO = args.until ? new Date(args.until).toISOString() : undefined;

  // PROCESS SERIALIZATION: Only start ONE job for the first repository.
  // The completion/continuation logic will handle the next repo in the list via 'reposRemaining'.
  // This prevents "Job Explosion" where resuming a job would fan-out into multiple parallel jobs.

  const repoFullName = reposToProcess[0];
  const remainingRepos = reposToProcess.slice(1);

  const baseEventsIngested = args.initialEventsIngested ?? 0;

  const latestInstallation = await ctx.runQuery(
    api.installations.getByInstallationId,
    {
      installationId: args.installationId,
    },
  );

  if (!latestInstallation) {
    throw new Error(
      `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} missing during backfill`,
    );
  }

  const initialCursor =
    args.initialCursor ?? latestInstallation.lastCursor ?? undefined;
  const initialEtag = latestInstallation.etag ?? undefined;

  let jobId: Id<"ingestionJobs">;

  if (args.existingJobId) {
    jobId = args.existingJobId;

    await ctx.runMutation(internal.ingestionJobs.resume, {
      jobId,
      reposRemaining: remainingRepos,
    });
  } else {
    jobId = await ctx.runMutation(internal.ingestionJobs.create, {
      userId: args.userId,
      repoFullName,
      installationId: args.installationId,
      since: args.since,
      until: args.until,
      status: "running",
      progress: args.initialProgress ?? 0,
      cursor: initialCursor,
      reposRemaining: remainingRepos,
      rateLimitRemaining: latestInstallation.rateLimitRemaining ?? undefined,
      rateLimitReset: latestInstallation.rateLimitReset ?? undefined,
    });
  }

  const jobSummary = {
    repo: repoFullName,
    jobId: jobId as string,
    status: args.existingJobId ? "running" : "pending",
    blockedUntil: undefined as number | undefined,
    eventsIngested: baseEventsIngested,
  };

  try {
    const result = await processRepoBackfill({
      ctx,
      jobId,
      repoFullName,
      installationId: args.installationId,
      sinceISO,
      untilISO,
      initialCursor,
      initialEtag,
      initialEventsIngested: baseEventsIngested,
      remainingRepos,
      args,
    });

    jobSummary.status = result.status;
    jobSummary.blockedUntil = result.blockedUntil;
    jobSummary.eventsIngested = result.eventsIngested;

    // If the job finished successfully (not blocked) and there are more repos,
    // we should theoretically schedule the next one.
    // However, the current architecture relies on 'continueBackfill' or a separate trigger.
    // For now, we return the single job result. The caller (UI/CLI) can see it completed.
    // Ideally, we would self-schedule the next repo here if not blocked.

    if (result.status === "completed" && remainingRepos.length > 0) {
      // Self-schedule next batch immediately?
      // For safety, let's rely on the scheduler or manual re-trigger for now to avoid infinite loops if buggy.
      // But actually, the user WANTS it to backfill all.
      // Let's schedule the continuation for the *next* repo immediately.

      await ctx.scheduler.runAfter(
        0,
        internal.actions.github.startBackfill.continueBackfill,
        {
          jobId: jobId,
        },
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await ctx.runMutation(internal.ingestionJobs.fail, {
      jobId,
      errorMessage,
    });
    throw error;
  }

  return { ok: true, jobs: [jobSummary] };
}

interface ProcessRepoArgs {
  ctx: ActionCtx;
  jobId: Id<"ingestionJobs">;
  repoFullName: string;
  installationId: number;
  sinceISO: string;
  untilISO?: string;
  initialCursor?: string;
  initialEtag?: string;
  initialEventsIngested?: number;
  remainingRepos: string[];
  args: {
    installationId: number;
    repositories: string[];
    since: number;
    until?: number;
  };
}

async function processRepoBackfill(
  params: ProcessRepoArgs,
): Promise<BackfillResult> {
  const {
    ctx,
    jobId,
    repoFullName,
    installationId,
    sinceISO,
    untilISO,
    initialCursor,
    initialEtag,
    initialEventsIngested,
    remainingRepos,
    args,
  } = params;

  const baseEvents = initialEventsIngested ?? 0;

  const { token } = await mintInstallationToken(installationId);
  let repoDetails: Awaited<ReturnType<typeof getRepository>> | null = null;
  try {
    repoDetails = await getRepository(token, repoFullName);
  } catch (error) {
    if (error instanceof RateLimitError) {
      const resetTime = new Date(error.reset).toISOString();
      logger.warn({ resetTime }, "Rate limit hit during getRepository");

      await ctx.runMutation(internal.ingestionJobs.markBlocked, {
        jobId,
        blockedUntil: error.reset,
        rateLimitRemaining: 0,
        rateLimitReset: error.reset,
      });

      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId,
        status: "paused",
        rateLimitRemaining: 0,
        rateLimitReset: error.reset,
      });

      await ctx.scheduler.runAt(
        error.reset,
        internal.actions.github.startBackfill.continueBackfill,
        {
          jobId,
        },
      );

      return {
        status: "blocked",
        eventsIngested: baseEvents,
        blockedUntil: error.reset,
      };
    }

    logger.error(
      { err: error, repoFullName },
      "Failed to load repository metadata for backfill",
    );
    throw error instanceof Error
      ? error
      : new Error("Unable to fetch repository metadata");
  }

  let cursor = initialCursor;
  let etag = initialEtag;
  let hasNextPage = true;
  let additionalEvents = 0;
  let totalCount = 0;

  while (hasNextPage) {
    const timeline = await fetchRepoTimeline({
      token,
      repoFullName,
      sinceISO,
      untilISO,
      cursor,
      etag,
    });

    totalCount = timeline.totalCount || totalCount;

    if (!timeline.notModified) {
      for (const node of timeline.nodes) {
        const canonical = canonicalizeEvent({
          kind: "timeline",
          item: node,
          repoFullName,
        });

        if (!canonical) {
          continue;
        }

        const result = await persistCanonicalEvent(ctx, canonical, {
          installationId,
          repoPayload: repoDetails,
        });

        if (result.status === "inserted") {
          additionalEvents++;
        }
      }
    }

    cursor = timeline.endCursor ?? cursor;
    etag = timeline.etag ?? etag;

    const totalEvents = baseEvents + additionalEvents;

    const progress =
      totalCount > 0
        ? Math.min(99, Math.round((totalEvents / totalCount) * 100))
        : Math.min(95, totalEvents);

    await ctx.runMutation(internal.ingestionJobs.updateProgress, {
      jobId,
      progress,
      eventsIngested: totalEvents,
      cursor: cursor ?? undefined,
      reposRemaining: remainingRepos,
      rateLimitRemaining: timeline.rateLimit.remaining,
      rateLimitReset: timeline.rateLimit.reset,
    });

    // OPTIMIZATION: Do NOT update installation state on every page.
    // This causes Optimistic Concurrency Failures if multiple jobs run for the same installation.
    // We only update the installation state when:
    // 1. We pause due to rate limits
    // 2. We finish the repo (complete)

    if (shouldPause(timeline.rateLimit.remaining)) {
      const blockedUntil =
        timeline.rateLimit.reset ?? Date.now() + DEFAULT_BLOCKED_DELAY_MS;

      await ctx.runMutation(internal.ingestionJobs.markBlocked, {
        jobId,
        blockedUntil,
        cursor: cursor ?? undefined,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
      });

      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId,
        status: "paused",
        lastCursor: cursor ?? undefined,
        etag: etag ?? undefined,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
      });

      // Schedule automatic continuation when rate limit resets
      await ctx.scheduler.runAt(
        blockedUntil,
        internal.actions.github.startBackfill.continueBackfill,
        {
          jobId,
        },
      );

      logger.info(
        {
          jobId,
          repoFullName,
          blockedUntil: new Date(blockedUntil).toISOString(),
          rateLimitRemaining: timeline.rateLimit.remaining,
        },
        "Rate limited, scheduled auto-resume",
      );

      return {
        status: "blocked",
        eventsIngested: totalEvents,
        blockedUntil,
      };
    }

    hasNextPage = !!timeline.hasNextPage && !timeline.notModified;

    if (!hasNextPage) {
      await ctx.runMutation(internal.ingestionJobs.complete, {
        jobId,
        eventsIngested: totalEvents,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
      });

      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId,
        status: "idle",
        lastCursor: undefined, // Clear cursor on completion
        etag: etag ?? undefined,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
        lastSyncedAt: Date.now(),
      });

      break;
    }
  }

  const finalEvents = baseEvents + additionalEvents;

  return {
    status: "completed",
    eventsIngested: finalEvents,
  };
}
