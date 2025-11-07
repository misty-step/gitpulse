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

export const run = internalAction({
  args: {
    hourUTC: v.number(), // UTC hour (0-23)
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    console.log(`[Daily Reports] Starting for UTC hour ${args.hourUTC}`);

    // Query users who want daily reports at this UTC hour
    const users: Array<{ clerkId?: string; githubUsername?: string }> = await ctx.runQuery(internal.users.getUsersByReportHour, {
      reportHourUTC: args.hourUTC,
      dailyEnabled: true,
    });

    if (users.length === 0) {
      console.log(`[Daily Reports] No users scheduled for UTC hour ${args.hourUTC}`);
      return { usersProcessed: 0, reportsGenerated: 0, errors: 0, durationMs: 0 };
    }

    console.log(
      `[Daily Reports] Found ${users.length} users for UTC hour ${args.hourUTC}`
    );

    let reportsGenerated = 0;
    let errors = 0;

    // Generate report for each user
    for (const user of users) {
      try {
        console.log(
          `[Daily Reports] Generating for user ${user.clerkId} (@${user.githubUsername})`
        );

        await ctx.runAction(internal.actions.generateScheduledReport.generateDailyReport, {
          userId: user.clerkId!,
        });

        reportsGenerated++;
      } catch (error) {
        console.error(
          `[Daily Reports] Error for user ${user.clerkId}:`,
          error instanceof Error ? error.message : error
        );
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Daily Reports] Completed for UTC hour ${args.hourUTC}: ` +
        `${reportsGenerated} generated, ${errors} errors, ${duration}ms`
    );

    return {
      usersProcessed: users.length,
      reportsGenerated,
      errors,
      durationMs: duration,
    };
  },
});
