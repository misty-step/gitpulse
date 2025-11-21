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
import { logger } from "../lib/logger.js";

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
      logger.warn(
        { userId: args.userId },
        "User not found or missing GitHub username",
      );
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

    logger.info(
      { githubUsername: user.githubUsername },
      "Generated daily report",
    );
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
      logger.warn(
        { userId: args.userId },
        "User not found or missing GitHub username",
      );
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

    logger.info(
      { githubUsername: user.githubUsername },
      "Generated weekly report",
    );
  },
});
