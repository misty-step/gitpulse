/**
 * Embeddings queries and mutations
 */

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/**
 * Get embedding by reference ID
 */
export const getByRefId = query({
  args: { refId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("embeddings")
      .withIndex("by_refId", (q) => q.eq("refId", args.refId))
      .first();
  },
});

/**
 * List embeddings by scope
 */
export const listByScope = query({
  args: {
    scope: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("embeddings")
      .withIndex("by_scope", (q) => q.eq("scope", args.scope))
      .take(limit);
  },
});

/**
 * Internal: Create embedding
 */
export const create = internalMutation({
  args: {
    scope: v.string(),
    refId: v.string(),
    contentHash: v.optional(v.string()),
    vector: v.array(v.float64()),
    provider: v.string(),
    model: v.string(),
    dimensions: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if embedding already exists
    const existing = await ctx.db
      .query("embeddings")
      .withIndex("by_refId", (q) => q.eq("refId", args.refId))
      .filter((q) => q.eq(q.field("scope"), args.scope))
      .first();

    if (existing) {
      // Update existing embedding
      await ctx.db.patch(existing._id, {
        vector: args.vector,
        provider: args.provider,
        model: args.model,
        dimensions: args.dimensions,
        metadata: args.metadata,
        contentHash: args.contentHash ?? existing.contentHash,
      });
      return existing._id;
    }

    // Create new embedding
    return await ctx.db.insert("embeddings", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
