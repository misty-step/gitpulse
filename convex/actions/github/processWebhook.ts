"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";

/**
 * Process GitHub webhook event asynchronously
 *
 * Algorithm per DESIGN.md processWebhookJob:
 * 1. Load envelope, ensure idempotency via processedDeliveries set
 * 2. Switch on event type; map to canonical payload (PR, commit, review, issue, push forced flag)
 * 3. Call CanonicalFactService.upsertFromWebhook per derived facts
 * 4. If push event w/ forced==true, mark affected repo windows dirty (re-run coverage + cache invalidation)
 * 5. Ack job, delete envelope if retention window passed
 *
 * Error handling:
 * - Malformed payload → DLQ
 * - Missing actor/repo → DLQ after upsert attempts
 * - Schema violations → DLQ
 */
export const processWebhook = internalAction({
  args: {
    webhookEventId: v.id("webhookEvents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // Load webhook envelope
      const webhookEvent = await ctx.runQuery(
        internal.webhookEvents.getById,
        { id: args.webhookEventId }
      );

      if (!webhookEvent) {
        console.error("Webhook event not found", { webhookEventId: args.webhookEventId });
        return;
      }

      const { deliveryId, event, payload } = webhookEvent;

      // Update status to processing
      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "processing",
      });

      console.log("Processing webhook", { deliveryId, event });

      // Parse payload to detect event-specific data
      const webhookPayload = payload as {
        action?: string;
        forced?: boolean;
        repository?: { id: number; full_name: string; node_id: string };
        sender?: { id: number; login: string; node_id: string };
        installation?: { id: number };
      };

      // TODO: Implement canonical fact extraction (Phase 2)
      // For now, log the event type and structure
      console.log("Webhook payload structure", {
        event,
        action: webhookPayload.action,
        forced: webhookPayload.forced,
        hasRepository: !!webhookPayload.repository,
        hasSender: !!webhookPayload.sender,
        installationId: webhookPayload.installation?.id,
      });

      // TODO: Phase 2 - Call CanonicalFactService.upsertFromWebhook
      // This will:
      // - Normalize GitHub payload into EventFact
      // - Compute contentHash
      // - Upsert to events table (idempotent via contentHash)
      // - Enqueue embeddings for new hashes

      // TODO: Phase 2 - Handle push forced flag
      // If event === "push" && webhookPayload.forced === true:
      //   - Mark affected repo windows dirty
      //   - Invalidate cached reports

      // Mark as completed
      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "completed",
      });

      console.log("Webhook processed successfully", { deliveryId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error("Webhook processing failed", {
        webhookEventId: args.webhookEventId,
        error: errorMessage,
      });

      // Move to DLQ (dead-letter queue)
      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "failed",
        errorMessage,
        retryCount: 0, // TODO: Implement retry logic with exponential backoff
      });
    } finally {
      const elapsed = Date.now() - startTime;
      console.log("Webhook processing finished", {
        webhookEventId: args.webhookEventId,
        elapsed
      });
    }
  },
});
