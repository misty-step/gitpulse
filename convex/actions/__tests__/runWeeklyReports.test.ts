/**
 * Tests for Weekly Reports Cron Runner
 *
 * Tests the new midnightUtcHour + isLocalSunday filtering behavior.
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({
  internal: {
    users: {
      getUsersByMidnightHour: "internal.users.getUsersByMidnightHour",
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

// Mock timeWindows - we control isLocalSunday to test filtering logic
jest.mock("../../lib/timeWindows.js", () => ({
  isLocalSunday: jest.fn(),
  getTimezoneOrDefault: jest.fn((tz) => tz ?? "UTC"),
}));

// Import after mocks

const { run } = require("../runWeeklyReports");
import { logger } from "../../lib/logger.js";
import { isLocalSunday } from "../../lib/timeWindows.js";

const mockedIsLocalSunday = isLocalSunday as jest.MockedFunction<
  typeof isLocalSunday
>;

describe("runWeeklyReports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all users are on Sunday (tests can override)
    mockedIsLocalSunday.mockReturnValue(true);
  });

  const mockUser = {
    clerkId: "clerk_123",
    githubUsername: "octocat",
    timezone: "America/Chicago",
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

    it("queries users with midnightUtcHour", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      await run.handler(ctx, { dayUTC: 5, hourUTC: 14 });

      expect(runQuery).toHaveBeenCalledWith(
        "internal.users.getUsersByMidnightHour",
        {
          midnightUtcHour: 14,
          weeklyEnabled: true,
        },
      );
    });

    it("generates reports for multiple users", async () => {
      const user2 = { clerkId: "clerk_456", githubUsername: "alice", timezone: "America/New_York" };
      const runQuery = createAsyncMock().mockResolvedValue([mockUser, user2]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      const result = await run.handler(ctx, { dayUTC: 0, hourUTC: 10 });

      expect(result.usersProcessed).toBe(2);
      expect(result.reportsGenerated).toBe(2);
      expect(runAction).toHaveBeenCalledTimes(2);
      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateWeeklyReport",
        { userId: "clerk_123", timezone: "America/Chicago" },
      );
      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateWeeklyReport",
        { userId: "clerk_456", timezone: "America/New_York" },
      );
    });

    it("calls generateWeeklyReport for each user with timezone", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateWeeklyReport",
        { userId: "clerk_123", timezone: "America/Chicago" },
      );
    });
  });

  describe("no users scheduled", () => {
    it("returns early when no users found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      const result = await run.handler(ctx, { dayUTC: 6, hourUTC: 3 });

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

  describe("Sunday filtering", () => {
    it("filters out users where it's not Sunday in their timezone", async () => {
      const sundayUser = { clerkId: "clerk_123", githubUsername: "octocat", timezone: "UTC" };
      const nonSundayUser = { clerkId: "clerk_456", githubUsername: "alice", timezone: "Pacific/Auckland" };

      const runQuery = createAsyncMock().mockResolvedValue([sundayUser, nonSundayUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      // Sunday for first user, not Sunday for second
      mockedIsLocalSunday
        .mockReturnValueOnce(true)  // sundayUser
        .mockReturnValueOnce(false); // nonSundayUser

      const result = await run.handler(ctx, { dayUTC: 0, hourUTC: 6 });

      expect(result.usersProcessed).toBe(1);
      expect(result.reportsGenerated).toBe(1);
      expect(runAction).toHaveBeenCalledTimes(1);
      expect(runAction).toHaveBeenCalledWith(
        "internal.actions.generateScheduledReport.generateWeeklyReport",
        { userId: "clerk_123", timezone: "UTC" },
      );
    });

    it("returns zero users when none are on Sunday", async () => {
      const user1 = { clerkId: "clerk_123", githubUsername: "octocat", timezone: "UTC" };
      const user2 = { clerkId: "clerk_456", githubUsername: "alice", timezone: "America/Chicago" };

      const runQuery = createAsyncMock().mockResolvedValue([user1, user2]);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runMutation });

      // Neither user is on Sunday
      mockedIsLocalSunday.mockReturnValue(false);

      const result = await run.handler(ctx, { dayUTC: 1, hourUTC: 6 });

      expect(result.usersProcessed).toBe(0);
      expect(result.reportsGenerated).toBe(0);
    });

    it("records usersAttempted as eligible count, not queried count", async () => {
      const user1 = { clerkId: "clerk_123", githubUsername: "octocat", timezone: "UTC" };
      const user2 = { clerkId: "clerk_456", githubUsername: "alice", timezone: "America/Chicago" };
      const user3 = { clerkId: "clerk_789", githubUsername: "bob", timezone: "Asia/Tokyo" };

      const runQuery = createAsyncMock().mockResolvedValue([user1, user2, user3]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      // Only user1 is on Sunday
      mockedIsLocalSunday
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      await run.handler(ctx, { dayUTC: 0, hourUTC: 6 });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.reportJobHistory.logRun",
        expect.objectContaining({
          usersAttempted: 1, // Only 1 eligible, not 3 queried
          reportsGenerated: 1,
        }),
      );
    });
  });

  describe("error handling", () => {
    it("continues processing when one user fails", async () => {
      const user2 = { clerkId: "clerk_456", githubUsername: "alice", timezone: "America/New_York" };
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
        { dayName: "Friday", hourUTC: 3, queriedCount: 0 },
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
        { userCount: 1, dayName: "Monday", hourUTC: 9, queriedCount: 1 },
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

    it("logs each user report generation with timezone", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockUser]);
      const runAction = createAsyncMock().mockResolvedValue(undefined);
      const runMutation = createAsyncMock().mockResolvedValue(undefined);
      const ctx = createMockActionCtx({ runQuery, runAction, runMutation });

      await run.handler(ctx, { dayUTC: 1, hourUTC: 9 });

      expect(logger.info).toHaveBeenCalledWith(
        { userId: "clerk_123", githubUsername: "octocat", timezone: "America/Chicago" },
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
