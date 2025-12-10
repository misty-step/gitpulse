/**
 * Sync Batches - Job-per-repo orchestration
 *
 * Deep module design:
 * - Simple interface: create(), jobCompleted(), jobFailed()
 * - Hides: Multi-repo coordination, completion detection, installation finalization
 *
 * Each batch groups N jobs (one per repo) for a single sync request.
 * No chaining logic needed - each job is independent.
 */

import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import type { SyncTrigger } from "./lib/syncPolicy";
import { logger } from "./lib/logger.js";

// Type for computed batch state (used to avoid OCC races)
interface BatchState {
  completed: number;
  failed: number;
  eventsIngested: number;
  total: number;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get batch by ID
 */
export const getById = internalQuery({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, { batchId }) => {
    return ctx.db.get(batchId);
  },
});

/**
 * Get active (running) batch for an installation
 */
export const getActiveForInstallation = internalQuery({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    return ctx.db
      .query("syncBatches")
      .withIndex("by_installationId_and_status", (q) =>
        q.eq("installationId", installationId).eq("status", "running")
      )
      .first();
  },
});

/**
 * Get latest batch for an installation (for status display)
 */
export const getLatestForInstallation = query({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    return ctx.db
      .query("syncBatches")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId)
      )
      .order("desc")
      .first();
  },
});

/**
 * Compute batch state by aggregating job statuses.
 *
 * This is the source of truth for batch progress - we query jobs
 * and compute counters rather than storing them (avoids OCC races).
 */
export const computeBatchState = internalQuery({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, { batchId }): Promise<BatchState> => {
    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
      .collect();

    let completed = 0;
    let failed = 0;
    let eventsIngested = 0;

    for (const job of jobs) {
      if (job.status === "completed") {
        completed++;
        eventsIngested += job.eventsIngested ?? 0;
      } else if (job.status === "failed") {
        failed++;
      }
    }

    return { completed, failed, eventsIngested, total: jobs.length };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new sync batch with jobs for each repository.
 *
 * Returns the batch ID and array of job IDs.
 */
export const create = internalMutation({
  args: {
    installationId: v.number(),
    userId: v.string(),
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("maintenance"),
      v.literal("recovery")
    ),
    repos: v.array(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { installationId, userId, trigger, repos, since, until } = args;
    const now = Date.now();

    // Create the batch
    const batchId = await ctx.db.insert("syncBatches", {
      installationId,
      trigger,
      status: "running",
      totalRepos: repos.length,
      completedRepos: 0,
      failedRepos: 0,
      eventsIngested: 0,
      createdAt: now,
    });

    // Create one job per repo
    const jobIds: Id<"ingestionJobs">[] = [];

    for (const repoFullName of repos) {
      const jobId = await ctx.db.insert("ingestionJobs", {
        userId,
        installationId,
        batchId,
        repoFullName,
        since,
        until,
        trigger,
        status: "pending",
        progress: 0,
        eventsIngested: 0,
        createdAt: now,
        lastUpdatedAt: now,
      });
      jobIds.push(jobId);
    }

    logger.info(
      { batchId, installationId, trigger, repoCount: repos.length },
      "Created sync batch with jobs"
    );

    return { batchId, jobIds };
  },
});

/**
 * Called when a job completes successfully.
 * Recomputes batch state from jobs to avoid OCC races.
 */
export const jobCompleted = internalMutation({
  args: {
    batchId: v.id("syncBatches"),
    eventsIngested: v.number(),
  },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch) {
      logger.error({ batchId }, "Batch not found for jobCompleted");
      return { batchComplete: false };
    }

    if (batch.status !== "running") {
      logger.warn(
        { batchId, status: batch.status },
        "jobCompleted called on non-running batch"
      );
      return { batchComplete: false };
    }

    // Compute state from jobs (avoids OCC race on counter increment)
    const state: BatchState = await ctx.runQuery(
      internal.syncBatches.computeBatchState,
      { batchId }
    );

    const batchComplete: boolean =
      state.completed + state.failed >= batch.totalRepos;

    await ctx.db.patch(batchId, {
      completedRepos: state.completed,
      failedRepos: state.failed,
      eventsIngested: state.eventsIngested,
      ...(batchComplete
        ? { status: "completed" as const, completedAt: Date.now() }
        : {}),
    });

    if (batchComplete) {
      logger.info(
        {
          batchId,
          totalRepos: batch.totalRepos,
          completedRepos: state.completed,
          failedRepos: state.failed,
          eventsIngested: state.eventsIngested,
        },
        "Sync batch completed"
      );

      // Finalize installation status
      await ctx.runMutation(internal.installations.updateSyncStatus, {
        installationId: batch.installationId,
        syncStatus: "idle",
        lastSyncError: undefined,
      });

      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId: batch.installationId,
        lastSyncedAt: Date.now(),
      });

      // Report generation handled by maybeFinalize (lazy finalization via cron)
      // This avoids double-scheduling and keeps report logic in one place
    }

    return { batchComplete, completedRepos: state.completed };
  },
});

