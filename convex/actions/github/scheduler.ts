"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";

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
  handler: async (ctx) => {
    const batchSize = 10;

    // Fetch pending webhooks
    const pending = await ctx.runQuery(internal.webhookEvents.listPending, {
      limit: batchSize,
    });

    if (pending.length === 0) {
      return { processed: 0 };
    }

    console.log(`Processing ${pending.length} pending webhooks`);

    // Process each webhook
    for (const webhookEvent of pending) {
      await ctx.scheduler.runAfter(0, internal.actions.github.processWebhook.processWebhook, {
        webhookEventId: webhookEvent._id,
      });
    }

    return { processed: pending.length };
  },
});
