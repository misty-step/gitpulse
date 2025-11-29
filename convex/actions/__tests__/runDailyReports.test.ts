/**
 * Tests for Daily Reports Cron Runner
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({
  internal: {
    users: {
      getUsersByReportHour: "internal.users.getUsersByReportHour",
    },
    reportJobHistory: {
      logRun: "internal.reportJobHistory.logRun",
    },
    actions: {
      generateScheduledReport: {
        generateDailyReport: "internal.actions.generateScheduledReport.generateDailyReport",
      },
    },
  },
}));

// Mock logger
jest.mock("../../lib/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks
 
const { run } = require("../runDailyReports");
import { logger } from "../../lib/logger.js";

describe("runDailyReports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    clerkId: "clerk_123",
    githubUsername: "octocat",
  };

  describe("successful execution", () => {
    it("processes users scheduled for the given hour", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { hourUTC: 9 });

      expect(result.usersProcessed).toBe(1);
      expect(result.reportsGenerated).toBe(1);
      expect(result.errors).toBe(0);
    });

    it("queries users with correct parameters", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { hourUTC: 14 });

      expect(runQuery).toHaveBeenCalledWith(
        "internal.users.getUsersByReportHour",
        {
          reportHourUTC: 14,
          dailyEnabled: true,
        },
      );
    });

    it("generates reports for multiple users", async () => {
      const user2 = { clerkId: "clerk_456", githubUsername: "alice" };
      const runQuery = createAsyncMock().mockResolvedValue([mockUser, user2]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { hourUTC: 9 });

      expect(result.usersProcessed).toBe(2);
      expect(result.reportsGenerated).toBe(2);
      expect(runAction).toHaveBeenCalledTimes(2);
    });

    it("calls generateDailyReport for each user", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateDailyReport",
        { userId: "clerk_123" },
      );
    });
  });

  describe("no users scheduled", () => {
    it("returns early when no users found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      const result = await run.handler(ctx, { hourUTC: 3 });

      expect(result.usersProcessed).toBe(0);
      expect(result.reportsGenerated).toBe(0);
      expect(result.errors).toBe(0);
    });

    it("logs job history when no users scheduled", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { hourUTC: 3 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "daily",
          hourUTC: 3,
          usersAttempted: 0,
          reportsGenerated: 0,
          errors: 0,
        }),
      );
    });
  });

  describe("error handling", () => {
    it("continues processing when one user fails", async () => {
      const user2 = { clerkId: "clerk_456", githubUsername: "alice" };
      const runQuery = createAsyncMock().mockResolvedValue([mockUser, user2]);
      const runAction = createAsyncMock()
        .mockRejectedValueOnce(new Error("Report generation failed"))
        .mockResolvedValueOnce(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { hourUTC: 9 });

      expect(result.usersProcessed).toBe(2);
      expect(result.reportsGenerated).toBe(1);
      expect(result.errors).toBe(1);
    });

    it("logs errors for failed reports", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockRejectedValue(
        new Error("Report generation failed"),
      );
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "clerk_123",
        }),
        "Error generating daily report for user",
      );
    });

    it("records errors in job history", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockRejectedValue(
        new Error("Report generation failed"),
      );
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "daily",
          usersAttempted: 1,
          reportsGenerated: 0,
          errors: 1,
        }),
      );
    });
  });

  describe("job history logging", () => {
    it("logs job history with correct stats after success", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "daily",
          hourUTC: 9,
          dayUTC: undefined,
          usersAttempted: 1,
          reportsGenerated: 1,
          errors: 0,
        }),
      );
    });

    it("includes duration in job history", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          durationMs: expect.any(Number),
          startedAt: expect.any(Number),
          completedAt: expect.any(Number),
        }),
      );
    });
  });

  describe("logging", () => {
    it("logs start of daily reports", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { hourUTC: 12 });

      expect(logger.info).toHaveBeenCalledWith(
        { hourUTC: 12 },
        "Starting daily reports",
      );
    });

    it("logs when no users scheduled", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { hourUTC: 3 });

      expect(logger.info).toHaveBeenCalledWith(
        { hourUTC: 3 },
        "No users scheduled for daily reports",
      );
    });

    it("logs user count when users found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        { userCount: 1, hourUTC: 9 },
        "Found users for daily reports",
      );
    });

    it("logs completion with stats", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          hourUTC: 9,
          reportsGenerated: 1,
          errors: 0,
          durationMs: expect.any(Number),
        }),
        "Completed daily reports",
      );
    });

    it("logs each user report generation", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        { userId: "clerk_123", githubUsername: "octocat" },
        "Generating daily report for user",
      );
    });
  });

  describe("return value", () => {
    it("returns correct stats on success", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { hourUTC: 9 });

      expect(result).toEqual({
        usersProcessed: 1,
        reportsGenerated: 1,
        errors: 0,
        durationMs: expect.any(Number),
      });
    });

    it("returns duration in milliseconds", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { hourUTC: 9 });

      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
