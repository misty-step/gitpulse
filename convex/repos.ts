/**
 * Repository queries and mutations
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

/**
 * Get repository by full name (owner/repo)
 */
export const getByFullName = query({
  args: { fullName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
      .first();
  },
});

/**
 * Get repository by Convex ID
 */
export const getById = query({
  args: { id: v.id("repos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get repository by GitHub ID
 */
export const getByGhId = query({
  args: { ghId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repos")
      .withIndex("by_ghId", (q) => q.eq("ghId", args.ghId))
      .first();
  },
});

/**
 * List repositories by owner
 */
export const listByOwner = query({
  args: {
    owner: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("repos")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .take(limit);
  },
});

/**
 * List all repositories with cursor-based pagination
 *
 * Supports loading repos incrementally with usePaginatedQuery hook.
 * Uses Convex pagination - paginationOptsValidator required in args per official docs.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repos")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get total count of all repositories
 *
 * Efficient query for dashboard/statistics - returns count without loading data.
 * Use this instead of list() when you only need the total number.
 */
export const count = query({
  handler: async (ctx) => {
    const repos = await ctx.db.query("repos").collect();
    return repos.length;
  },
});

/**
 * Create or update repository from GitHub data
 */
export const upsert = mutation({
  args: {
    ghId: v.number(),
    ghNodeId: v.string(),
    fullName: v.string(),
    name: v.string(),
    owner: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    homepage: v.optional(v.string()),
    language: v.optional(v.string()),
    isPrivate: v.boolean(),
    isFork: v.boolean(),
    isArchived: v.boolean(),
    stars: v.optional(v.number()),
    forks: v.optional(v.number()),
    openIssues: v.optional(v.number()),
    watchers: v.optional(v.number()),
    size: v.optional(v.number()),
    ghCreatedAt: v.number(),
    ghUpdatedAt: v.number(),
    ghPushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repos")
      .withIndex("by_ghId", (q) => q.eq("ghId", args.ghId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing repo
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new repo
      return await ctx.db.insert("repos", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
