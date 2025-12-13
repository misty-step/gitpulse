"use node";

/**
 * Scheduled Report Generation
 *
 * Generates automated daily standup and weekly retro reports.
 * Called by cron jobs at user's local midnight.
 *
 * KEY FIX (Phase 4): Uses timeWindows module for correct timezone-aware boundaries.
 * Previous bug: Used UTC midnight, not user's local midnight (6-hour misalignment).
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { generateReport } from "../lib/generateReport";
import {
  getYesterdayWindow,
  getLastWeekWindow,
  getTimezoneOrDefault,
} from "../lib/timeWindows";
import { logger } from "../lib/logger.js";

/**
 * Generate yesterday's daily standup report.
 *
 * Called by cron job at user's local midnight - generates report for "yesterday" in their timezone.
 * Uses getYesterdayWindow() for correct timezone-aware boundaries.
 */
export const generateDailyReport = internalAction({
  args: {
    userId: v.string(),
    timezone: v.optional(v.string()), // Optionally pass timezone directly
  },
  handler: async (ctx, args) => {
    // Get user's timezone (fallback to UTC if not set)
    let timezone = args.timezone;
    if (!timezone) {
      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: args.userId,
      });
      timezone = getTimezoneOrDefault(user?.timezone);
    }

    // Calculate yesterday's window in user's timezone
    const window = getYesterdayWindow(timezone);

    logger.info(
      {
        userId: args.userId,
        timezone,
        windowStart: new Date(window.start).toISOString(),
        windowEnd: new Date(window.end).toISOString(),
      },
      "Generating daily report with timezone-aware window"
    );

    const result = await generateReport(ctx, {
      userId: args.userId,
      startDate: window.start,
      endDate: window.end,
      kind: "daily",
      timezone,
    });

    if (result.success) {
      logger.info(
        { userId: args.userId, reportId: result.reportId, timezone },
        "Generated scheduled daily report"
      );
    } else {
      logger.info(
        { userId: args.userId, error: result.error },
        "Skipped daily report generation"
      );
    }

    return result;
  },
});

/**
 * Generate last week's weekly retro report.
 *
 * Called by cron job at user's local Sunday midnight.
 * Uses getLastWeekWindow() for correct Sunday-to-Sunday boundaries in their timezone.
 */
export const generateWeeklyReport = internalAction({
  args: {
    userId: v.string(),
    timezone: v.optional(v.string()), // Optionally pass timezone directly
  },
  handler: async (ctx, args) => {
    // Get user's timezone (fallback to UTC if not set)
    let timezone = args.timezone;
    if (!timezone) {
      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: args.userId,
      });
      timezone = getTimezoneOrDefault(user?.timezone);
    }

    // Calculate last week's window in user's timezone (Sunday to Sunday)
    const window = getLastWeekWindow(timezone);

    logger.info(
      {
        userId: args.userId,
        timezone,
        windowStart: new Date(window.start).toISOString(),
        windowEnd: new Date(window.end).toISOString(),
      },
      "Generating weekly report with timezone-aware window"
    );

    const result = await generateReport(ctx, {
      userId: args.userId,
      startDate: window.start,
      endDate: window.end,
      kind: "weekly",
      timezone,
    });

    if (result.success) {
      logger.info(
        { userId: args.userId, reportId: result.reportId, timezone },
        "Generated scheduled weekly report"
      );
    } else {
      logger.info(
        { userId: args.userId, error: result.error },
        "Skipped weekly report generation"
      );
    }

    return result;
  },
});
