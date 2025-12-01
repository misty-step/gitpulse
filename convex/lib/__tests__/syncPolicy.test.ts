/**
 * Sync Policy Tests
 *
 * Tests for the pure sync policy module. All tests are deterministic
 * and require no mocks since the policy has zero I/O.
 */

import {
  evaluate,
  reasonToUserMessage,
  canStart,
  calculateSyncSince,
  type InstallationState,
  type SyncTrigger,
  MANUAL_SYNC_COOLDOWN_MS,
  STALE_BYPASS_THRESHOLD_MS,
  MIN_SYNC_BUDGET,
  WEBHOOK_BUDGET_RESERVE,
} from "../syncPolicy";

describe("syncPolicy.evaluate", () => {
  const NOW = 1700000000000; // Fixed timestamp for deterministic tests

  const baseState: InstallationState = {
    installationId: 12345,
    clerkUserId: "user_123",
    repositories: ["owner/repo1", "owner/repo2"],
    syncStatus: "idle",
    lastSyncedAt: NOW - 4 * 60 * 60 * 1000, // 4 hours ago
    lastManualSyncAt: NOW - 2 * 60 * 60 * 1000, // 2 hours ago
    rateLimitRemaining: 5000,
  };

  describe("when installation is ready for sync", () => {
    it("returns start for manual trigger", () => {
      const decision = evaluate(baseState, "manual", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("returns start for cron trigger", () => {
      const decision = evaluate(baseState, "cron", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("returns start for webhook trigger", () => {
      const decision = evaluate(baseState, "webhook", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("returns start for maintenance trigger", () => {
      const decision = evaluate(baseState, "maintenance", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });
  });

  describe("no_clerk_user check", () => {
    it("blocks when clerkUserId is missing", () => {
      const state: InstallationState = {
        ...baseState,
        clerkUserId: undefined,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("no_clerk_user");
    });

    it("blocks when clerkUserId is empty string", () => {
      const state: InstallationState = {
        ...baseState,
        clerkUserId: "",
      };

      // Empty string is falsy
      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("no_clerk_user");
    });
  });

  describe("no_repositories check", () => {
    it("blocks when repositories is undefined", () => {
      const state: InstallationState = {
        ...baseState,
        repositories: undefined,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("no_repositories");
    });

    it("blocks when repositories is empty array", () => {
      const state: InstallationState = {
        ...baseState,
        repositories: [],
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("no_repositories");
    });
  });

  describe("cooldown_active check (manual only)", () => {
    it("skips when manual cooldown is active", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000, // 30 minutes ago
        lastSyncedAt: NOW - 30 * 60 * 1000, // Recent enough to not be stale
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("skip");
      expect(decision.reason).toBe("cooldown_active");
      expect(decision.metadata?.cooldownMs).toBeGreaterThan(0);
      expect(decision.metadata?.cooldownMs).toBeLessThanOrEqual(
        MANUAL_SYNC_COOLDOWN_MS
      );
    });

    it("returns remaining cooldown time in metadata", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 45 * 60 * 1000, // 45 minutes ago
        lastSyncedAt: NOW - 45 * 60 * 1000,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("skip");
      // Should have 15 minutes remaining
      expect(decision.metadata?.cooldownMs).toBe(15 * 60 * 1000);
    });

    it("allows sync when cooldown has expired", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - MANUAL_SYNC_COOLDOWN_MS - 1000, // Just expired
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("bypasses cooldown when installation is stale (never synced)", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000, // 30 minutes ago (in cooldown)
        lastSyncedAt: undefined, // Never synced
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("bypasses cooldown when installation is stale (>48 hours)", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000, // 30 minutes ago (in cooldown)
        lastSyncedAt: NOW - STALE_BYPASS_THRESHOLD_MS - 1000, // Just stale
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("does not apply cooldown for cron trigger", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000, // In cooldown
        lastSyncedAt: NOW - 30 * 60 * 1000,
      };

      const decision = evaluate(state, "cron", NOW);
      expect(decision.action).toBe("start");
      expect(decision.reason).toBe("ready");
    });

    it("does not apply cooldown for webhook trigger", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000,
        lastSyncedAt: NOW - 30 * 60 * 1000,
      };

      const decision = evaluate(state, "webhook", NOW);
      expect(decision.action).toBe("start");
    });

    it("does not apply cooldown for maintenance trigger", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000,
        lastSyncedAt: NOW - 30 * 60 * 1000,
      };

      const decision = evaluate(state, "maintenance", NOW);
      expect(decision.action).toBe("start");
    });
  });

  describe("rate_limited check", () => {
    it("blocks when budget is below minimum", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: MIN_SYNC_BUDGET - 1,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("rate_limited");
      expect(decision.metadata?.requiredBudget).toBe(MIN_SYNC_BUDGET);
      expect(decision.metadata?.availableBudget).toBe(MIN_SYNC_BUDGET - 1);
    });

    it("allows when budget equals minimum for manual", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: MIN_SYNC_BUDGET,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
    });

    it("requires extra budget for cron (webhook reserve)", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: MIN_SYNC_BUDGET + WEBHOOK_BUDGET_RESERVE - 1,
      };

      const decision = evaluate(state, "cron", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("rate_limited");
      expect(decision.metadata?.requiredBudget).toBe(
        MIN_SYNC_BUDGET + WEBHOOK_BUDGET_RESERVE
      );
    });

    it("allows cron when budget meets reserve requirement", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: MIN_SYNC_BUDGET + WEBHOOK_BUDGET_RESERVE,
      };

      const decision = evaluate(state, "cron", NOW);
      expect(decision.action).toBe("start");
    });

    it("does not require extra budget for webhook trigger", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: MIN_SYNC_BUDGET,
      };

      const decision = evaluate(state, "webhook", NOW);
      expect(decision.action).toBe("start");
    });

    it("includes blockedUntil from rateLimitReset", () => {
      const resetTime = NOW + 60 * 60 * 1000;
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: 0,
        rateLimitReset: resetTime,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.metadata?.blockedUntil).toBe(resetTime);
    });

    it("defaults to 5000 when rateLimitRemaining is undefined", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: undefined,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
    });
  });

  describe("already_syncing check (manual only)", () => {
    it("blocks manual sync when already syncing", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "syncing",
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("block");
      expect(decision.reason).toBe("already_syncing");
    });

    it("allows cron when already syncing", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "syncing",
      };

      // Cron should be allowed to queue even if syncing
      // (the orchestrator will enforce single-job invariant)
      const decision = evaluate(state, "cron", NOW);
      expect(decision.action).toBe("start");
    });

    it("allows webhook when already syncing", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "syncing",
      };

      const decision = evaluate(state, "webhook", NOW);
      expect(decision.action).toBe("start");
    });

    it("allows maintenance when already syncing", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "syncing",
      };

      const decision = evaluate(state, "maintenance", NOW);
      expect(decision.action).toBe("start");
    });

    it("allows manual sync when status is idle", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "idle",
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
    });

    it("allows manual sync when status is error", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "error",
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
    });

    it("allows manual sync when status is rate_limited", () => {
      const state: InstallationState = {
        ...baseState,
        syncStatus: "rate_limited",
        rateLimitRemaining: 5000, // Has budget now
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.action).toBe("start");
    });
  });

  describe("check order (first failure wins)", () => {
    it("returns no_clerk_user before no_repositories", () => {
      const state: InstallationState = {
        ...baseState,
        clerkUserId: undefined,
        repositories: [],
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.reason).toBe("no_clerk_user");
    });

    it("returns no_repositories before cooldown", () => {
      const state: InstallationState = {
        ...baseState,
        repositories: [],
        lastManualSyncAt: NOW - 30 * 60 * 1000,
        lastSyncedAt: NOW - 30 * 60 * 1000,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.reason).toBe("no_repositories");
    });

    it("returns cooldown before rate_limited", () => {
      const state: InstallationState = {
        ...baseState,
        lastManualSyncAt: NOW - 30 * 60 * 1000,
        lastSyncedAt: NOW - 30 * 60 * 1000,
        rateLimitRemaining: 0,
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.reason).toBe("cooldown_active");
    });

    it("returns rate_limited before already_syncing", () => {
      const state: InstallationState = {
        ...baseState,
        rateLimitRemaining: 0,
        syncStatus: "syncing",
      };

      const decision = evaluate(state, "manual", NOW);
      expect(decision.reason).toBe("rate_limited");
    });
  });
});

