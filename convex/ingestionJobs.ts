/**
 * Ingestion Jobs - Track GitHub data ingestion progress
 *
 * Used for background batch processing with real-time progress updates.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { ErrorCode } from "./lib/types";
import { logger } from "./lib/logger.js";

/**
 * List active ingestion jobs for current user
 *
 * Returns jobs that are pending or running.
 * Returns empty array if not authenticated (graceful degradation).
 */
export const listActive = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    // Graceful degradation: Return empty array if not authenticated
    if (!identity) {
      logger.info(
        "listActive query called without authentication - returning empty array",
      );
      return [];
    }

    const userId = identity.subject;
    logger.info({ userId }, "listActive query for user");

    // OPTIMIZATION: Use the new composite index to fetch only active jobs.
    // Convex doesn't support 'OR' on index fields, so we run two queries and merge.

    const pendingJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .order("desc")
      .take(10);

    const runningJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "running"),
      )
      .order("desc")
      .take(10);

    const now = Date.now();
    const blockedJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "blocked"),
      )
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("blockedUntil"), undefined),
          q.gte(q.field("blockedUntil"), now - 60 * 1000), // ignore stale blocked jobs older than 1 minute
        ),
      )
      .take(10);

    // Merge, sort, and take the most recent 10 active jobs
    const combined = [...pendingJobs, ...runningJobs, ...blockedJobs];
    combined.sort((a, b) => b.createdAt - a.createdAt);

    return combined.slice(0, 10);
  },
});

/**
 * Get a specific ingestion job by ID (public, auth required)
 *
 * Returns null if not authenticated or unauthorized (graceful degradation).
 */
export const get = query({
  args: { jobId: v.id("ingestionJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return null if not authenticated
    if (!identity) {
      return null;
    }

    const job = await ctx.db.get(args.jobId);

    // Return null if job doesn't exist
    if (!job) {
      return null;
    }

    // Verify ownership - return null if unauthorized
    if (job.userId !== identity.subject) {
      return null;
    }

    return job;
  },
});

/**
 * List all jobs for current user (with pagination support)
 *
 * Returns empty array if not authenticated (graceful degradation).
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return empty array if not authenticated
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 50;

    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return jobs;
  },
});

/**
 * Create a new ingestion job (internal use only)
 *
 * Called from actions to track batch ingestion progress
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    repoFullName: v.string(),
    installationId: v.optional(v.number()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    status: v.string(),
    progress: v.optional(v.number()),
    cursor: v.optional(v.string()),
    reposRemaining: v.optional(v.array(v.string())),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
    trigger: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("cron"),
        v.literal("webhook"),
        v.literal("maintenance"),
        v.literal("recovery")
      )
    ),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("ingestionJobs", {
      ...args,
      createdAt: Date.now(),
      startedAt: args.status === "running" ? Date.now() : undefined,
      lastUpdatedAt: Date.now(),
    });

    return jobId;
  },
});

/**
 * Update ingestion job progress (internal use only)
 */
export const updateProgress = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    progress: v.number(),
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
    cursor: v.optional(v.string()),
    reposRemaining: v.optional(v.array(v.string())),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;

    await ctx.db.patch(jobId, {
      ...updates,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Mark job as completed (internal use only)
 */
export const complete = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...stats } = args;

    await ctx.db.patch(jobId, {
      status: "completed",
      progress: 100,
      completedAt: Date.now(),
      ...stats,
      blockedUntil: undefined,
    });
  },
});

/**
 * Mark job as failed (internal use only)
 */
export const fail = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    errorMessage: v.string(),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
      rateLimitRemaining: args.rateLimitRemaining,
      rateLimitReset: args.rateLimitReset,
      blockedUntil: undefined,
    });
  },
});

/**
 * Mark a job as blocked due to rate limits
 */
