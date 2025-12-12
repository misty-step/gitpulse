"use node";

/**
 * Regenerate Reports Action (Dev-Only Feature)
 *
 * DESTRUCTIVE: Deletes and regenerates ALL reports (daily + weekly) for past 7 days.
 * Used for debugging/testing report generation changes.
 *
 * Flow:
 * 1. Syncs events for past 7 days
 * 2. Deletes existing reports for those 7 days (daily + weekly)
 * 3. Regenerates all reports from scratch
 */

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import { generateReport } from "../../lib/generateReport";
import {
  getDayWindow,
  getLastWeekWindow,
  getTimezoneOrDefault,
  formatShortDate,
} from "../../lib/timeWindows";
import { logger } from "../../lib/logger";

export interface RegenerateResult {
  success: boolean;
  reportsDeleted: number;
  reportsGenerated: number;
  daysWithoutEvents: number;
  error?: string;
}

/**
 * Regenerate last 7 days of reports (destructive).
 *
 * 1. Syncs events for the past 7 days
 * 2. Deletes ALL existing reports for:
 *    - Each day (1-7 days ago) with scheduleType="daily"
 *    - Last week with scheduleType="weekly"
 * 3. Regenerates all reports from scratch
 */
export const regenerateLastWeek = action({
  args: {},
  handler: async (ctx): Promise<RegenerateResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        reportsDeleted: 0,
        reportsGenerated: 0,
        daysWithoutEvents: 0,
        error: "Authentication required",
      };
    }

    const userId = identity.subject;

    // 1. Get user and their timezone
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: userId });
    if (!user) {
      return {
        success: false,
        reportsDeleted: 0,
        reportsGenerated: 0,
        daysWithoutEvents: 0,
        error: "User not found",
      };
    }

    const timezone = getTimezoneOrDefault(user.timezone);

    // 2. Get user's installation for sync
    const installations = await ctx.runQuery(api.installations.listByClerkUser, {
      clerkUserId: userId,
    });

    if (!installations || installations.length === 0) {
      return {
        success: false,
        reportsDeleted: 0,
        reportsGenerated: 0,
        daysWithoutEvents: 0,
        error: "No GitHub installation found. Please connect GitHub first.",
      };
    }

    const installation = installations[0];

    // 3. Request sync for past 7 days
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const since = now - SEVEN_DAYS_MS;

    logger.info(
      { userId, installationId: installation.installationId, since: new Date(since).toISOString() },
      "Starting regeneration: syncing last 7 days"
    );

    const syncResult = await ctx.runAction(
      api.actions.sync.requestSync.requestManualSync,
      {
        installationId: installation.installationId,
        forceFullSync: true, // Ensure we fetch historical events (30 days, deduplicated)
      }
    );

    if (!syncResult.started) {
      // Sync may have been blocked (cooldown, rate limit, etc.)
      // Continue anyway - there might already be events from previous syncs
      logger.warn(
        { userId, syncMessage: syncResult.message },
        "Sync not started, continuing with existing events"
      );
    }

    // Wait for sync to complete before regenerating reports
    if (syncResult.started && syncResult.details?.jobId) {
      const batchId = syncResult.details.jobId as Id<"syncBatches">;
      const maxWaitMs = 120_000; // 2 minutes max
      const pollIntervalMs = 3_000; // Check every 3 seconds
      const startTime = Date.now();

      logger.info({ batchId }, "Waiting for sync to complete...");

      while (Date.now() - startTime < maxWaitMs) {
        const progress = await ctx.runQuery(api.syncBatches.getProgress, { batchId });
        if (!progress || progress.status === "completed" || progress.status === "failed") {
          logger.info(
            { batchId, status: progress?.status, eventsIngested: progress?.eventsIngested },
            "Sync finished"
          );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    // 4. Delete existing reports
    let reportsDeleted = 0;

    // Delete daily reports (1-7 days ago)
    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
      const window = getDayWindow(timezone, daysAgo);
      const dateLabel = formatShortDate(window.start, timezone);

      const existingReports = await ctx.runQuery(api.reports.listByWindow, {
        userId,
        startDate: window.start,
        endDate: window.end,
        scheduleType: "daily",
        limit: 100, // Get all versions
      });

      for (const report of existingReports) {
        await ctx.runMutation(internal.reports.deleteById, { id: report._id });
        reportsDeleted++;
      }

      if (existingReports.length > 0) {
        logger.info(
          { dateLabel, daysAgo, count: existingReports.length },
          "Deleted daily reports for day"
        );
      }
    }

    // Delete weekly report (last week)
    const weekWindow = getLastWeekWindow(timezone);
    const weeklyReports = await ctx.runQuery(api.reports.listByWindow, {
      userId,
      startDate: weekWindow.start,
      endDate: weekWindow.end,
      scheduleType: "weekly",
      limit: 100,
    });

    for (const report of weeklyReports) {
      await ctx.runMutation(internal.reports.deleteById, { id: report._id });
      reportsDeleted++;
    }

    if (weeklyReports.length > 0) {
      logger.info(
        { count: weeklyReports.length },
        "Deleted weekly reports"
      );
    }

    logger.info({ userId, reportsDeleted }, "Deleted existing reports for regeneration");

    // 5. Regenerate reports for each of the past 7 days
    let reportsGenerated = 0;
    let daysWithoutEvents = 0;

    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
      const window = getDayWindow(timezone, daysAgo);
      const dateLabel = formatShortDate(window.start, timezone);

      try {
        const result = await generateReport(ctx, {
          userId,
          startDate: window.start,
          endDate: window.end,
          kind: "daily",
          timezone,
        });

        if (result.success) {
          logger.info({ dateLabel, daysAgo, reportId: result.reportId }, "Generated daily report");
          reportsGenerated++;
        } else if (result.error?.includes("No commits")) {
          logger.info({ dateLabel, daysAgo }, "No commits for day");
          daysWithoutEvents++;
        } else {
          logger.warn({ dateLabel, daysAgo, error: result.error }, "Failed to generate daily report");
        }
      } catch (error) {
        logger.error(
          { dateLabel, daysAgo, error: error instanceof Error ? error.message : String(error) },
          "Error generating daily report"
        );
      }
    }

    // 6. Regenerate weekly report
    try {
      const weekResult = await generateReport(ctx, {
        userId,
        startDate: weekWindow.start,
        endDate: weekWindow.end,
        kind: "weekly",
        timezone,
      });

      if (weekResult.success) {
        logger.info({ reportId: weekResult.reportId }, "Generated weekly report");
        reportsGenerated++;
      } else if (weekResult.error?.includes("No commits")) {
        logger.info("No commits for week");
      } else {
        logger.warn({ error: weekResult.error }, "Failed to generate weekly report");
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error generating weekly report"
      );
    }

    logger.info(
      { userId, reportsDeleted, reportsGenerated, daysWithoutEvents },
      "Regeneration complete"
    );

    return {
      success: true,
      reportsDeleted,
      reportsGenerated,
      daysWithoutEvents,
    };
  },
});
