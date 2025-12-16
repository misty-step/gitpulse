"use node";

/**
 * Weekly Reports Cron Runner
 *
 * Called by Convex cron jobs (168 jobs total, 7 days × 24 hours).
 * Each job passes its UTC day/hour, queries users whose local midnight maps to hourUTC,
 * filters for users where it's actually Sunday in their timezone, and generates reports.
 *
 * Design:
 * - Queries by midnightUtcHour (when user's midnight occurs in UTC)
 * - Filters by isLocalSunday() to only run on user's local Sunday
 * - Uses timeWindows module for all timezone logic
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { logger } from "../lib/logger.js";
import { isLocalSunday, getTimezoneOrDefault } from "../lib/timeWindows.js";

export const run = internalAction({
  args: {
    dayUTC: v.number(), // UTC day of week (0=Sunday, 6=Saturday) - for logging/history only
    hourUTC: v.number(), // UTC hour (0-23) - used as midnightUtcHour
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const now = Date.now();
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayName = dayNames[args.dayUTC];

    logger.info(
      { dayUTC: args.dayUTC, hourUTC: args.hourUTC, dayName },
      "Starting weekly reports",
    );

    // Query users whose local midnight maps to this UTC hour
    const users: Array<{
      clerkId?: string;
      githubUsername?: string;
      timezone?: string;
    }> = await ctx.runQuery(internal.users.getUsersByMidnightHour, {
      midnightUtcHour: args.hourUTC,
      weeklyEnabled: true,
    });

    // Filter to only users where it's currently Sunday in their timezone
    const eligible = users.filter((u) =>
      isLocalSunday(now, getTimezoneOrDefault(u.timezone))
    );

    if (eligible.length === 0) {
      logger.info(
        { dayName, hourUTC: args.hourUTC, queriedCount: users.length },
        "No users scheduled for weekly reports",
      );
      await ctx.runMutation(internal.reportJobHistory.logRun, {
        type: "weekly",
        hourUTC: args.hourUTC,
        dayUTC: args.dayUTC,
        usersAttempted: 0,
        reportsGenerated: 0,
        errors: 0,
        durationMs: Date.now() - startTime,
        startedAt: startTime,
        completedAt: Date.now(),
      });
      return {
        usersProcessed: 0,
        reportsGenerated: 0,
        errors: 0,
        durationMs: 0,
      };
    }

    logger.info(
      { userCount: eligible.length, dayName, hourUTC: args.hourUTC, queriedCount: users.length },
      "Found users for weekly reports",
    );

    let reportsGenerated = 0;
    let errors = 0;

    // Generate report for each eligible user
    for (const user of eligible) {
      try {
        logger.info(
          {
            userId: user.clerkId,
            githubUsername: user.githubUsername,
            timezone: user.timezone,
          },
          "Generating weekly report for user",
        );

        await ctx.runAction(
          internal.actions.generateScheduledReport.generateWeeklyReport,
          {
            userId: user.clerkId!,
            timezone: user.timezone, // Pass timezone to avoid redundant lookup
          },
        );

        reportsGenerated++;
      } catch (error) {
        logger.error(
          { err: error, userId: user.clerkId },
          "Error generating weekly report for user",
        );
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        dayName,
        hourUTC: args.hourUTC,
        reportsGenerated,
        errors,
        durationMs: duration,
      },
      "Completed weekly reports",
    );

    await ctx.runMutation(internal.reportJobHistory.logRun, {
      type: "weekly",
      hourUTC: args.hourUTC,
      dayUTC: args.dayUTC,
      usersAttempted: eligible.length,
      reportsGenerated,
      errors,
      durationMs: duration,
      startedAt: startTime,
      completedAt: Date.now(),
    });

    return {
      usersProcessed: eligible.length,
      reportsGenerated,
      errors,
      durationMs: duration,
    };
  },
});