export const markBlocked = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    blockedUntil: v.number(),
    cursor: v.optional(v.string()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...rest } = args;

    await ctx.db.patch(jobId, {
      status: "blocked",
      ...rest,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Resume a blocked job (internal use only)
 *
 * Clears the cooldown flag and marks the job as running again so the UI
 * reflects the resumed state while the scheduler continues processing.
 */
export const resume = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return;
    }

    await ctx.db.patch(args.jobId, {
      status: "running",
      blockedUntil: undefined,
      startedAt: job.startedAt ?? job.createdAt ?? Date.now(),
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Dismiss/acknowledge a job (user action)
 *
 * Doesn't delete, just marks as acknowledged so it won't show in active jobs
 */
export const dismiss = mutation({
  args: { jobId: v.id("ingestionJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      const error = `[${ErrorCode.NOT_AUTHENTICATED}] User not authenticated`;
      logger.error(error);
      throw new Error(error);
    }

    const job = await ctx.db.get(args.jobId);

    // Verify ownership
    if (!job || job.userId !== identity.subject) {
      const error = `[${ErrorCode.UNAUTHORIZED}] User ${identity.subject} unauthorized to dismiss job ${args.jobId}`;
      logger.error({ userId: identity.subject, jobId: args.jobId }, error);
      throw new Error(error);
    }

    // For now, we'll just let the query filter handle this
    // In future, could add an "acknowledged" field
    // await ctx.db.patch(args.jobId, { acknowledged: true });
  },
});

/**
 * Get job by ID (internal use - no auth required)
 *
 * Used by continueBackfill and other internal actions
 */
export const getById = internalQuery({
  args: { jobId: v.id("ingestionJobs") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.jobId);
  },
});

/**
 * List jobs for a batch (internal use)
 *
 * Used by post-sync analysis to get userId from batch jobs.
 */
export const listByBatch = internalQuery({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("ingestionJobs")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

/**
 * Get active job for an installation (internal use)
 *
 * Returns the first job that is pending, running, or blocked for this installation.
 * Used by SyncService to enforce one-job-per-installation invariant.
 */
export const getActiveForInstallation = internalQuery({
  args: { installationId: v.number() },
  handler: async (ctx, args) => {
    // Check for running jobs first (most common active state)
    const runningJob = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();

    if (runningJob) return runningJob;

    // Check for pending jobs
    const pendingJob = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (pendingJob) return pendingJob;

    // Check for blocked jobs (will resume soon)
    const blockedJob = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .filter((q) => q.eq(q.field("status"), "blocked"))
      .first();

    return blockedJob ?? null;
  },
});

/**
 * Find blocked jobs past their blockedUntil time (safety net query)
 *
 * Returns jobs that should have resumed but are still blocked.
 * Used by cron to catch any jobs where the scheduler failed.
 */
export const findStuckBlockedJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find jobs with status "blocked" where blockedUntil has passed
    const stuckJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .filter((q) =>
        q.and(
          q.neq(q.field("blockedUntil"), undefined),
          q.lt(q.field("blockedUntil"), now),
        ),
      )
      .take(100); // Limit to prevent "Array too long" errors

    return stuckJobs;
  },
});

/**
 * Cleanup completed/failed jobs to prevent table explosion.
 *
 * Deletes jobs older than 1 hour that are in a terminal state.
 * Limits to 1000 deletions per run to avoid timeouts.
 * Can be scheduled recursively if needed.
 */
export const clearCompletedJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let deletedCount = 0;
    const limit = 1000;

    // 1. Find completed jobs older than 1 hour
    const completedJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.lt(q.field("createdAt"), oneHourAgo))
      .take(limit);

    for (const job of completedJobs) {
      await ctx.db.delete(job._id);
      deletedCount++;
    }

    // 2. Find failed jobs older than 1 hour (if we haven't hit limit)
    if (deletedCount < limit) {
      const failedJobs = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_status", (q) => q.eq("status", "failed"))
        .filter((q) => q.lt(q.field("createdAt"), oneHourAgo))
        .take(limit - deletedCount);

      for (const job of failedJobs) {
        await ctx.db.delete(job._id);
        deletedCount++;
      }
    }

    logger.info({ deletedCount }, "Deleted old jobs");

    return deletedCount;
  },
});

/**
 * Find and fail "zombie" jobs that have been running for too long without an update.
 *
 * This handles cases where a server process died or a job hung indefinitely.
 * Checks for jobs in "running" state with lastUpdatedAt > 10 minutes ago.
 */
export const cleanupStuckJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    // Convex doesn't support complex filtering on non-indexed fields efficiently for large datasets,
    // but active "running" jobs should be few.
    // We'll query by status "running" and filter in memory (safe if active job count is low).

    const runningJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    let fixedCount = 0;

    for (const job of runningJobs) {
      // Check if lastUpdatedAt is old, OR if it's missing and createdAt is old
      const lastActivity = job.lastUpdatedAt ?? job.createdAt;

      if (lastActivity < tenMinutesAgo) {
        logger.warn(
          {
            jobId: job._id,
            repoFullName: job.repoFullName,
          },
          "Failing zombie job",
        );

        await ctx.db.patch(job._id, {
          status: "failed",
          errorMessage: "Job timed out (zombie detection)",
          completedAt: Date.now(),
          blockedUntil: undefined,
        });
        fixedCount++;
      }
    }

    return fixedCount;
  },
});

/**
 * Cleanup old 'blocked' jobs that are likely ghosts from previous incidents.
 * Deletes jobs with status='blocked' older than 24 hours.
 */
export const cleanOldBlockedJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const limit = 1000;

    const oldBlockedJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .filter((q) => q.lt(q.field("createdAt"), oneDayAgo))
      .take(limit);

    let deletedCount = 0;
    for (const job of oldBlockedJobs) {
      await ctx.db.delete(job._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

/**
 * Purge blocked jobs whose cooldown has already expired.
 * Safety valve for UIs stuck showing long-expired cooldown banners.
 */
export const purgeExpiredBlocked = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes past blockedUntil
    let deleted = 0;
    let batch = 0;

    while (true) {
      const candidates = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_status", (q) => q.eq("status", "blocked"))
        .filter((q) =>
          q.and(
            q.neq(q.field("blockedUntil"), undefined),
            q.lt(q.field("blockedUntil"), cutoff),
          ),
        )
        .take(1000);

      if (candidates.length === 0) break;

      for (const job of candidates) {
        await ctx.db.delete(job._id);
        deleted++;
      }

      batch++;
      // safety valve to avoid infinite loop
      if (batch > 50) {
        logger.warn(
          { deleted },
          "Stopping after 50k deletions to avoid runaway",
        );
        break;
      }
    }

    return deleted;
  },
});

/**
 * HOTFIX: Delete jobs blocked until absurdly far future (> 1 year ahead).
 * Targets buggy far-future dates from past GitHub abuse limit incidents
 * while preserving legitimate rate-limit blocks (hours/days ahead).
 */
export const forceDelete2025Jobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Target only timestamps more than 1 year in the future
    // Legitimate GitHub rate-limit blocks are typically hours/days ahead, not years
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000; // > 1 year ahead

    const futureBlockedJobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .filter((q) => q.gt(q.field("blockedUntil"), farFuture))
      .take(100); // Lower limit to avoid read overflow

    let deletedCount = 0;
    for (const job of futureBlockedJobs) {
      await ctx.db.delete(job._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      logger.info(
        { deletedCount, farFutureThreshold: new Date(farFuture).toISOString() },
        "Deleted jobs blocked until absurdly far future",
      );
    }

    return deletedCount;
  },
});
