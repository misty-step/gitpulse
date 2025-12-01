/**
 * Sync Service Tests
 *
 * Tests for the sync service orchestrator. These tests mock the Convex context
 * to verify the service correctly orchestrates policy evaluation, job management,
 * and status updates.
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { request, type SyncResult } from "../syncService";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import type { Doc } from "../../_generated/dataModel";

// Mock the generated API module
jest.mock("../../_generated/api", () => ({
  api: {
    installations: {
      getByInstallationId: "api.installations.getByInstallationId",
    },
  },
  internal: {
    installations: {
      updateSyncStatus: "internal.installations.updateSyncStatus",
    },
    ingestionJobs: {
      getActiveForInstallation: "internal.ingestionJobs.getActiveForInstallation",
    },
    actions: {
      github: {
        startBackfill: {
          adminStartBackfill: "internal.actions.github.startBackfill.adminStartBackfill",
        },
      },
    },
  },
}));

// Mock the metrics and logger modules
jest.mock("../metrics", () => ({
  emitMetric: jest.fn(),
}));

jest.mock("../logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("syncService.request", () => {
  const NOW = 1700000000000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function buildInstallation(
    overrides: Partial<Doc<"installations">> = {}
  ): Doc<"installations"> {
    return {
      _id: "installation_1" as Doc<"installations">["_id"],
      _creationTime: NOW,
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["owner/repo1", "owner/repo2"],
      syncStatus: "idle",
      lastSyncedAt: NOW - 4 * 60 * 60 * 1000,
      lastManualSyncAt: NOW - 2 * 60 * 60 * 1000,
      rateLimitRemaining: 5000,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    } as Doc<"installations">;
  }

  describe("when installation is not found", () => {
    it("returns not started with appropriate message", async () => {
      const runQuery = createAsyncMock();
      runQuery.mockResolvedValue(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("Installation not found");
    });
  });

  describe("when active job exists", () => {
    it("returns not started with job info", async () => {
      const installation = buildInstallation();
      const activeJob = {
        _id: "job_123",
        status: "running",
        installationId: 12345,
      };

      const runQuery = createAsyncMock();
      // First call: getByInstallationId, second call: getActiveForInstallation
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(activeJob);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("A sync is already in progress");
      expect(result.details?.jobId).toBe("job_123");
    });
  });

  describe("when policy blocks the sync", () => {
    it("handles no_clerk_user", async () => {
      const installation = buildInstallation({ clerkUserId: undefined });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null); // no active job
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("Installation not configured");
    });

    it("handles no_repositories", async () => {
      const installation = buildInstallation({ repositories: [] });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("No repositories selected for sync");
    });

    it("handles cooldown_active with remaining time", async () => {
      const installation = buildInstallation({
        lastSyncedAt: NOW - 30 * 60 * 1000, // 30 min ago (not stale)
        lastManualSyncAt: NOW - 30 * 60 * 1000, // 30 min ago (in cooldown)
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toMatch(/Please wait \d+ minutes? before syncing again/);
      expect(result.details?.cooldownMs).toBeGreaterThan(0);
    });

    it("handles rate_limited and updates installation status", async () => {
      const resetTime = NOW + 60 * 60 * 1000;
      const installation = buildInstallation({
        rateLimitRemaining: 50, // Below minimum
        rateLimitReset: resetTime,
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("GitHub API rate limit reached. Please try again later.");
      expect(result.details?.blockedUntil).toBe(resetTime);

      // Should update installation status
      expect(runMutation).toHaveBeenCalledWith(
        "internal.installations.updateSyncStatus",
        expect.objectContaining({
          installationId: 12345,
          syncStatus: "rate_limited",
          nextSyncAt: resetTime,
        })
      );
    });

    it("handles already_syncing for manual trigger", async () => {
      const installation = buildInstallation({
        syncStatus: "syncing",
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null); // no active job in DB
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("Sync already in progress");
    });
  });

  describe("when sync starts successfully", () => {
    it("updates status to syncing and enqueues backfill", async () => {
      const installation = buildInstallation();

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "cron",
      });

      expect(result.started).toBe(true);
      expect(result.message).toBe("Sync started");

      // Should update status to syncing
      expect(runMutation).toHaveBeenCalledWith(
        "internal.installations.updateSyncStatus",
        expect.objectContaining({
          installationId: 12345,
          syncStatus: "syncing",
        })
      );

      // Should call adminStartBackfill
      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.github.startBackfill.adminStartBackfill",
        expect.objectContaining({
          installationId: 12345,
          clerkUserId: "user_123",
          repositories: ["owner/repo1", "owner/repo2"],
        })
      );
    });

    it("sets lastManualSyncAt for manual trigger", async () => {
      const installation = buildInstallation();

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      // Should include lastManualSyncAt in status update
      expect(runMutation).toHaveBeenCalledWith(
        "internal.installations.updateSyncStatus",
        expect.objectContaining({
          lastManualSyncAt: NOW,
        })
      );
    });

    it("does not set lastManualSyncAt for cron trigger", async () => {
      const installation = buildInstallation();

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      await request(ctx as any, {
        installationId: 12345,
        trigger: "cron",
      });

      // The status update should NOT include lastManualSyncAt
      const statusUpdateCall = runMutation.mock.calls[0];
      const statusUpdateArgs = statusUpdateCall[1];

      expect(statusUpdateArgs.lastManualSyncAt).toBeUndefined();
    });

    it("uses custom since/until when provided", async () => {
      const installation = buildInstallation();
      const customSince = NOW - 7 * 24 * 60 * 60 * 1000;
      const customUntil = NOW - 1 * 24 * 60 * 60 * 1000;

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
        since: customSince,
        until: customUntil,
      });

      // Should pass custom timestamps to backfill
      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.github.startBackfill.adminStartBackfill",
        expect.objectContaining({
          since: customSince,
          until: customUntil,
        })
      );
    });
  });

  describe("when backfill fails to start", () => {
    it("updates status to error and returns failure", async () => {
      const installation = buildInstallation();
      const error = new Error("GitHub API unavailable");

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockRejectedValue(error);

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "manual",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("Sync failed to start. Please try again.");

      // First call sets syncing, second call sets error
      expect(runMutation).toHaveBeenCalledTimes(2);
      expect(runMutation).toHaveBeenLastCalledWith(
        "internal.installations.updateSyncStatus",
        expect.objectContaining({
          syncStatus: "error",
          lastSyncError: "GitHub API unavailable",
        })
      );
    });
  });

  describe("trigger-specific behavior", () => {
    it("allows cron trigger even when syncStatus is syncing", async () => {
      // Policy allows this because cron should be able to queue
      // But the orchestrator checks for active jobs first
      const installation = buildInstallation({
        syncStatus: "syncing", // Policy allows cron here
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null); // No actual active job in DB
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "cron",
      });

      // Should start because policy allows cron and no active job
      expect(result.started).toBe(true);
    });

    it("respects webhook reserve budget for cron", async () => {
      const installation = buildInstallation({
        rateLimitRemaining: 500, // Enough for manual (100) but not cron (600)
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "cron",
      });

      expect(result.started).toBe(false);
      expect(result.message).toBe("GitHub API rate limit reached. Please try again later.");
    });

    it("does not require webhook reserve for webhook trigger", async () => {
      const installation = buildInstallation({
        rateLimitRemaining: 150, // Enough for webhook (100) but not cron (600)
      });

      const runQuery = createAsyncMock();
      runQuery
        .mockResolvedValueOnce(installation)
        .mockResolvedValueOnce(null);
      const runMutation = createAsyncMock();
      const runAction = createAsyncMock();
      runAction.mockResolvedValue({ ok: true, jobs: [] });

      const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

      const result = await request(ctx as any, {
        installationId: 12345,
        trigger: "webhook",
      });

      expect(result.started).toBe(true);
    });
  });
});
