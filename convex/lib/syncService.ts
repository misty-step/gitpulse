"use node";

/**
 * Sync Service — Single Entrypoint for Sync Requests
 *
 * This module provides the single orchestration layer for all sync operations.
 * Callers don't need to understand policy, timestamps, budgets, or job state —
 * they just call `request()` and get a decision.
 *
 * Design (Ousterhout):
 * - Simple interface: request({ installationId, trigger }) → SyncResult
 * - Hides: policy evaluation, batch/job management, status updates, metrics
 * - Enforces: one active batch per installation invariant
 *
 * Architecture: Job-per-repo
 * - Each sync request creates one batch containing N jobs (one per repo)
 * - No chaining logic needed — each job is independent
 * - Batch tracks overall progress, jobs track per-repo progress
 */

import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import {
  evaluate,
  canStart,
  calculateSyncSince,
  reasonToUserMessage,
  type SyncTrigger,
  type SyncDecision,
} from "./syncPolicy";
import { emitMetric } from "./metrics";
import { logger } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a sync request.
 *
 * Callers receive a clean result with user-friendly messaging.
 * They don't need to understand the underlying decision mechanics.
 */
export interface SyncResult {
  /** Whether the sync was started */
  started: boolean;
  /** User-friendly message about the result */
  message: string;
  /** Additional details for UI display */
  details?: {
    /** Remaining cooldown if skipped due to throttle */
    cooldownMs?: number;
    /** When rate limit resets if blocked */
    blockedUntil?: number;
    /** Job ID if sync was started */
    jobId?: string;
  };
}

export interface RequestSyncParams {
  installationId: number;
  trigger: SyncTrigger;
  /** Override the since timestamp (optional, defaults to calculated value) */
  since?: number;
  /** Override the until timestamp (optional, defaults to now) */
  until?: number;
  /** Force full 30-day backfill, ignoring lastSyncedAt (for recovery) */
  forceFullSync?: boolean;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Request a sync for an installation.
 *
 * This is the single entrypoint for all sync operations. It:
 * 1. Loads installation state
 * 2. Checks for existing active batch (one-batch-per-installation invariant)
 * 3. Evaluates policy to decide if sync should start
 * 4. On start: creates batch with N jobs, schedules workers
 * 5. On skip/block: returns decision for caller to handle
 *
 * Callers include:
 * - Cron scheduler (continuous sync)
 * - Webhook handler (auto-backfill after events)
 * - Manual "Sync Now" UI
 * - Maintenance recovery
 *
 * @param ctx - Convex action context
 * @param params - Sync request parameters
 * @returns Result with started flag and user message
 */
export async function request(
  ctx: ActionCtx,
  params: RequestSyncParams
): Promise<SyncResult> {
  const { installationId, trigger } = params;
  const now = Date.now();

  // 1. Load installation
  const installation = await ctx.runQuery(
    api.installations.getByInstallationId,
    { installationId }
  );

  if (!installation) {
    emitSyncMetric(installationId, trigger, "not_found");
    return {
      started: false,
      message: "Installation not found",
    };
  }

  // 2. Check for existing active batch (one-batch-per-installation invariant)
  const activeBatch = await ctx.runQuery(
    internal.syncBatches.getActiveForInstallation,
    { installationId }
  );

  if (activeBatch) {
    emitSyncMetric(installationId, trigger, "already_has_batch");
    logger.info(
      { installationId, trigger, existingBatchId: activeBatch._id },
      "Sync request skipped - active batch exists"
    );
    return {
      started: false,
      message: "A sync is already in progress",
      details: { jobId: activeBatch._id },
    };
  }

  // 3. Clean up stale syncStatus: "syncing" if no active batch exists
  if (installation.syncStatus === "syncing") {
    logger.warn(
      { installationId, trigger },
      "Cleaning up stale syncStatus: syncing with no active batch"
    );
    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId,
      syncStatus: "idle",
    });
    installation.syncStatus = "idle";
  }

  // 4. Evaluate policy
  const decision = evaluate(toInstallationState(installation), trigger, now);

  // 5. Handle decision
  if (!canStart(decision)) {
    return handleSkipOrBlock(ctx, installation, trigger, decision);
  }

  // 6. Start the sync
  return startSync(ctx, installation, trigger, params, now);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Handle a skip or block decision.
 */
