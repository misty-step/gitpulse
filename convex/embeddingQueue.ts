import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const MAX_ATTEMPTS = 5;

export const enqueue = internalMutation({
  args: {
    eventId: v.id("events"),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const alreadyEmbedded = await ctx.db
      .query("embeddings")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (alreadyEmbedded) {
      return alreadyEmbedded._id;
    }

    const existingJob = await ctx.db
      .query("embeddingQueue")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (existingJob) {
      if (existingJob.status === "failed") {
        await ctx.db.patch(existingJob._id, {
          status: "pending",
          attempts: 0,
          errorMessage: undefined,
        });
      }
      return existingJob._id;
    }

    return await ctx.db.insert("embeddingQueue", {
      eventId: args.eventId,
      contentHash: args.contentHash,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

export const listPending = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("embeddingQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit);
  },
});

export const markProcessing = internalMutation({
  args: { id: v.id("embeddingQueue") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    // Idempotent: skip if job doesn't exist or isn't pending
    // This prevents OCC conflicts when multiple workers race to claim the same job
    if (!job || job.status !== "pending") {
      return { marked: false };
    }

    await ctx.db.patch(args.id, {
      status: "processing",
      attempts: (job.attempts ?? 0) + 1,
      lastAttemptAt: Date.now(),
    });
    return { marked: true };
  },
});

export const complete = internalMutation({
  args: { id: v.id("embeddingQueue") },
  handler: async (ctx, args) => {
    // Guard delete: only delete if job exists
    // Prevents "Delete on nonexistent document" errors from concurrent completions
    const job = await ctx.db.get(args.id);
    if (job) {
      await ctx.db.delete(args.id);
    }
  },
});

export const fail = internalMutation({
  args: {
    id: v.id("embeddingQueue"),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      return;
    }

    const attempts = job.attempts;
    if (attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(args.id, {
        status: "failed",
        errorMessage: args.errorMessage,
      });
      return;
    }

    await ctx.db.patch(args.id, {
      status: "pending",
      errorMessage: args.errorMessage,
    });
  },
});
