"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  canonicalizeEvent,
  type CanonicalizeInput,
  type PullRequestWebhookEvent,
  type PullRequestReviewWebhookEvent,
  type IssuesWebhookEvent,
  type IssueCommentWebhookEvent,
} from "../../lib/canonicalizeEvent";
import { persistCanonicalEvent } from "../../lib/canonicalFactService";

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
      const webhookEvent = await ctx.runQuery(
        internal.webhookEvents.getById,
        { id: args.webhookEventId }
      );

      if (!webhookEvent) {
        console.error("Webhook event not found", { webhookEventId: args.webhookEventId });
        return;
      }

      const { deliveryId, event, payload } = webhookEvent;

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "processing",
      });

      const canonicalInputs = buildCanonicalInputs(event, payload);
      if (canonicalInputs.length === 0) {
        console.warn("Unsupported webhook event", { event, deliveryId });
        await ctx.runMutation(internal.webhookEvents.updateStatus, {
          id: args.webhookEventId,
          status: "completed",
        });
        return;
      }

      const repoPayload = (payload as any)?.repository ?? null;
      const installationId = (payload as any)?.installation?.id;

      let inserted = 0;
      let duplicates = 0;

      for (const input of canonicalInputs) {
        const canonical = canonicalizeEvent(input);
        if (!canonical) {
          continue;
        }

        const result = await persistCanonicalEvent(ctx, canonical, {
          installationId,
          repoPayload,
        });

        if (result.status === "inserted") {
          inserted++;
        } else if (result.status === "duplicate") {
          duplicates++;
        }
      }

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "completed",
      });

      console.log("Webhook processed", {
        deliveryId,
        event,
        inserted,
        duplicates,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error("Webhook processing failed", {
        webhookEventId: args.webhookEventId,
        error: errorMessage,
      });

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "failed",
        errorMessage,
        retryCount: 0,
      });
    } finally {
      const elapsed = Date.now() - startTime;
      console.log("Webhook processing finished", {
        webhookEventId: args.webhookEventId,
        elapsed,
      });
    }
  },
});

function buildCanonicalInputs(
  event: string,
  payload: unknown
): CanonicalizeInput[] {
  switch (event) {
    case "pull_request":
      return [
        {
          kind: "pull_request",
          payload: payload as PullRequestWebhookEvent,
        },
      ];
    case "pull_request_review":
      return [
        {
          kind: "pull_request_review",
          payload: payload as PullRequestReviewWebhookEvent,
        },
      ];
    case "issues":
      return [
        {
          kind: "issues",
          payload: payload as IssuesWebhookEvent,
        },
      ];
    case "issue_comment":
      return [
        {
          kind: "issue_comment",
          payload: payload as IssueCommentWebhookEvent,
        },
      ];
    default:
      return [];
  }
}