/**
 * Called when a job fails.
 * Recomputes batch state from jobs to avoid OCC races.
 */
export const jobFailed = internalMutation({
  args: {
    batchId: v.id("syncBatches"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { batchId, errorMessage }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch) {
      logger.error({ batchId }, "Batch not found for jobFailed");
      return { batchComplete: false };
    }

    if (batch.status !== "running") {
      return { batchComplete: false };
    }

    // Compute state from jobs (avoids OCC race on counter increment)
    const state: BatchState = await ctx.runQuery(
      internal.syncBatches.computeBatchState,
      { batchId }
    );

    const batchComplete: boolean =
      state.completed + state.failed >= batch.totalRepos;

    // Determine final status: "completed" if some succeeded, "failed" if all failed
    const newStatus = batchComplete
      ? state.failed === batch.totalRepos
        ? "failed"
        : "completed"
      : "running";

    await ctx.db.patch(batchId, {
      completedRepos: state.completed,
      failedRepos: state.failed,
      eventsIngested: state.eventsIngested,
      ...(batchComplete
        ? {
            status: newStatus as "running" | "completed" | "failed",
            completedAt: Date.now(),
          }
        : {}),
    });

    if (batchComplete) {
      logger.warn(
        {
          batchId,
          totalRepos: batch.totalRepos,
          completedRepos: state.completed,
          failedRepos: state.failed,
          lastError: errorMessage,
        },
        "Sync batch completed with failures"
      );

      // Update installation status based on outcome
      await ctx.runMutation(internal.installations.updateSyncStatus, {
        installationId: batch.installationId,
        syncStatus: state.failed === batch.totalRepos ? "error" : "idle",
        lastSyncError:
          state.failed > 0
            ? `${state.failed} repo(s) failed to sync`
            : undefined,
      });

      // Still update lastSyncedAt if any repos succeeded
      if (state.completed > 0) {
        await ctx.runMutation(internal.installations.updateSyncState, {
          installationId: batch.installationId,
          lastSyncedAt: Date.now(),
        });
      }
    }

    return { batchComplete, failedRepos: state.failed };
  },
});

/**
 * Force-finalize a stuck batch (admin cleanup).
 * Recomputes state from jobs and marks batch complete.
 */
export const forceFinalize = internalMutation({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    // Compute state from jobs
    const state: BatchState = await ctx.runQuery(
      internal.syncBatches.computeBatchState,
      { batchId }
    );

    const allDone = state.completed + state.failed >= batch.totalRepos;
    if (!allDone) {
      return {
        success: false,
        error: `Not all jobs done: ${state.completed + state.failed}/${batch.totalRepos}`,
      };
    }

    // Determine final status
    const newStatus =
      state.failed === batch.totalRepos ? "failed" : "completed";

    await ctx.db.patch(batchId, {
      status: newStatus,
      completedRepos: state.completed,
      failedRepos: state.failed,
      eventsIngested: state.eventsIngested,
      completedAt: Date.now(),
    });

    // Update installation to idle
    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId: batch.installationId,
      syncStatus: newStatus === "failed" ? "error" : "idle",
      lastSyncError:
        state.failed > 0 ? `${state.failed} repo(s) failed to sync` : undefined,
    });

    logger.info(
      { batchId, newStatus, completed: state.completed, failed: state.failed },
      "Force-finalized stuck batch"
    );

    return { success: true, newStatus, state };
  },
});

