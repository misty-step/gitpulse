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
  /** Current sync state */
  state: "idle" | "syncing" | "blocked" | "error";

  /** Whether a manual sync can be started right now */
  canSyncNow: boolean;

  /** If canSyncNow is false due to cooldown, ms until sync is allowed */
  cooldownMs?: number;

  /** If state is 'blocked', when the sync will resume (epoch ms) */
  blockedUntil?: number;

  /** Progress of the active job, if any */
  activeJobProgress?: {
    current: number;
    total: number;
  };

  /** Timestamp of last successful sync (epoch ms) */
  lastSyncedAt?: number;

  /** Last error message, normalized for user display */
  lastSyncError?: string;
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

    // 4. Check for active job
    const activeJob = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "running"),
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "blocked")
        )
      )
      .first();

    // 5. Determine current state
    let state: SyncStatus["state"] = "idle";

    if (activeJob) {
      if (activeJob.status === "blocked") {
        state = "blocked";
      } else {
        state = "syncing";
      }
    } else if (installation.syncStatus === "error") {
      state = "error";
    } else if (installation.syncStatus === "syncing") {
      // syncStatus says syncing but no active job - likely stale state
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

    // 7. Build progress info
    let activeJobProgress: SyncStatus["activeJobProgress"];
    if (activeJob) {
      const reposTotal = 1 + (activeJob.reposRemaining?.length ?? 0);
      const reposDone =
        reposTotal - (activeJob.reposRemaining?.length ?? 0) - 1;
      activeJobProgress = {
        current: activeJob.eventsIngested ?? 0,
        total: reposDone * 100 + (activeJob.progress ?? 0), // Approximate based on repos
      };
    }

    // 8. Build response
    return {
      state,
      canSyncNow,
      cooldownMs,
      blockedUntil: activeJob?.blockedUntil ?? undefined,
      activeJobProgress,
      lastSyncedAt: installation.lastSyncedAt ?? undefined,
      lastSyncError: normalizeErrorMessage(installation.lastSyncError),
    };
  },
});

/**
 * Get sync status for all user's installations.
 *
 * Convenience query for dashboards that show multiple installations.
 */
export const getStatusForUser = query({
  args: {},
  handler: async (ctx): Promise<Array<SyncStatus & { installationId: number }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const installations = await ctx.db
      .query("installations")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .collect();

    const results: Array<SyncStatus & { installationId: number }> = [];

    for (const installation of installations) {
      // Check for active job
      const activeJob = await ctx.db
        .query("ingestionJobs")
        .withIndex("by_installationId", (q) =>
          q.eq("installationId", installation.installationId)
        )
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "running"),
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "blocked")
          )
        )
        .first();

      // Determine state
      let state: SyncStatus["state"] = "idle";
      if (activeJob) {
        state = activeJob.status === "blocked" ? "blocked" : "syncing";
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

      // Build progress
      let activeJobProgress: SyncStatus["activeJobProgress"];
      if (activeJob) {
        activeJobProgress = {
          current: activeJob.eventsIngested ?? 0,
          total: activeJob.progress ?? 0,
        };
      }

      results.push({
        installationId: installation.installationId,
        state,
        canSyncNow: decision.action === "start",
        cooldownMs:
          decision.reason === "cooldown_active"
            ? decision.metadata?.cooldownMs
            : undefined,
        blockedUntil: activeJob?.blockedUntil ?? undefined,
        activeJobProgress,
        lastSyncedAt: installation.lastSyncedAt ?? undefined,
        lastSyncError: normalizeErrorMessage(installation.lastSyncError),
      });
    }

    return results;
  },
});
