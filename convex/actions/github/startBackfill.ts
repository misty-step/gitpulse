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

export const startBackfill = internalAction({
  args: {
    installationId: v.number(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    const repoUniverse =
      args.repositories.length > 0
        ? args.repositories
        : installation.repositories ?? [];

    const reposToProcess = repoUniverse.slice(0, MAX_REPOS_PER_INVOCATION);

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
        userId: identity.subject,
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
  },
});

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

      await ctx.scheduler.runAt(
        blockedUntil,
        internal.actions.github.startBackfill.startBackfill,
        {
          installationId,
          repositories: [repoFullName, ...remainingRepos],
          since: args.since,
          until: args.until,
        }
      );

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
