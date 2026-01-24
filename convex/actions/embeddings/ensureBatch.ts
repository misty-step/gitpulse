"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { logger } from "../../lib/logger";

const DEFAULT_BATCH_SIZE = 25;

interface EnsureBatchArgs {
  limit?: number;
}

export async function ensureBatchHandler(
  ctx: ActionCtx,
  args: EnsureBatchArgs,
): Promise<{ processed: number }> {
  const limit = Math.min(Math.max(args.limit ?? DEFAULT_BATCH_SIZE, 1), 50);

  const pending: Doc<"embeddingQueue">[] = await ctx.runQuery(
    api.embeddingQueue.listPending,
    {
      limit,
    },
  );

  if (pending.length === 0) {
    return { processed: 0 };
  }

  const eventIds = pending.map((job) => job.eventId);

  logger.info(
    { batchSize: pending.length, eventIds },
    "Starting embedding batch processing",
  );

  await Promise.all(
    pending.map((job) =>
      ctx.runMutation(internal.embeddingQueue.markProcessing, { id: job._id }),
    ),
  );

  try {
    await ctx.runAction(api.actions.generateEmbeddings.generateBatch, {
      eventIds,
    });

    await Promise.all(
      pending.map((job) =>
        ctx.runMutation(internal.embeddingQueue.complete, { id: job._id }),
      ),
    );

    logger.info(
      { batchSize: pending.length },
      "Embedding batch completed successfully",
    );

    return { processed: pending.length };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(
      { err: error, batchSize: pending.length, eventIds },
      "Embedding batch failed",
    );

    await Promise.all(
      pending.map((job) =>
        ctx.runMutation(internal.embeddingQueue.fail, {
          id: job._id,
          errorMessage,
        }),
      ),
    );

    throw error;
  }
}

export const ensureBatch = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: ensureBatchHandler,
});
