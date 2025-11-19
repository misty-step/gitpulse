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
import { getRepository } from "../../lib/github";

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
}

type BackfillReturn = { ok: boolean; jobs: Array<{ repo: string; jobId: string; status: string; blockedUntil?: number; eventsIngested?: number }> };

/**
 * Admin version of startBackfill - bypasses auth for CLI usage
 *
 * Use this when you need to run a backfill directly from the command line.
 */
export const adminStartBackfill = internalAction({
  args: {
    installationId: v.number(),
    clerkUserId: v.string(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillReturn> => {
    // Admin version - no auth check, uses provided clerkUserId
    return runBackfillInternal(ctx, {
      installationId: args.installationId,
      userId: args.clerkUserId,
      repositories: args.repositories,
      since: args.since,
      until: args.until,
    });
  },
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
      throw new Error(`[${ErrorCode.NOT_AUTHENTICATED}] GitHub backfill requires authentication`);
    }

    const installation = await ctx.runQuery(api.installations.getByInstallationId, {
      installationId: args.installationId,
    });

    if (!installation) {
      throw new Error(
        `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} not registered`
      );
    }

    if (installation.clerkUserId && installation.clerkUserId !== identity.subject) {
      throw new Error(
        `[${ErrorCode.UNAUTHORIZED}] User ${identity.subject} cannot manage installation ${args.installationId}`
      );
    }

    return runBackfillInternal(ctx, {
      installationId: args.installationId,
      userId: identity.subject,
      repositories: args.repositories.length > 0 ? args.repositories : installation.repositories ?? [],
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
      console.error("[continueBackfill] Job not found", { jobId: args.jobId });
      return { ok: false, jobs: [] };
    }

    if (job.status === "completed" || job.status === "failed") {
      console.log("[continueBackfill] Job already finished, skipping", {
        jobId: args.jobId,
        status: job.status,
      });
      return { ok: true, jobs: [] };
    }

    if (!job.installationId) {
      console.error("[continueBackfill] Job missing installationId", { jobId: args.jobId });
      return { ok: false, jobs: [] };
    }

    // Build repository list from job state
    const repositories = job.reposRemaining && job.reposRemaining.length > 0
      ? job.reposRemaining
      : [job.repoFullName];

    console.log("[continueBackfill] Resuming job", {
      jobId: args.jobId,
      repositories,
      cursor: job.cursor,
    });

    return runBackfillInternal(ctx, {
      installationId: job.installationId,
      userId: job.userId,
      repositories,
      since: job.since ?? Date.now() - 30 * 24 * 60 * 60 * 1000, // Default: 30 days
      until: job.until,
    });
  },
});

// Implementation of runBackfillInternal (declared above)
async function runBackfillInternal(
  ctx: ActionCtx,
  args: BackfillInternalArgs
): Promise<BackfillReturn> {
  const installation = await ctx.runQuery(api.installations.getByInstallationId, {
    installationId: args.installationId,
  });

  if (!installation) {
    throw new Error(
      `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} not registered`
    );
  }

  const reposToProcess = args.repositories.slice(0, MAX_REPOS_PER_INVOCATION);

  if (reposToProcess.length === 0) {
    throw new Error(
      `[${ErrorCode.INVALID_INPUT}] No repositories available for installation ${args.installationId}`
    );
  }

  const sinceISO = new Date(args.since).toISOString();
  const untilISO = args.until ? new Date(args.until).toISOString() : undefined;

  const jobSummaries: Array<{
    repo: string;
    jobId: string;
    status: string;
    blockedUntil?: number;
    eventsIngested?: number;
  }> = [];

  for (let index = 0; index < reposToProcess.length; index++) {
    const repoFullName = reposToProcess[index];
    const remainingRepos = reposToProcess.slice(index + 1);

    const latestInstallation = await ctx.runQuery(api.installations.getByInstallationId, {
      installationId: args.installationId,
    });

    if (!latestInstallation) {
      throw new Error(
        `[${ErrorCode.NOT_FOUND}] Installation ${args.installationId} missing during backfill`
      );
    }

    const jobId = await ctx.runMutation(internal.ingestionJobs.create, {
      userId: args.userId,
      repoFullName,
      installationId: args.installationId,
      since: args.since,
      until: args.until,
      status: "running",
      progress: 0,
      cursor: latestInstallation.lastCursor ?? undefined,
      reposRemaining: remainingRepos,
      rateLimitRemaining: latestInstallation.rateLimitRemaining ?? undefined,
      rateLimitReset: latestInstallation.rateLimitReset ?? undefined,
    });

      try {
        const result = await processRepoBackfill({
          ctx,
          jobId,
          repoFullName,
          installationId: args.installationId,
          sinceISO,
          untilISO,
          initialCursor: latestInstallation.lastCursor ?? undefined,
          initialEtag: latestInstallation.etag ?? undefined,
          remainingRepos,
          args,
        });

        jobSummaries.push({
          repo: repoFullName,
          jobId: jobId as string,
          status: result.status,
          blockedUntil: result.blockedUntil,
          eventsIngested: result.eventsIngested,
        });

        if (result.status === "blocked") {
          // Stop processing further repos; scheduler will resume later.
          return { ok: true, jobs: jobSummaries };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await ctx.runMutation(internal.ingestionJobs.fail, {
          jobId,
          errorMessage,
        });
        throw error;
      }
    }

    return { ok: true, jobs: jobSummaries };
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
  remainingRepos: string[];
  args: {
    installationId: number;
    repositories: string[];
    since: number;
    until?: number;
  };
}

async function processRepoBackfill(params: ProcessRepoArgs): Promise<BackfillResult> {
  const {
    ctx,
    jobId,
    repoFullName,
    installationId,
    sinceISO,
    untilISO,
    initialCursor,
    initialEtag,
    remainingRepos,
    args,
  } = params;

  const { token } = await mintInstallationToken(installationId);
  let repoDetails: Awaited<ReturnType<typeof getRepository>> | null = null;
  try {
    repoDetails = await getRepository(token, repoFullName);
  } catch (error) {
    console.error("Failed to load repository metadata for backfill", {
      repoFullName,
      error,
    });
    throw error instanceof Error ? error : new Error("Unable to fetch repository metadata");
  }

  let cursor = initialCursor;
  let etag = initialEtag;
  let hasNextPage = true;
  let processedEvents = 0;
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
          processedEvents++;
        }
      }
    }

    cursor = timeline.endCursor ?? cursor;
    etag = timeline.etag ?? etag;

    const progress =
      totalCount > 0
        ? Math.min(99, Math.round((processedEvents / totalCount) * 100))
        : Math.min(95, processedEvents);

    await ctx.runMutation(internal.ingestionJobs.updateProgress, {
      jobId,
      progress,
      eventsIngested: processedEvents,
      cursor: cursor ?? undefined,
      reposRemaining: remainingRepos,
      rateLimitRemaining: timeline.rateLimit.remaining,
      rateLimitReset: timeline.rateLimit.reset,
    });

    await ctx.runMutation(internal.installations.updateSyncState, {
      installationId,
      lastCursor: cursor ?? undefined,
      etag: etag ?? undefined,
      lastSyncedAt: Date.now(),
      rateLimitRemaining: timeline.rateLimit.remaining,
      rateLimitReset: timeline.rateLimit.reset,
      status: timeline.notModified ? "idle" : "active",
    });

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
        }
      );

      console.log("[Backfill] Rate limited, scheduled auto-resume", {
        jobId,
        repoFullName,
        blockedUntil: new Date(blockedUntil).toISOString(),
        rateLimitRemaining: timeline.rateLimit.remaining,
      });

      return {
        status: "blocked",
        eventsIngested: processedEvents,
        blockedUntil,
      };
    }

    hasNextPage = !!timeline.hasNextPage && !timeline.notModified;

    if (!hasNextPage) {
      await ctx.runMutation(internal.ingestionJobs.complete, {
        jobId,
        eventsIngested: processedEvents,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
      });

      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId,
        status: "idle",
        lastCursor: undefined,
        etag: etag ?? undefined,
        rateLimitRemaining: timeline.rateLimit.remaining,
        rateLimitReset: timeline.rateLimit.reset,
        lastSyncedAt: Date.now(),
      });

      break;
    }
  }

  return {
    status: "completed",
    eventsIngested: processedEvents,
  };
}
