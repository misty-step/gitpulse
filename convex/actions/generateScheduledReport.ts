"use node";

/**
 * Scheduled Report Generation
 *
 * Generates automated daily standup and weekly retro reports.
 * Called by cron jobs at user's preferred time (reportHourUTC).
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { generateReportForUser } from "../lib/reportOrchestrator";

// Removed deprecated callGemini function - now using LLMClient abstraction

/**
 * Generate daily standup report
 *
 * Called by cron job every morning at user's reportHourUTC.
 * Skips generation if no activity in past 24 hours.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = DAY_MS * 7;

export const generateDailyReport = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get user data
    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: args.userId,
    });

    if (!user || !user.githubUsername) {
      console.warn(`User ${args.userId} not found or missing GitHub username`);
      return;
    }

    const endDate = Date.now();
    const startDate = endDate - DAY_MS;

    await generateReportForUser(ctx, {
      userId: args.userId,
      user,
      kind: "daily",
      startDate,
      endDate,
    });

    console.log(`Generated daily report for ${user.githubUsername}`);
  },
});

/**
 * Generate weekly retro report
 *
 * Called by cron job once a week at user's reportHourUTC + weeklyDayUTC.
 * Skips generation if no activity in past 7 days.
 */
export const generateWeeklyReport = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get user data
    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: args.userId,
    });

    if (!user || !user.githubUsername) {
      console.warn(`User ${args.userId} not found or missing GitHub username`);
      return;
    }

    const endDate = Date.now();
    const startDate = endDate - WEEK_MS;

    await generateReportForUser(ctx, {
      userId: args.userId,
      user,
      kind: "weekly",
      startDate,
      endDate,
    });

    console.log(`Generated weekly report for ${user.githubUsername}`);
  },
});
