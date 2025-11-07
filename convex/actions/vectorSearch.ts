"use node";

/**
 * Vector Search Actions
 *
 * Vector search is only available in actions (Node.js environment).
 * This module provides semantic similarity search across embeddings.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";

/**
 * Search for similar events using vector similarity
 *
 * @param vector - Query vector (1024-dim for Voyage, 1536-dim for OpenAI)
 * @param limit - Max results (default: 10, max: 256)
 * @param scope - Filter by scope (e.g., "event")
 * @returns Array of {_id, _score} where score ranges from -1 (least) to 1 (most similar)
 *
 * @example
 * const results = await ctx.runAction(api.actions.vectorSearch.search, {
 *   vector: embeddingVector,
 *   limit: 10,
 *   scope: "event"
 * });
 */
export const search = action({
  args: {
    vector: v.array(v.float64()),
    limit: v.optional(v.number()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 10, 256); // Convex limit: 1-256

    // Build filter if scope provided
    const scope = args.scope;
    const filter = scope ? (q: any) => q.eq("scope", scope) : undefined;

    // Vector search returns [{_id, _score}, ...]
    const results = await ctx.vectorSearch("embeddings", "by_vector", {
      vector: args.vector,
      limit,
      filter,
    });

    return results;
  },
});
