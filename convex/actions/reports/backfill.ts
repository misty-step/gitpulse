"use node";

/**
 * Backfill Reports Action
 *
 * Syncs events for the past 7 days and generates daily reports
 * for each day that has events (skipping days with existing reports).
 */

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import { generateReport } from "../../lib/generateReport";
import {
  getDayWindow,
  getTimezoneOrDefault,
  formatShortDate,
} from "../../lib/timeWindows";
import { logger } from "../../lib/logger";

export interface BackfillResult {
  success: boolean;
  reportsGenerated: number;
  daysSkipped: number;
  daysWithoutEvents: number;
  error?: string;
}

/**
 * Backfill last 7 days of reports.
 *
 * 1. Syncs events for the past 7 days
 * 2. For each day (1-7 days ago), generates a report if:
 *    - No report exists for that day
 *    - Events exist for that day
 */
export const backfillLastWeek = action({
  args: {},
  handler: async (ctx): Promise<BackfillResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        success: false,
        reportsGenerated: 0,
        daysSkipped: 0,
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
        reportsGenerated: 0,
        daysSkipped: 0,
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
        reportsGenerated: 0,
        daysSkipped: 0,
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
      "Starting backfill: syncing last 7 days"
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

    // Wait for sync to complete before generating reports
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

    // 4. Generate reports for each of the past 7 days
    let reportsGenerated = 0;
    let daysSkipped = 0;
    let daysWithoutEvents = 0;

    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
      const window = getDayWindow(timezone, daysAgo);
      const dateLabel = formatShortDate(window.start, timezone);

      // Check if report already exists for this day
      const existingReports = await ctx.runQuery(api.reports.listByWindow, {
        userId,
        startDate: window.start,
        endDate: window.end,
        scheduleType: "daily",
        limit: 1,
      });

      if (existingReports.length > 0) {
        logger.info({ dateLabel, daysAgo }, "Skipping day - report already exists");
        daysSkipped++;
        continue;
      }

      // Generate report for this day
      try {
        const result = await generateReport(ctx, {
          userId,
          startDate: window.start,
          endDate: window.end,
          kind: "daily",
        });

        if (result.success) {
          logger.info({ dateLabel, daysAgo, reportId: result.reportId }, "Generated report");
          reportsGenerated++;
        } else if (result.error?.includes("No events")) {
          logger.info({ dateLabel, daysAgo }, "No events for day");
          daysWithoutEvents++;
        } else {
          logger.warn({ dateLabel, daysAgo, error: result.error }, "Failed to generate report");
        }
      } catch (error) {
        logger.error(
          { dateLabel, daysAgo, error: error instanceof Error ? error.message : String(error) },
          "Error generating report"
        );
      }
    }

    logger.info(
      { userId, reportsGenerated, daysSkipped, daysWithoutEvents },
      "Backfill complete"
    );

    return {
      success: true,
      reportsGenerated,
      daysSkipped,
      daysWithoutEvents,
    };
  },
});