/**
 * Lazily finalize a batch when all jobs are done.
 *
 * Called by getStatus when it detects all jobs completed.
 * Only finalizes once (idempotent) - skips if already finalized.
 *
 * Deep module: hides installation update + post-sync trigger behind simple interface.
 */
export const maybeFinalize = internalMutation({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch || batch.status !== "running") {
      return { finalized: false, reason: batch ? "already_finalized" : "not_found" };
    }

    // Compute state from jobs
    const state: BatchState = await ctx.runQuery(
      internal.syncBatches.computeBatchState,
      { batchId }
    );

    // Not done yet
    if (state.completed + state.failed < batch.totalRepos) {
      return { finalized: false, reason: "not_complete" };
    }

    // Determine final status
    const newStatus =
      state.failed === batch.totalRepos ? "failed" : "completed";

    // Finalize batch (one-time write)
    await ctx.db.patch(batchId, {
      status: newStatus,
      completedRepos: state.completed,
      failedRepos: state.failed,
      eventsIngested: state.eventsIngested,
      completedAt: Date.now(),
    });

    // Update installation status
    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId: batch.installationId,
      syncStatus: newStatus === "failed" ? "error" : "idle",
      lastSyncError:
        state.failed > 0 ? `${state.failed} repo(s) failed to sync` : undefined,
    });

    // Update lastSyncedAt if any repos succeeded
    if (state.completed > 0) {
      await ctx.runMutation(internal.installations.updateSyncState, {
        installationId: batch.installationId,
        lastSyncedAt: Date.now(),
      });
    }

    // Always trigger report generation on successful sync completion.
    // The report generator is the deep module that decides if events exist in the window.
    // We don't gate on eventsIngested here - that was a leaky abstraction.
    if (newStatus === "completed") {
      const firstJob = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
        .first();

      if (firstJob?.userId) {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.reports.generate.generateTodayDaily,
          { userId: firstJob.userId }
        );
        logger.info(
          {
            batchId,
            eventsIngested: state.eventsIngested,
            userId: firstJob.userId,
            totalRepos: batch.totalRepos,
          },
          state.eventsIngested > 0
            ? "Scheduled report generation (new events ingested)"
            : "Scheduled report generation (checking DB for existing events)"
        );
      }
    }

    logger.info(
      {
        batchId,
        newStatus,
        totalRepos: batch.totalRepos,
        completedRepos: state.completed,
        failedRepos: state.failed,
        eventsIngested: state.eventsIngested,
      },
      "Batch finalized"
    );

    return { finalized: true, newStatus, eventsIngested: state.eventsIngested };
  },
});

/**
 * Finalize all complete batches.
 *
 * Called by cron to ensure batches are finalized even if UI doesn't poll.
 * Safe to call repeatedly - maybeFinalize is idempotent.
 */
export const finalizeCompleteBatches = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all running batches
    const runningBatches = await ctx.db
      .query("syncBatches")
      .filter((q) => q.eq(q.field("status"), "running"))
      .collect();

    let finalized = 0;
    for (const batch of runningBatches) {
      const result = await ctx.runMutation(internal.syncBatches.maybeFinalize, {
        batchId: batch._id,
      });
      if (result.finalized) {
        finalized++;
      }
    }

    if (finalized > 0) {
      logger.info({ finalized, checked: runningBatches.length }, "Finalized complete batches");
    }

    return { checked: runningBatches.length, finalized };
  },
});

/**
 * Get progress info for a batch (for UI)
 */
export const getProgress = query({
  args: { batchId: v.id("syncBatches") },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch) return null;

    return {
      status: batch.status,
      totalRepos: batch.totalRepos,
      completedRepos: batch.completedRepos,
      failedRepos: batch.failedRepos ?? 0,
      eventsIngested: batch.eventsIngested,
      progressPercent: Math.round(
        ((batch.completedRepos + (batch.failedRepos ?? 0)) / batch.totalRepos) *
          100
      ),
    };
  },
});
