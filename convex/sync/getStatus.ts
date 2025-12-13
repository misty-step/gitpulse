/**
 * Sync Status View-Model — Minimal UI Contract
 *
 * This query provides all sync state information the UI needs through
 * a single, minimal interface. Components depend only on this view-model,
 * not on raw installation or ingestionJob tables.
 *
 * Design (Ousterhout):
 * - Simple interface: getStatus({ installationId }) → SyncStatus
 * - Hides: policy evaluation, job state aggregation, error normalization
 * - UI components become thin views over this data
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { evaluate, type InstallationState } from "../lib/syncPolicy";

// ============================================================================
// Types
// ============================================================================

/**
 * SyncStatus — The complete sync state view-model.
 *
 * This is the only type UI components should use for sync state.
 * It normalizes all internal state into a simple, consistent structure.
 */
export interface SyncStatus {
  /** Current sync state. "finishing" = all jobs done, awaiting lazy finalization */
  state: "idle" | "syncing" | "blocked" | "error" | "recovering" | "finishing";

  /** Whether a manual sync can be started right now */
  canSyncNow: boolean;

  /** If canSyncNow is false due to cooldown, ms until sync is allowed */
  cooldownMs?: number;

  /** If state is 'blocked', when the sync will resume (epoch ms) */
  blockedUntil?: number;

  /** Batch progress (job-per-repo architecture) */
  batchProgress?: {
    /** Total repositories in this sync */
    totalRepos: number;
    /** Repositories completed so far */
    completedRepos: number;
    /** Repositories that failed */
    failedRepos: number;
    /** Total events ingested across all repos */
    eventsIngested: number;
    /** Current repo being synced (if any running job) */
    currentRepo?: string;
    /** When the batch started (epoch ms) */
    startedAt?: number;
  };

  /** Timestamp of last successful sync (epoch ms) */
  lastSyncedAt?: number;

  /** Last error message, normalized for user display */
  lastSyncError?: string;

  /** Number of automated recovery attempts for this installation */
  recoveryAttempts?: number;

  /** When the next recovery attempt is scheduled (epoch ms) */
  nextRecoveryAt?: number;

  /** Escalation guidance when automated recovery has failed */
  escalation?: {
    kind: "webhook_failure";
    message: string;
    actionUrl: string;
  };

  /** Recent sync completion summary (shown briefly for UX feedback) */
  lastCompletedSync?: {
    completedAt: number;
    totalRepos: number;
    eventsIngested: number;
  };
}

// ============================================================================
// Error Message Normalization
// ============================================================================

/**
 * Normalize internal error messages to user-friendly text.
 *
 * Hides raw Convex/GitHub errors behind helpful messages.
 */
function normalizeErrorMessage(error?: string): string | undefined {
  if (!error) return undefined;

  // Rate limit errors
  if (error.toLowerCase().includes("rate limit")) {
    return "GitHub API rate limit reached. Sync will resume automatically.";
  }

  // Auth/token errors
  if (
    error.toLowerCase().includes("token") ||
    error.toLowerCase().includes("auth") ||
    error.toLowerCase().includes("401")
  ) {
    return "GitHub authentication failed. Please reconnect your account.";
  }

  // Network errors
  if (
    error.toLowerCase().includes("network") ||
    error.toLowerCase().includes("fetch") ||
    error.toLowerCase().includes("timeout")
  ) {
    return "Connection to GitHub failed. Please try again.";
  }

  // Generic fallback - don't expose internal details
  if (error.length > 100 || error.includes("Error:")) {
    return "Sync encountered an error. Please try again.";
  }

  return error;
}

// ============================================================================
// Query
// ============================================================================

/**
 * Get sync status for an installation.
 *
 * Returns the complete sync view-model that UI components need.
 * Requires authentication and validates installation ownership.
 */