describe("reasonToUserMessage", () => {
  it("returns friendly message for ready", () => {
    expect(reasonToUserMessage("ready")).toBe("Sync started");
  });

  it("returns friendly message for no_clerk_user", () => {
    expect(reasonToUserMessage("no_clerk_user")).toBe(
      "Installation not configured"
    );
  });

  it("returns friendly message for no_repositories", () => {
    expect(reasonToUserMessage("no_repositories")).toBe(
      "No repositories selected for sync"
    );
  });

  it("returns friendly message for cooldown_active with time", () => {
    const message = reasonToUserMessage("cooldown_active", {
      cooldownMs: 15 * 60 * 1000,
    });
    expect(message).toBe("Please wait 15 minutes before syncing again");
  });

  it("returns singular minute for 1 minute cooldown", () => {
    const message = reasonToUserMessage("cooldown_active", {
      cooldownMs: 60 * 1000,
    });
    expect(message).toBe("Please wait 1 minute before syncing again");
  });

  it("returns friendly message for rate_limited", () => {
    expect(reasonToUserMessage("rate_limited")).toBe(
      "GitHub API rate limit reached. Please try again later."
    );
  });

  it("returns friendly message for already_syncing", () => {
    expect(reasonToUserMessage("already_syncing")).toBe(
      "Sync already in progress"
    );
  });
});

describe("canStart", () => {
  it("returns true for start action", () => {
    expect(canStart({ action: "start", reason: "ready" })).toBe(true);
  });

  it("returns false for skip action", () => {
    expect(canStart({ action: "skip", reason: "cooldown_active" })).toBe(false);
  });

  it("returns false for block action", () => {
    expect(canStart({ action: "block", reason: "no_repositories" })).toBe(
      false
    );
  });
});

describe("calculateSyncSince", () => {
  const NOW = 1700000000000;
  const ONE_HOUR = 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  it("returns lastSyncedAt minus buffer when lastSyncedAt exists", () => {
    const lastSyncedAt = NOW - 4 * ONE_HOUR;
    const since = calculateSyncSince(lastSyncedAt, NOW);
    expect(since).toBe(lastSyncedAt - ONE_HOUR);
  });

  it("uses custom buffer when provided", () => {
    const lastSyncedAt = NOW - 4 * ONE_HOUR;
    const customBuffer = 2 * ONE_HOUR;
    const since = calculateSyncSince(lastSyncedAt, NOW, customBuffer);
    expect(since).toBe(lastSyncedAt - customBuffer);
  });

  it("returns 30 days ago when lastSyncedAt is undefined", () => {
    const since = calculateSyncSince(undefined, NOW);
    expect(since).toBe(NOW - THIRTY_DAYS);
  });

  it("returns 30 days ago when lastSyncedAt is 0", () => {
    // 0 is falsy in JavaScript, so treated as no previous sync
    const since = calculateSyncSince(0, NOW);
    expect(since).toBe(NOW - THIRTY_DAYS);
  });
});
