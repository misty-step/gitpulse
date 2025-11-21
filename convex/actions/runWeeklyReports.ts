"use node";

/**
 * Weekly Reports Cron Runner
 *
 * Called by Convex cron jobs once per week (168 jobs total, 7 days × 24 hours).
 * Each job passes its UTC day/hour, queries users with matching weeklyDayUTC + reportHourUTC,
 * and generates weekly retro reports for all of them.
 *
 * Design per ultrathink:
 * - No iteration through all users - indexed query for efficiency
 * - No runtime timezone math - day/hour pre-calculated at settings save
 * - Separate cron jobs (not one job checking all combinations)
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { logger } from "../lib/logger.js";

export const run = internalAction({
  args: {
    dayUTC: v.number(), // UTC day of week (0=Sunday, 6=Saturday)
    hourUTC: v.number(), // UTC hour (0-23)
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
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

    // Query users who want weekly reports at this day/hour
    const users: Array<{ clerkId?: string; githubUsername?: string }> =
      await ctx.runQuery(internal.users.getUsersByWeeklySchedule, {
        weeklyDayUTC: args.dayUTC,
        reportHourUTC: args.hourUTC,
        weeklyEnabled: true,
      });

    if (users.length === 0) {
      logger.info(
        { dayName, hourUTC: args.hourUTC },
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
      { userCount: users.length, dayName, hourUTC: args.hourUTC },
      "Found users for weekly reports",
    );

    let reportsGenerated = 0;
    let errors = 0;

    // Generate report for each user
    for (const user of users) {
      try {
        logger.info(
          { userId: user.clerkId, githubUsername: user.githubUsername },
          "Generating weekly report for user",
        );

        await ctx.runAction(
          internal.actions.generateScheduledReport.generateWeeklyReport,
          {
            userId: user.clerkId!,
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
      usersAttempted: users.length,
      reportsGenerated,
      errors,
      durationMs: duration,
      startedAt: startTime,
      completedAt: Date.now(),
    });

    return {
      usersProcessed: users.length,
      reportsGenerated,
      errors,
      durationMs: duration,
    };
  },
});
