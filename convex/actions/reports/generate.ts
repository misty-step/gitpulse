"use node";

/**
 * Simple Report Generation Action
 *
 * This replaces the complex orchestration pipeline with a single action.
 * Called directly by sync completion or scheduled jobs.
 */

import { v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import { generateReport } from "../../lib/generateReport";

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
  },
  handler: async (ctx, args) => {
    return await generateReport(ctx, args);
  },
});

/**
 * Generate today's daily report for a user.
 *
 * Convenience wrapper that calculates the window automatically.
 * Covers from midnight UTC today to now.
 */
export const generateTodayDaily = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const todayMidnight = Math.floor(now / DAY_MS) * DAY_MS;

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: todayMidnight,
      endDate: now,
      kind: "daily",
    });
  },
});

/**
 * Generate yesterday's daily report for a user.
 *
 * For scheduled midnight jobs - covers previous complete day.
 */
export const generateYesterdayDaily = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const todayMidnight = Math.floor(now / DAY_MS) * DAY_MS;
    const yesterdayMidnight = todayMidnight - DAY_MS;

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: yesterdayMidnight,
      endDate: todayMidnight,
      kind: "daily",
    });
  },
});

/**
 * Generate this week's report for a user.
 *
 * Covers last 7 days ending at midnight today.
 */
export const generateWeekly = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const todayMidnight = Math.floor(now / DAY_MS) * DAY_MS;
    const weekAgo = todayMidnight - 7 * DAY_MS;

    return await generateReport(ctx, {
      userId: args.userId,
      startDate: weekAgo,
      endDate: todayMidnight,
      kind: "weekly",
    });
  },
});

/**
 * Manual report generation (public action for UI)
 *
 * Callable from the frontend "Generate Report" button.
 * Uses authenticated user's identity from Clerk JWT.
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

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const todayMidnight = Math.floor(now / DAY_MS) * DAY_MS;

    // Default windows: daily = today, weekly = last 7 days
    const startDate =
      args.startDate ??
      (args.kind === "daily" ? todayMidnight : todayMidnight - 7 * DAY_MS);
    const endDate = args.endDate ?? now;

    return await generateReport(ctx, {
      userId: identity.subject,
      startDate,
      endDate,
      kind: args.kind,
    });
  },
});
