import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const recordEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return { alreadyProcessed: true };
    }

    const now = Date.now();

    await ctx.db.insert("stripeEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: now,
      createdAt: now,
    });

    return { alreadyProcessed: false };
  },
});

export const upsertCustomer = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        email: args.email,
        name: args.name,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("customers", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      email: args.email,
      name: args.name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertSubscription = internalMutation({
  args: {
    userId: v.string(),
    customerId: v.id("customers"),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    stripeProductId: v.optional(v.string()),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("paused"),
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    paymentMethodBrand: v.optional(v.string()),
    paymentMethodLast4: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        customerId: args.customerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripePriceId: args.stripePriceId,
        stripeProductId: args.stripeProductId,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        trialStart: args.trialStart,
        trialEnd: args.trialEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        paymentMethodBrand: args.paymentMethodBrand,
        paymentMethodLast4: args.paymentMethodLast4,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      customerId: args.customerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripeProductId: args.stripeProductId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      trialStart: args.trialStart,
      trialEnd: args.trialEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      canceledAt: args.canceledAt,
      paymentMethodBrand: args.paymentMethodBrand,
      paymentMethodLast4: args.paymentMethodLast4,
      createdAt: now,
      updatedAt: now,
    });
  },
});
