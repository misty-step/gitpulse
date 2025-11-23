import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const upsert = mutation({
  args: {
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
    targetType: v.optional(v.string()),
    repositorySelection: v.optional(v.string()),
    repositories: v.optional(v.array(v.string())),
    clerkUserId: v.optional(v.string()),
    lastCursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"installations">> => {
    const existing = await ctx.db
      .query("installations")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("installations", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByInstallationId = query({
  args: { installationId: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("installations")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();
  },
});

export const listByClerkUser = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("installations")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
  },
});

export const listMyInstallations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    return ctx.db
      .query("installations")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .collect();
  },
});

export const updateRateLimitBudget = mutation({
  args: {
    installationId: v.number(),
    rateLimitRemaining: v.number(),
    rateLimitReset: v.number(),
  },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("installations")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();

    if (installation) {
      await ctx.db.patch(installation._id, {
        rateLimitRemaining: args.rateLimitRemaining,
        rateLimitReset: args.rateLimitReset,
        updatedAt: Date.now(),
      });
    }
  },
});

export const updateSyncState = internalMutation({
  args: {
    installationId: v.number(),
    lastCursor: v.optional(v.string()),
    etag: v.optional(v.string()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("installations")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();

    if (!installation) {
      return;
    }

    const update: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    for (const [key, value] of Object.entries(args)) {
      if (key === "installationId" || value === undefined) continue;
      update[key] = value;
    }

    await ctx.db.patch(installation._id, update);
  },
});

/**
 * List all installations (internal use for reconciliation)
 */
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("installations").collect();
  },
});
