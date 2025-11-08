"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

const DEFAULT_BATCH_SIZE = 25;

export const ensureBatch = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const limit = Math.min(Math.max(args.limit ?? DEFAULT_BATCH_SIZE, 1), 50);

    const pending: Doc<"embeddingQueue">[] = await ctx.runQuery(
      api.embeddingQueue.listPending,
      {
        limit,
      }
    );

    if (pending.length === 0) {
      return { processed: 0 };
    }

    await Promise.all(
      pending.map((job) =>
        ctx.runMutation(internal.embeddingQueue.markProcessing, { id: job._id })
      )
    );

    const eventIds = pending.map((job) => job.eventId);

    try {
      await ctx.runAction(api.actions.generateEmbeddings.generateBatch, {
        eventIds,
      });

      await Promise.all(
        pending.map((job) =>
          ctx.runMutation(internal.embeddingQueue.complete, { id: job._id })
        )
      );

      return { processed: pending.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await Promise.all(
        pending.map((job) =>
          ctx.runMutation(internal.embeddingQueue.fail, {
            id: job._id,
            errorMessage,
          })
        )
      );

      throw error;
    }
  },
});
