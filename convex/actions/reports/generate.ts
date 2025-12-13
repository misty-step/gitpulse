"use node";

/**
 * Report Generation Actions - Deep Module Design
 *
 * Simple interface: generateWeekly({ userId }) → report
 * Hides: timezone calculation, user lookup, window computation
 *
 * These convenience wrappers handle user-local time windows automatically.
 * The caller doesn't need to understand timezones - they just pass a userId.
 */

import { v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import { api } from "../../_generated/api";
import { generateReport } from "../../lib/generateReport";
import {
  getTodayWindow,
  getYesterdayWindow,
  getLastWeekWindow,
  getTimezoneOrDefault,
} from "../../lib/timeWindows";

/**
 * Generate a report for a user and time window.
 *
 * Called by:
 * - Sync completion (auto-generate after events ingested)
 * - Scheduled daily/weekly jobs
 * - Manual "Generate Report" button
 */
export const generate = internalAction({
  args: {
    userId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    kind: v.union(v.literal("daily"), v.literal("weekly")),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    return await generateReport(ctx, args);
  },
});

/**
 * Generate today's daily report for a user.
 *
 * Deep module: caller passes userId, we handle timezone internally.
 * Covers from user's local midnight to now.
 */
export const generateTodayDaily = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: args.userId });
    const timezone = getTimezoneOrDefault(user?.timezone);
    const window = getTodayWindow(timezone);

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: window.start,
      endDate: window.end,
      kind: "daily",
      timezone,
    });
  },
});

/**
 * Generate yesterday's daily report for a user.
 *
 * Deep module: handles timezone internally.
 * For scheduled midnight jobs - covers previous complete day in user's timezone.
 */
export const generateYesterdayDaily = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: args.userId });
    const timezone = getTimezoneOrDefault(user?.timezone);
    const window = getYesterdayWindow(timezone);

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: window.start,
      endDate: window.end,
      kind: "daily",
      timezone,
    });
  },
});

/**
 * Generate this week's report for a user.
 *
 * Deep module: handles timezone internally.
 * Covers last 7 days (Sunday to Sunday) in user's timezone.
 */
export const generateWeekly = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: args.userId });
    const timezone = getTimezoneOrDefault(user?.timezone);
    const window = getLastWeekWindow(timezone);

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: window.start,
      endDate: window.end,
      kind: "weekly",
      timezone,
    });
  },
});

/**
 * Manual report generation (public action for UI)
 *
 * Callable from the frontend "Generate Report" button.
 * Uses authenticated user's identity from Clerk JWT.
 * Calculates timezone-aware windows when dates not provided.
 */
export const generateManual = action({
  args: {
    kind: v.union(v.literal("daily"), v.literal("weekly")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Authentication required" };
    }

    // Get user's timezone for formatting
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: identity.subject });
    const timezone = getTimezoneOrDefault(user?.timezone);

    // If dates provided, use them directly
    if (args.startDate !== undefined && args.endDate !== undefined) {
      return await generateReport(ctx, {
        userId: identity.subject,
        startDate: args.startDate,
        endDate: args.endDate,
        kind: args.kind,
        timezone,
      });
    }

    // Otherwise calculate timezone-aware defaults
    const window = args.kind === "daily"
      ? getTodayWindow(timezone)
      : getLastWeekWindow(timezone);

    return await generateReport(ctx, {
      userId: identity.subject,
      startDate: args.startDate ?? window.start,
      endDate: args.endDate ?? window.end,
      kind: args.kind,
      timezone,
    });
  },
});
