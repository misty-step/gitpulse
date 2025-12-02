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
 * - Hides: policy evaluation, job management, status updates, metrics
 * - Enforces: one active job per installation invariant
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
}

// ============================================================================
// Service
// ============================================================================

/**
 * Request a sync for an installation.
 *
 * This is the single entrypoint for all sync operations. It:
 * 1. Loads installation state
 * 2. Evaluates policy to decide if sync should start
 * 3. On start: sets status, enqueues job, returns success
 * 4. On skip/block: returns decision for caller to handle
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

  // 2. Check for existing active job (one-job-per-installation invariant)
  const activeJob = await ctx.runQuery(
    internal.ingestionJobs.getActiveForInstallation,
    { installationId }
  );

  if (activeJob) {
    emitSyncMetric(installationId, trigger, "already_has_job");
    logger.info(
      { installationId, trigger, existingJobId: activeJob._id },
      "Sync request skipped - active job exists"
    );
    return {
      started: false,
      message: "A sync is already in progress",
      details: { jobId: activeJob._id },
    };
  }

  // 3. Evaluate policy
  const decision = evaluate(toInstallationState(installation), trigger, now);

  // 4. Handle decision
  if (!canStart(decision)) {
    return handleSkipOrBlock(ctx, installation, trigger, decision);
  }

  // 5. Start the sync
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
 * Start a sync by setting status and enqueuing a job.
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
    // Policy should have caught this, but defensive check
    return {
      started: false,
      message: "Installation not configured",
    };
  }

  const repositories = installation.repositories ?? [];
  if (repositories.length === 0) {
    // Policy should have caught this, but defensive check
    return {
      started: false,
      message: "No repositories selected for sync",
    };
  }

  // Calculate time window
  const since = params.since ?? calculateSyncSince(installation.lastSyncedAt, now);
  const until = params.until;

  // Update status to syncing and track manual sync time
  await ctx.runMutation(internal.installations.updateSyncStatus, {
    installationId,
    syncStatus: "syncing" as const,
    lastSyncError: undefined,
    ...(trigger === "manual" ? { lastManualSyncAt: now } : {}),
  });

  // Create the ingestion job
  try {
    const jobId = await ctx.runMutation(internal.ingestionJobs.create, {
      userId: clerkUserId,
      repoFullName: repositories[0],
      installationId,
      since,
      until,
      status: "pending",
      progress: 0,
      reposRemaining: repositories.slice(1),
      trigger,
    });

    // Schedule the worker to process the job
    await ctx.scheduler.runAfter(
      0,
      internal.actions.sync.processSyncJob.processSyncJob,
      { jobId }
    );

    emitSyncMetric(installationId, trigger, "started");

    logger.info(
      {
        installationId,
        trigger,
        repoCount: repositories.length,
        jobId,
        since: new Date(since).toISOString(),
      },
      "Sync started"
    );

    return {
      started: true,
      message: "Sync started",
      details: { jobId: jobId as string },
    };
  } catch (error) {
    // Backfill failed to start — update status to error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await ctx.runMutation(internal.installations.updateSyncStatus, {
      installationId,
      syncStatus: "error",
      lastSyncError: errorMessage,
    });

    emitSyncMetric(installationId, trigger, "error");

    logger.error(
      { installationId, trigger, error: errorMessage },
      "Sync failed to start"
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