async function handleSkipOrBlock(
  ctx: ActionCtx,
  installation: Doc<"installations">,
  trigger: SyncTrigger,
  decision: SyncDecision
): Promise<SyncResult> {
  const { installationId } = installation;

  emitSyncMetric(installationId, trigger, decision.reason);

  logger.info(
    {
      installationId,
      trigger,
      decision: decision.reason,
      metadata: decision.metadata,
    },
    "Sync request declined by policy"
  );

  const message = reasonToUserMessage(decision.reason, decision.metadata);

  // For rate_limited, update installation status
  if (decision.reason === "rate_limited" && decision.metadata?.blockedUntil) {
    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId,
      syncStatus: "rate_limited",
      nextSyncAt: decision.metadata.blockedUntil,
    });
  }

  return {
    started: false,
    message,
    details: {
      cooldownMs: decision.metadata?.cooldownMs,
      blockedUntil: decision.metadata?.blockedUntil,
    },
  };
}

/**
 * Start a sync by creating a batch with jobs and scheduling workers.
 *
 * Job-per-repo architecture:
 * - Creates one batch for the sync request
 * - Batch contains N jobs (one per repository)
 * - Each job processes exactly one repo (no chaining)
 * - Batch tracks overall progress
 */
async function startSync(
  ctx: ActionCtx,
  installation: Doc<"installations">,
  trigger: SyncTrigger,
  params: RequestSyncParams,
  now: number
): Promise<SyncResult> {
  const { installationId, clerkUserId } = installation;

  if (!clerkUserId) {
    return {
      started: false,
      message: "Installation not configured",
    };
  }

  const repositories = installation.repositories ?? [];
  if (repositories.length === 0) {
    return {
      started: false,
      message: "No repositories selected for sync",
    };
  }

  // Calculate time window
  // forceFullSync: Always go back 30 days regardless of lastSyncedAt
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const since = params.since ?? (params.forceFullSync
    ? now - THIRTY_DAYS_MS
    : calculateSyncSince(installation.lastSyncedAt, now));
  const until = params.until;

  // Debug logging for time window analysis
  const windowDays = (now - since) / (24 * 60 * 60 * 1000);
  logger.info(
    {
      installationId,
      trigger,
      forceFullSync: params.forceFullSync ?? false,
      lastSyncedAt: installation.lastSyncedAt
        ? new Date(installation.lastSyncedAt).toISOString()
        : null,
      since: new Date(since).toISOString(),
      until: until ? new Date(until).toISOString() : "now",
      windowDays: Math.round(windowDays * 10) / 10,
    },
    "Sync time window calculated"
  );

  // Update status to syncing
  await ctx.runMutation(internal.installations.updateSyncStatus, {
    installationId,
    syncStatus: "syncing" as const,
    lastSyncError: undefined,
    ...(trigger === "manual" ? { lastManualSyncAt: now } : {}),
  });

  try {
    // Create batch with N jobs (one per repo)
    const { batchId, jobIds } = await ctx.runMutation(
      internal.syncBatches.create,
      {
        installationId,
        userId: clerkUserId,
        trigger,
        repos: repositories,
        since,
        until,
      }
    );

    // Schedule workers in batches to avoid OCC conflicts
    // When all jobs complete simultaneously, they race to update syncBatches
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 1000;

    for (let i = 0; i < jobIds.length; i++) {
      const batchIndex = Math.floor(i / BATCH_SIZE);
      const delay = batchIndex * BATCH_DELAY_MS;
      await ctx.scheduler.runAfter(
        delay,
        internal.actions.sync.processSyncJob.processSyncJob,
        { jobId: jobIds[i] }
      );
    }

    emitSyncMetric(installationId, trigger, "started");

    logger.info(
      {
        installationId,
        trigger,
        batchId,
        repoCount: repositories.length,
        jobCount: jobIds.length,
        since: new Date(since).toISOString(),
      },
      "Sync batch started"
    );

    return {
      started: true,
      message: "Sync started",
      details: { jobId: batchId as string },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId,
      syncStatus: "error",
      lastSyncError: errorMessage,
    });

    emitSyncMetric(installationId, trigger, "error");

    logger.error(
      { installationId, trigger, error: errorMessage },
      "Sync batch failed to start"
    );

    return {
      started: false,
      message: "Sync failed to start. Please try again.",
    };
  }
}

/**
 * Convert a full installation document to the minimal state needed for policy.
 */
function toInstallationState(
  installation: Doc<"installations">
): Parameters<typeof evaluate>[0] {
  return {
    installationId: installation.installationId,
    clerkUserId: installation.clerkUserId,
    repositories: installation.repositories,
    syncStatus: installation.syncStatus,
    lastSyncedAt: installation.lastSyncedAt,
    lastManualSyncAt: installation.lastManualSyncAt,
    rateLimitRemaining: installation.rateLimitRemaining,
    rateLimitReset: installation.rateLimitReset,
  };
}

/**
 * Emit a structured metric for sync requests.
 */
function emitSyncMetric(
  installationId: number,
  trigger: SyncTrigger,
  result: string
): void {
  emitMetric("sync.request", {
    installationId,
    trigger,
    result,
  });
}
