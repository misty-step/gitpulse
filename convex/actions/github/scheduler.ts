"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger.js";

/**
 * Process pending webhook events in batches
 *
 * This action is intended to be called by a cron job to handle
 * any webhooks that weren't immediately processed or failed and need retry.
 *
 * High-priority queue: Process webhook events in order received.
 * DLQ handling: Failed events remain in "failed" status for manual review.
 */
export const processPendingWebhooks = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const batchSize = 10;

    // Fetch pending webhooks
    const pending = await ctx.runQuery(internal.webhookEvents.listPending, {
      limit: batchSize,
    });

    if (pending.length === 0) {
      return { processed: 0 };
    }

    logger.info({ count: pending.length }, "Processing pending webhooks");

    // Process each webhook
    for (const webhookEvent of pending) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.github.processWebhook.processWebhook,
        {
          webhookEventId: webhookEvent._id,
        },
      );
    }

    return { processed: pending.length };
  },
});

/**
 * Resume stuck blocked backfill jobs (safety net)
 *
 * This action catches any jobs where the scheduler failed to trigger the
 * continuation. Finds jobs with status "blocked" that are past their
 * blockedUntil time and resumes them.
 *
 * Should be run periodically (e.g., every 5 minutes) by a cron job.
 */
export const resumeStuckBackfills = internalAction({
  args: {},
  handler: async (ctx): Promise<{ resumed: number; failed: number }> => {
    // Find jobs that should have resumed but are still blocked
    const stuckJobs = await ctx.runQuery(
      internal.ingestionJobs.findStuckBlockedJobs,
      {},
    );

    if (stuckJobs.length === 0) {
      return { resumed: 0, failed: 0 };
    }

    logger.info(
      { count: stuckJobs.length },
      "Found stuck blocked jobs to resume",
    );

    let resumed = 0;
    let failed = 0;

    for (const job of stuckJobs) {
      try {
        // Schedule immediate continuation
        await ctx.scheduler.runAfter(
          0,
          internal.actions.github.startBackfill.continueBackfill,
          { jobId: job._id },
        );

        logger.info(
          {
            jobId: job._id,
            repoFullName: job.repoFullName,
            blockedUntil: job.blockedUntil
              ? new Date(job.blockedUntil).toISOString()
              : "unknown",
          },
          "Scheduled resume for stuck job",
        );

        resumed++;
      } catch (error) {
        logger.error(
          {
            err: error,
            jobId: job._id,
          },
          "Failed to schedule resume for job",
        );
        failed++;
      }
    }

    logger.info({ resumed, failed }, "Resume complete");

    return { resumed, failed };
  },
});
