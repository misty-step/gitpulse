"use node";

/**
 * Daily Reports Cron Runner
 *
 * Called by Convex cron jobs every hour (24 jobs total).
 * Each job passes its UTC hour, queries users with matching reportHourUTC,
 * and generates daily standup reports for all of them.
 *
 * Design per ultrathink:
 * - No iteration through all users - indexed query for efficiency
 * - No runtime timezone math - hours pre-calculated at settings save
 * - Separate cron jobs (not one job checking all hours)
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { logger } from "../lib/logger.js";

export const run = internalAction({
  args: {
    hourUTC: v.number(), // UTC hour (0-23)
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    logger.info({ hourUTC: args.hourUTC }, "Starting daily reports");

    // Query users who want daily reports at this UTC hour
    const users: Array<{ clerkId?: string; githubUsername?: string }> =
      await ctx.runQuery(internal.users.getUsersByReportHour, {
        reportHourUTC: args.hourUTC,
        dailyEnabled: true,
      });

    if (users.length === 0) {
      logger.info(
        { hourUTC: args.hourUTC },
        "No users scheduled for daily reports",
      );
      await ctx.runMutation(internal.reportJobHistory.logRun, {
        type: "daily",
        hourUTC: args.hourUTC,
        dayUTC: undefined,
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
      { userCount: users.length, hourUTC: args.hourUTC },
      "Found users for daily reports",
    );

    let reportsGenerated = 0;
    let errors = 0;

    // Generate report for each user
    for (const user of users) {
      try {
        logger.info(
          { userId: user.clerkId, githubUsername: user.githubUsername },
          "Generating daily report for user",
        );

        await ctx.runAction(
          internal.actions.generateScheduledReport.generateDailyReport,
          {
            userId: user.clerkId!,
          },
        );

        reportsGenerated++;
      } catch (error) {
        logger.error(
          { err: error, userId: user.clerkId },
          "Error generating daily report for user",
        );
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        hourUTC: args.hourUTC,
        reportsGenerated,
        errors,
        durationMs: duration,
      },
      "Completed daily reports",
    );

    await ctx.runMutation(internal.reportJobHistory.logRun, {
      type: "daily",
      hourUTC: args.hourUTC,
      dayUTC: undefined,
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
