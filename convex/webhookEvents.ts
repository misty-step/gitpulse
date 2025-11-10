import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Enqueue a GitHub webhook event for processing
 *
 * Stores the raw webhook envelope for asynchronous processing.
 * Returns immediately to ensure <200ms ACK to GitHub.
 */
export const enqueue = mutation({
  args: {
    deliveryId: v.string(),
    event: v.string(),
    installationId: v.optional(v.number()),
    payload: v.any(),
  },
  handler: async (ctx, args): Promise<Id<"webhookEvents">> => {
    const now = Date.now();

    // Check for duplicate delivery (idempotency)
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();

    if (existing) {
      return existing._id;
    }

    // Insert new webhook event with pending status
    return await ctx.db.insert("webhookEvents", {
      deliveryId: args.deliveryId,
      event: args.event,
      installationId: args.installationId,
      payload: args.payload,
      status: "pending",
      receivedAt: now,
      retryCount: 0,
    });
  },
});

/**
 * Get webhook event by ID (internal use)
 */
export const getById = internalQuery({
  args: { id: v.id("webhookEvents") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

/**
 * Get webhook event by delivery ID
 */
export const getByDeliveryId = query({
  args: { deliveryId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("webhookEvents")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
  },
});

/**
 * List pending webhook events for processing
 */
export const listPending = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("webhookEvents")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit ?? 100);
  },
});

/**
 * Update webhook event status
 */
export const updateStatus = internalMutation({
  args: {
    id: v.id("webhookEvents"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      processedAt: args.status === "completed" ? Date.now() : undefined,
      errorMessage: args.errorMessage,
      retryCount: args.retryCount,
    });
  },
});
