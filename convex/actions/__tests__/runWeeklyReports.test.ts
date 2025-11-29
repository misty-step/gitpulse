/**
 * Tests for Weekly Reports Cron Runner
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({
  internal: {
    users: {
      getUsersByWeeklySchedule: "internal.users.getUsersByWeeklySchedule",
    },
    reportJobHistory: {
      logRun: "internal.reportJobHistory.logRun",
    },
    actions: {
      generateScheduledReport: {
        generateWeeklyReport: "internal.actions.generateScheduledReport.generateWeeklyReport",
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
 
const { run } = require("../runWeeklyReports");
import { logger } from "../../lib/logger.js";

describe("runWeeklyReports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    clerkId: "clerk_123",
    githubUsername: "octocat",
  };

  describe("successful execution", () => {
    it("processes users scheduled for the given day and hour", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { dayUTC: 1, hourUTC: 9 }); // Monday 9am

      expect(result.usersProcessed).toBe(1);
      expect(result.reportsGenerated).toBe(1);
      expect(result.errors).toBe(0);
    });

    it("queries users with correct parameters", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { dayUTC: 5, hourUTC: 14 }); // Friday 2pm

      expect(runQuery).toHaveBeenCalledWith(
        "internal.users.getUsersByWeeklySchedule",
        {
          weeklyDayUTC: 5,
          reportHourUTC: 14,
          weeklyEnabled: true,
        },
      );
    });

    it("generates reports for multiple users", async () => {
      const user2 = { clerkId: "clerk_456", githubUsername: "alice" };
      const runQuery = createAsyncMock().mockResolvedValue([mockUser, user2]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { dayUTC: 0, hourUTC: 10 }); // Sunday 10am

      expect(result.usersProcessed).toBe(2);
      expect(result.reportsGenerated).toBe(2);
      expect(runAction).toHaveBeenCalledTimes(2);
    });

    it("calls generateWeeklyReport for each user", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateWeeklyReport",
        { userId: "clerk_123" },
      );
    });
  });

  describe("no users scheduled", () => {
    it("returns early when no users found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      const result = await run.handler(ctx, { dayUTC: 6, hourUTC: 3 }); // Saturday 3am

      expect(result.usersProcessed).toBe(0);
      expect(result.reportsGenerated).toBe(0);
      expect(result.errors).toBe(0);
    });

    it("logs job history when no users scheduled", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { dayUTC: 6, hourUTC: 3 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "weekly",
          hourUTC: 3,
          dayUTC: 6,
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

      const result = await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

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

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "clerk_123",
        }),
        "Error generating weekly report for user",
      );
    });

    it("records errors in job history", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockRejectedValue(
        new Error("Report generation failed"),
      );
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "weekly",
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

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          type: "weekly",
          hourUTC: 9,
          dayUTC: 1,
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

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

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

  describe("day name mapping", () => {
    const dayTests = [
      { dayUTC: 0, dayName: "Sunday" },
      { dayUTC: 1, dayName: "Monday" },
      { dayUTC: 2, dayName: "Tuesday" },
      { dayUTC: 3, dayName: "Wednesday" },
      { dayUTC: 4, dayName: "Thursday" },
      { dayUTC: 5, dayName: "Friday" },
      { dayUTC: 6, dayName: "Saturday" },
    ];

    dayTests.forEach(({ dayUTC, dayName }) => {
      it(`logs correct day name for ${dayName} (dayUTC: ${dayUTC})`, async () => {
        const runQuery = createAsyncMock().mockResolvedValue([]);
        const runMutation = createAsyncMock().mockResolvedValue(undefined);
        const ctx = createMockActionCtx({ runQuery, runMutation });

        await run.handler(ctx, { dayUTC, hourUTC: 9 });

        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            dayUTC,
            dayName,
          }),
          "Starting weekly reports",
        );
      });
    });
  });

  describe("logging", () => {
    it("logs start of weekly reports", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 12 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          dayUTC: 1,
          hourUTC: 12,
          dayName: "Monday",
        }),
        "Starting weekly reports",
      );
    });

    it("logs when no users scheduled", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { dayUTC: 5, hourUTC: 3 });

      expect(logger.info).toHaveBeenCalledWith(
        { dayName: "Friday", hourUTC: 3 },
        "No users scheduled for weekly reports",
      );
    });

    it("logs user count when users found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        { userCount: 1, dayName: "Monday", hourUTC: 9 },
        "Found users for weekly reports",
      );
    });

    it("logs completion with stats", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          dayName: "Monday",
          hourUTC: 9,
          reportsGenerated: 1,
          errors: 0,
          durationMs: expect.any(Number),
        }),
        "Completed weekly reports",
      );
    });

    it("logs each user report generation", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        { userId: "clerk_123", githubUsername: "octocat" },
        "Generating weekly report for user",
      );
    });
  });

  describe("return value", () => {
    it("returns correct stats on success", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

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

      const result = await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