export const getStatus = query({
  args: {
    installationId: v.number(),
  },
  handler: async (ctx, args): Promise<SyncStatus | null> => {
    const { installationId } = args;

    // 1. Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // 2. Load installation
    const installation = await ctx.db
      .query("installations")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId)
      )
      .unique();

    if (!installation) {
      return null;
    }

    // 3. Verify ownership
    if (installation.clerkUserId !== identity.subject) {
      return null;
    }

    // 4. Check for active batch (job-per-repo architecture)
    const activeBatch = await ctx.db
      .query("syncBatches")
      .withIndex("by_installationId_and_status", (q) =>
        q.eq("installationId", installationId).eq("status", "running")
      )
      .first();

    // Get current running job (for currentRepo display)
    const runningJob = activeBatch
      ? await ctx.db
          .query("ingestionJobs")
          .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
          .filter((q) => q.eq(q.field("status"), "running"))
          .first()
      : null;

    // 5. Determine current state
    let state: SyncStatus["state"] = "idle";
    const isRecovering = activeBatch?.trigger === "recovery";
    let blockedJob = null;

    if (isRecovering) {
      state = "recovering";
    } else if (activeBatch) {
      // Check if any job in the batch is blocked
      blockedJob = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
        .filter((q) => q.eq(q.field("status"), "blocked"))
        .first();
      
      state = blockedJob ? "blocked" : "syncing";
    } else if (installation.syncStatus === "error") {
      state = "error";
    } else if (installation.syncStatus === "syncing") {
      // syncStatus says syncing but no active batch - likely stale state
      state = "idle";
    }

    // 6. Use policy to determine if sync can start
    const installationState: InstallationState = {
      installationId: installation.installationId,
      clerkUserId: installation.clerkUserId,
      repositories: installation.repositories,
      syncStatus: installation.syncStatus,
      lastSyncedAt: installation.lastSyncedAt,
      lastManualSyncAt: installation.lastManualSyncAt,
      rateLimitRemaining: installation.rateLimitRemaining,
      rateLimitReset: installation.rateLimitReset,
    };

    const now = Date.now();
    const decision = evaluate(installationState, "manual", now);

    const canSyncNow = decision.action === "start";
    const cooldownMs =
      decision.action === "skip" && decision.reason === "cooldown_active"
        ? decision.metadata?.cooldownMs
        : undefined;

    // 7. Build progress info by computing live state from jobs
    // (We no longer rely on batch document counters since jobs don't call back)
    let batchProgress: SyncStatus["batchProgress"];
    if (activeBatch) {
      // Aggregate job statuses directly for accurate live progress
      const jobs = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
        .collect();

      let completedRepos = 0;
      let failedRepos = 0;
      let eventsIngested = 0;

      for (const job of jobs) {
        if (job.status === "completed") {
          completedRepos++;
          eventsIngested += job.eventsIngested ?? 0;
        } else if (job.status === "failed") {
          failedRepos++;
        }
      }

      batchProgress = {
        totalRepos: activeBatch.totalRepos,
        completedRepos,
        failedRepos,
        eventsIngested,
        currentRepo: runningJob?.repoFullName,
        startedAt: activeBatch.createdAt,
      };
    }

    // 8. Build response
    const escalation =
      (installation.recoveryAttempts ?? 0) >= 3
        ? {
            kind: "webhook_failure" as const,
            message:
              "GitHub webhooks may have stopped. Check App installation.",
            actionUrl: `https://github.com/settings/installations/${installation.installationId}`,
          }
        : undefined;

    return {
      state,
      canSyncNow,
      cooldownMs,
      blockedUntil: blockedJob?.blockedUntil ?? undefined,
      batchProgress,
      lastSyncedAt: installation.lastSyncedAt ?? undefined,
      lastSyncError: normalizeErrorMessage(installation.lastSyncError),
      recoveryAttempts: installation.recoveryAttempts ?? undefined,
      nextRecoveryAt:
        state === "recovering"
          ? blockedJob?.blockedUntil ?? installation.lastRecoveryAt ?? undefined
          : undefined,
      escalation,
    };
  },
});

/**
 * UserSyncStatus — Extended SyncStatus with installation identity.
 *
 * Used by getStatusForUser for multi-installation dashboards.
 */
export interface UserSyncStatus extends SyncStatus {
  /** Installation ID */
  installationId: number;
  /** GitHub account name (org or user) */
  accountLogin?: string;
}

/**
 * Get sync status for all user's installations.
 *
 * Convenience query for dashboards that show multiple installations.
 */
