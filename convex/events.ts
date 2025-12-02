/**
 * Event queries and mutations
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * List events by actor (user) with time range filter
 */
export const listByActor = query({
  args: {
    actorId: v.id("users"),
    type: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let actorQuery = ctx.db
      .query("events")
      .withIndex("by_actor_and_ts", (q) => q.eq("actorId", args.actorId));

    if (args.startDate !== undefined) {
      actorQuery = actorQuery.filter((q) =>
        q.gte(q.field("ts"), args.startDate!),
      );
    }
    if (args.endDate !== undefined) {
      actorQuery = actorQuery.filter((q) =>
        q.lte(q.field("ts"), args.endDate!),
      );
    }

    let events = await actorQuery.order("desc").take(limit * 2);

    if (args.type) {
      events = events.filter((e) => e.type === args.type);
    }

    return events.slice(0, limit);
  },
});

const LIST_BY_ACTOR_BATCH_SIZE = 100;

export async function* listByActorComplete(
  ctx: QueryCtx,
  actorId: Id<"users">,
  startDate?: number,
  endDate?: number,
): AsyncGenerator<Doc<"events">[]> {
  let actorQuery = ctx.db
    .query("events")
    .withIndex("by_actor_and_ts", (q) => q.eq("actorId", actorId));

  if (startDate !== undefined) {
    actorQuery = actorQuery.filter((q) => q.gte(q.field("ts"), startDate));
  }

  if (endDate !== undefined) {
    actorQuery = actorQuery.filter((q) => q.lte(q.field("ts"), endDate));
  }

  let cursor: string | null = null;

  while (true) {
    const batch = await actorQuery.order("desc").paginate({
      cursor: cursor ?? null,
      numItems: LIST_BY_ACTOR_BATCH_SIZE,
    });

    if (batch.page.length > 0) {
      yield batch.page;
    }

    if (batch.isDone) {
      break;
    }

    cursor = batch.continueCursor ?? null;
  }
}

export async function countByActor(
  ctx: QueryCtx,
  actorId: Id<"users">,
  startDate?: number,
  endDate?: number,
): Promise<number> {
  let actorQuery = ctx.db
    .query("events")
    .withIndex("by_actor_and_ts", (q) => q.eq("actorId", actorId));

  if (startDate !== undefined) {
    actorQuery = actorQuery.filter((q) => q.gte(q.field("ts"), startDate));
  }

  if (endDate !== undefined) {
    actorQuery = actorQuery.filter((q) => q.lte(q.field("ts"), endDate));
  }

  const events = await actorQuery.collect();

  return events.length;
}

export const countByActorInternal = internalQuery({
  args: {
    actorId: v.id("users"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await countByActor(ctx, args.actorId, args.startDate, args.endDate);
  },
});

/**
 * List events by repository with time range filter
 */
export const listByRepo = query({
  args: {
    repoId: v.id("repos"),
    type: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let repoQuery = ctx.db
      .query("events")
      .withIndex("by_repo_and_ts", (q) => q.eq("repoId", args.repoId));

    if (args.startDate !== undefined) {
      repoQuery = repoQuery.filter((q) =>
        q.gte(q.field("ts"), args.startDate!),
      );
    }
    if (args.endDate !== undefined) {
      repoQuery = repoQuery.filter((q) => q.lte(q.field("ts"), args.endDate!));
    }
    let events = await repoQuery.order("desc").take(limit * 2);

    if (args.type) {
      events = events.filter((e) => e.type === args.type);
    }

    return events.slice(0, limit);
  },
});

/**
 * List events by type with time range filter
 */
export const listByType = query({
  args: {
    type: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let typeQuery = ctx.db
      .query("events")
      .withIndex("by_type_and_ts", (q) => q.eq("type", args.type));

    if (args.startDate !== undefined) {
      typeQuery = typeQuery.filter((q) =>
        q.gte(q.field("ts"), args.startDate!),
      );
    }
    if (args.endDate !== undefined) {
      typeQuery = typeQuery.filter((q) => q.lte(q.field("ts"), args.endDate!));
    }

    const events = await typeQuery.order("desc").take(limit);

    return events;
  },
});

/**
 * Create event
 */
export const create = mutation({
  args: {
    type: v.string(),
    ghId: v.optional(v.string()),
    ghNodeId: v.optional(v.string()),
    actorId: v.id("users"),
    repoId: v.id("repos"),
    ts: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * Batch create events
 */
export const createBatch = mutation({
  args: {
    events: v.array(
      v.object({
        type: v.string(),
        ghId: v.optional(v.string()),
        ghNodeId: v.optional(v.string()),
        actorId: v.id("users"),
        repoId: v.id("repos"),
        ts: v.number(),
        metadata: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = await Promise.all(
      args.events.map((event) =>
        ctx.db.insert("events", {
          ...event,
          createdAt: now,
        }),
      ),
    );
    return ids;
  },
});

/**
 * Internal: Get event by ID
 */
export const getById = internalQuery({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal: List events by date range (for debugging)
 */
export const listByDateRange = internalQuery({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let query = ctx.db.query("events").withIndex("by_ts");

    query = query.filter((q) =>
      q.and(
        q.gte(q.field("ts"), args.startDate),
        q.lte(q.field("ts"), args.endDate),
      ),
    );

    return await query.order("desc").take(limit);
  },
});

/**
 * Internal: Lookup event by content hash for idempotent writes
 */
export const getByContentHash = internalQuery({
  args: { contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();
  },
});

/**
 * Internal: Upsert canonical EventFact (deduplicated via content hash)
 */
export const upsertCanonical = internalMutation({
  args: {
    type: v.string(),
    ghId: v.optional(v.string()),
    ghNodeId: v.optional(v.string()),
    actorId: v.id("users"),
    repoId: v.id("repos"),
    ts: v.number(),
    canonicalText: v.string(),
    sourceUrl: v.string(),
    metrics: v.optional(
      v.object({
        additions: v.optional(v.number()),
        deletions: v.optional(v.number()),
        filesChanged: v.optional(v.number()),
      }),
    ),
    contentHash: v.string(),
    metadata: v.optional(v.any()),
    contentScope: v.optional(v.literal("event")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("events", {
      ...args,
      contentScope: args.contentScope ?? "event",
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal: Get the latest event timestamp for a user (by Clerk user ID)
 *
 * Used by sync recovery logic to detect stale data patterns.
 */
export const getLatestEventTsForUser = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // First, look up the user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
      .first();

    if (!user) {
      return null;
    }

    // Then get the latest event for this user
    const latestEvent = await ctx.db
      .query("events")
      .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id))
      .order("desc")
      .first();

    return latestEvent?.ts ?? null;
  },
});

/**
 * Internal: List events without embeddings
 */
export const listWithoutEmbeddings = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    // Get all events
    const allEvents = await ctx.db.query("events").take(args.limit * 2); // Fetch more to ensure we have enough

    // Get all embedding refIds
    const allEmbeddings = await ctx.db.query("embeddings").collect();
    const embeddedEventIds = new Set(
      allEmbeddings.filter((e) => e.scope === "event").map((e) => e.refId),
    );

    // Filter events without embeddings
    const eventsWithoutEmbeddings = allEvents.filter(
      (e) => !embeddedEventIds.has(e._id),
    );

    return eventsWithoutEmbeddings.slice(0, args.limit);
  },
});
