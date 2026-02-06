/**
 * Subscription queries
 */

import { query } from "./_generated/server";
import { hasActiveSubscription as hasActiveSubscriptionStatus } from "./lib/subscriptionAccess";

export const getByUserId = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const hasActiveSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasAccess: false, status: null, trialEndsAt: null };
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    const status = subscription?.status ?? null;

    return {
      hasAccess: status ? hasActiveSubscriptionStatus(status) : false,
      status,
      trialEndsAt: subscription?.trialEnd ?? null,
    };
  },
});