export const getStatusForUser = query({
  args: {},
  handler: async (ctx): Promise<UserSyncStatus[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const installations = await ctx.db
      .query("installations")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .collect();

    const results: UserSyncStatus[] = [];

    for (const installation of installations) {
      // Check for active batch
      const activeBatch = await ctx.db
        .query("syncBatches")
        .withIndex("by_installationId_and_status", (q) =>
          q
            .eq("installationId", installation.installationId)
            .eq("status", "running")
        )
        .first();

      // Get running job for currentRepo
      const runningJob = activeBatch
        ? await ctx.db
            .query("ingestionJobs")
            .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
            .filter((q) => q.eq(q.field("status"), "running"))
            .first()
        : null;

      // Check for blocked job
      let blockedJob = null;
      if (activeBatch) {
        blockedJob = await ctx.db
          .query("ingestionJobs")
          .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
          .filter((q) => q.eq(q.field("status"), "blocked"))
          .first();
      }

      // Determine state (with "finishing" for all-jobs-done but not-yet-finalized)
      let state: SyncStatus["state"] = "idle";
      const isRecovering = activeBatch?.trigger === "recovery";

      if (isRecovering) {
        state = "recovering";
      } else if (activeBatch) {
        if (blockedJob) {
          state = "blocked";
        } else {
          // Check if all jobs are done (completing + failed >= total)
          const jobs = await ctx.db
            .query("ingestionJobs")
            .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
            .collect();

          const completed = jobs.filter((j) => j.status === "completed").length;
          const failed = jobs.filter((j) => j.status === "failed").length;
          const allDone = completed + failed >= activeBatch.totalRepos;

          state = allDone ? "finishing" : "syncing";
        }
      } else if (installation.syncStatus === "error") {
        state = "error";
      }

      // Policy check
      const installationState: InstallationState = {
        installationId: installation.installationId,
        clerkUserId: installation.clerkUserId,
        repositories: installation.repositories,
        syncStatus: installation.syncStatus,
        lastSyncedAt: installation.lastSyncedAt,
        lastManualSyncAt: installation.lastManualSyncAt,
        rateLimitRemaining: installation.rateLimitRemaining,
        rateLimitReset: installation.rateLimitReset,
      };

      const now = Date.now();
      const decision = evaluate(installationState, "manual", now);

      // Build progress from jobs (computed live, not stale batch counters)
      let batchProgress: SyncStatus["batchProgress"];
      if (activeBatch) {
        const jobs = await ctx.db
          .query("ingestionJobs")
          .withIndex("by_batchId", (q) => q.eq("batchId", activeBatch._id))
          .collect();

        let completedRepos = 0;
        let failedRepos = 0;
        let eventsIngested = 0;

        for (const job of jobs) {
          if (job.status === "completed") {
            completedRepos++;
            eventsIngested += job.eventsIngested ?? 0;
          } else if (job.status === "failed") {
            failedRepos++;
          }
        }

        batchProgress = {
          totalRepos: activeBatch.totalRepos,
          completedRepos,
          failedRepos,
          eventsIngested,
          currentRepo: runningJob?.repoFullName,
          startedAt: activeBatch.createdAt,
        };
      }

      // Query recently completed batch for UI feedback (30 second window)
      let lastCompletedSync: SyncStatus["lastCompletedSync"];
      if (state === "idle") {
        const recentBatch = await ctx.db
          .query("syncBatches")
          .withIndex("by_installationId_and_status", (q) =>
            q
              .eq("installationId", installation.installationId)
              .eq("status", "completed")
          )
          .order("desc")
          .first();

        const now = Date.now();
        if (recentBatch?.completedAt && now - recentBatch.completedAt < 30000) {
          lastCompletedSync = {
            completedAt: recentBatch.completedAt,
            totalRepos: recentBatch.totalRepos,
            eventsIngested: recentBatch.eventsIngested ?? 0,
          };
        }
      }

      results.push({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        state,
        canSyncNow: decision.action === "start",
        cooldownMs:
          decision.reason === "cooldown_active"
            ? decision.metadata?.cooldownMs
            : undefined,
        blockedUntil: blockedJob?.blockedUntil ?? undefined,
        batchProgress,
        lastSyncedAt: installation.lastSyncedAt ?? undefined,
        lastSyncError: normalizeErrorMessage(installation.lastSyncError),
        recoveryAttempts: installation.recoveryAttempts ?? undefined,
        nextRecoveryAt:
          state === "recovering"
            ? blockedJob?.blockedUntil ?? installation.lastRecoveryAt ?? undefined
            : undefined,
        escalation:
          (installation.recoveryAttempts ?? 0) >= 3
            ? {
                kind: "webhook_failure",
                message:
                  "GitHub webhooks may have stopped. Check App installation.",
                actionUrl: `https://github.com/settings/installations/${installation.installationId}`,
              }
            : undefined,
        lastCompletedSync,
      });
    }

    return results;
  },
});
