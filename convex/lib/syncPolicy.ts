/**
 * Sync Policy Module — Pure Decision Engine
 *
 * This module contains zero I/O. Every function is deterministic and
 * unit-testable without mocks. It implements the sync request decision
 * logic that was previously scattered across githubIngestionService and
 * continuousSync.
 *
 * Design (Ousterhout):
 * - Simple interface: evaluate(state, trigger, now) → SyncDecision
 * - Hides: all policy thresholds, bypass logic, budget calculations
 * - Pure: same inputs always produce same outputs
 */

// ============================================================================
// Types
// ============================================================================

export type SyncTrigger = "manual" | "cron" | "webhook" | "maintenance" | "recovery";

export type SyncAction = "start" | "skip" | "block";

export interface SyncDecision {
  action: SyncAction;
  reason: SyncReason;
  metadata?: {
    cooldownMs?: number;
    blockedUntil?: number;
    requiredBudget?: number;
    availableBudget?: number;
  };
}

/**
 * Reasons why a sync decision was made.
 *
 * Each reason maps to a specific condition in the policy logic.
 * This allows callers to translate reasons into user-facing messages
 * without re-implementing the policy.
 */
export type SyncReason =
  | "ready" // All checks passed, sync can start
  | "no_clerk_user" // Installation not linked to a Clerk user
  | "no_repositories" // No repositories configured for sync
  | "cooldown_active" // Manual sync throttled, not stale enough to bypass
  | "rate_limited" // Insufficient API budget
  | "already_syncing"; // Sync already in progress

/**
 * Minimal installation state required for policy decisions.
 *
 * This is a subset of Doc<"installations"> — only the fields
 * the policy needs to make a decision.
 */
export interface InstallationState {
  installationId: number;
  clerkUserId?: string;
  repositories?: string[];
  syncStatus?: "idle" | "syncing" | "rate_limited" | "error";
  lastSyncedAt?: number;
  lastManualSyncAt?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

// ============================================================================
// Policy Constants
// ============================================================================

/** Minimum API budget required to start a sync */
export const MIN_SYNC_BUDGET = 100;

/** Extra budget reserved for webhooks during cron syncs */
export const WEBHOOK_BUDGET_RESERVE = 500;

/** Minimum time between manual syncs (5 minutes for testing, was 1 hour) */
export const MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

/** If installation hasn't synced in this long, bypass cooldown (48 hours) */
export const STALE_BYPASS_THRESHOLD_MS = 48 * 60 * 60 * 1000;

// ============================================================================
// Policy Logic
// ============================================================================

/**
 * Evaluate whether a sync should start for the given installation.
 *
 * This is the main entrypoint. It applies all policy checks in order
 * and returns a decision with a reason and optional metadata.
 *
 * @param state - Current installation state
 * @param trigger - What initiated this sync request
 * @param now - Current timestamp (passed for testability)
 * @returns Decision with action, reason, and metadata
 */
export function evaluate(
  state: InstallationState,
  trigger: SyncTrigger,
  now: number
): SyncDecision {
  // 1. Must have a linked Clerk user
  if (!state.clerkUserId) {
    return {
      action: "block",
      reason: "no_clerk_user",
    };
  }

  // 2. Must have repositories to sync
  const repos = state.repositories ?? [];
  if (repos.length === 0) {
    return {
      action: "block",
      reason: "no_repositories",
    };
  }

  // 3. Manual sync cooldown (with stale bypass)
  // Recovery syncs bypass cooldown entirely (system-initiated auto-healing)
  if (trigger === "manual") {
    const cooldownResult = evaluateManualCooldown(state, now);
    if (cooldownResult) {
      return cooldownResult;
    }
  }

  // 4. Rate limit budget check
  const budgetResult = evaluateRateLimitBudget(state, trigger);
  if (budgetResult) {
    return budgetResult;
  }

  // 5. Already syncing guard (manual only)
  // Recovery syncs can proceed even if already syncing (they're re-queued for later)
  if (trigger === "manual" && state.syncStatus === "syncing") {
    return {
      action: "block",
      reason: "already_syncing",
    };
  }

  // All checks passed
  return {
    action: "start",
    reason: "ready",
  };
}

/**
 * Check manual sync cooldown.
 *
 * Returns a skip decision if cooldown is active and installation
 * isn't stale enough to bypass. Returns null if check passes.
 */
function evaluateManualCooldown(
  state: InstallationState,
  now: number
): SyncDecision | null {
  const lastManual = state.lastManualSyncAt ?? 0;
  const cooldownRemaining = lastManual + MANUAL_SYNC_COOLDOWN_MS - now;

  // Cooldown expired
  if (cooldownRemaining <= 0) {
    return null;
  }

  // Check for stale bypass
  const isStale =
    !state.lastSyncedAt ||
    now - state.lastSyncedAt > STALE_BYPASS_THRESHOLD_MS;

  if (isStale) {
    return null; // Bypass cooldown for stale installations
  }

  // Cooldown active and not stale
  return {
    action: "skip",
    reason: "cooldown_active",
    metadata: {
      cooldownMs: cooldownRemaining,
    },
  };
}

/**
 * Check rate limit budget.
 *
 * Cron triggers reserve extra budget for webhooks.
 * Returns a block decision if budget is too low.
 */
function evaluateRateLimitBudget(
  state: InstallationState,
  trigger: SyncTrigger
): SyncDecision | null {
  const budget = state.rateLimitRemaining ?? 5000; // Default to full budget

  // Cron syncs reserve budget for webhooks
  const requiredBudget =
    trigger === "cron"
      ? MIN_SYNC_BUDGET + WEBHOOK_BUDGET_RESERVE
      : MIN_SYNC_BUDGET;

  if (budget < requiredBudget) {
    return {
      action: "block",
      reason: "rate_limited",
      metadata: {
        requiredBudget,
        availableBudget: budget,
        blockedUntil: state.rateLimitReset,
      },
    };
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a SyncReason to a user-friendly message.
 *
 * This keeps all user-facing strings in one place and
 * prevents policy details from leaking into UI components.
 */
export function reasonToUserMessage(
  reason: SyncReason,
  metadata?: SyncDecision["metadata"]
): string {
  switch (reason) {
    case "ready":
      return "Sync started";
    case "no_clerk_user":
      return "Installation not configured";
    case "no_repositories":
      return "No repositories selected for sync";
    case "cooldown_active": {
      const mins = metadata?.cooldownMs
        ? Math.ceil(metadata.cooldownMs / 60000)
        : 60;
      return `Please wait ${mins} minute${mins === 1 ? "" : "s"} before syncing again`;
    }
    case "rate_limited":
      return "GitHub API rate limit reached. Please try again later.";
    case "already_syncing":
      return "Sync already in progress";
  }
}

/**
 * Check if a decision allows starting a sync.
 */
export function canStart(decision: SyncDecision): boolean {
  return decision.action === "start";
}

/**
 * Calculate the "since" timestamp for an incremental sync.
 *
 * Uses lastSyncedAt with a buffer for overlap, or falls back
 * to 30 days ago for initial syncs.
 *
 * @param lastSyncedAt - Last successful sync timestamp
 * @param now - Current timestamp
 * @param overlapBufferMs - Buffer to add for overlap (default: 1 hour)
 */
export function calculateSyncSince(
  lastSyncedAt: number | undefined,
  now: number,
  overlapBufferMs: number = 60 * 60 * 1000
): number {
  if (lastSyncedAt) {
    return lastSyncedAt - overlapBufferMs;
  }
  // Default: 30 days ago
  return now - 30 * 24 * 60 * 60 * 1000;
}
