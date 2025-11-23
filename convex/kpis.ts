/**
 * KPI Queries - Analytics and metrics
 *
 * Migrated from packages/ai/src/retrieval.ts
 * Deep module design: Simple interface hiding query complexity
 */

import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";

/**
 * User KPI result
 */
export interface UserKPIs {
  login: string;
  prsOpened: number;
  commits: number;
  reviews: number;
}

/**
 * Internal helper to get user KPIs
 */
async function getUserKPIsInternal(
  ctx: QueryCtx,
  ghLogin: string,
  startDate: number,
  endDate: number,
): Promise<UserKPIs> {
  // Find user by GitHub login
  const user = await ctx.db
    .query("users")
    .withIndex("by_ghLogin", (q) => q.eq("ghLogin", ghLogin))
    .first();

  if (!user) {
    return {
      login: ghLogin,
      prsOpened: 0,
      commits: 0,
      reviews: 0,
    };
  }

  // Get all events for this user in time range
  const allEvents = await ctx.db
    .query("events")
    .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id))
    .collect();

  // Filter by time range and count by type
  const eventsInRange = allEvents.filter(
    (e) => e.ts >= startDate && e.ts <= endDate,
  );

  const prsOpened = eventsInRange.filter((e) => e.type === "pr_opened").length;
  const commits = eventsInRange.filter((e) => e.type === "commit").length;
  const reviews = eventsInRange.filter((e) => e.type === "review").length;

  return {
    login: ghLogin,
    prsOpened,
    commits,
    reviews,
  };
}

/**
 * Get user KPIs for a time range
 *
 * Returns counts for:
 * - PRs opened (event type: pr_opened)
 * - Commits (event type: commit)
 * - Reviews (event type: review)
 *
 * @param ghLogin - GitHub user login
 * @param startDate - Start timestamp (Unix ms)
 * @param endDate - End timestamp (Unix ms)
 * @returns User KPIs object
 */
export const getUserKPIs = query({
  args: {
    ghLogin: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<UserKPIs> => {
    return getUserKPIsInternal(ctx, args.ghLogin, args.startDate, args.endDate);
  },
});

/**
 * Repository KPI result
 */
export interface RepoKPIs {
  fullName: string;
  prsOpened: number;
  commits: number;
  reviews: number;
  contributors: number;
}

/**
 * Repository KPI result with trends
 */
export interface RepoKPIsWithTrends extends RepoKPIs {
  trends: {
    prsOpened: { change: number; percentage: number };
    commits: { change: number; percentage: number };
    reviews: { change: number; percentage: number };
    contributors: { change: number; percentage: number };
  };
  previousPeriod: RepoKPIs;
}

/**
 * Internal helper to get repo KPIs
 */
async function getRepoKPIsInternal(
  ctx: QueryCtx,
  fullName: string,
  startDate: number,
  endDate: number,
): Promise<RepoKPIs> {
  // Find repository by full name
  const repo = await ctx.db
    .query("repos")
    .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
    .first();

  if (!repo) {
    return {
      fullName,
      prsOpened: 0,
      commits: 0,
      reviews: 0,
      contributors: 0,
    };
  }

  // Get all events for this repo in time range
  const allEvents = await ctx.db
    .query("events")
    .withIndex("by_repo_and_ts", (q) =>
      q.eq("repoId", repo._id).gte("ts", startDate).lte("ts", endDate),
    )
    .collect();

  // Count by type
  const prsOpened = allEvents.filter((e) => e.type === "pr_opened").length;
  const commits = allEvents.filter((e) => e.type === "commit").length;
  const reviews = allEvents.filter((e) => e.type === "review").length;

  // Count unique contributors (distinct actorIds)
  const uniqueActorIds = new Set(allEvents.map((e) => e.actorId));

  return {
    fullName,
    prsOpened,
    commits,
    reviews,
    contributors: uniqueActorIds.size,
  };
}

/**
 * Get repository KPIs for a time range
 *
 * Returns counts for:
 * - Total PRs opened
 * - Total commits
 * - Total reviews
 * - Unique contributors
 *
 * @param fullName - Repository full name (org/repo)
 * @param startDate - Start timestamp (Unix ms)
 * @param endDate - End timestamp (Unix ms)
 * @returns Repository KPIs
 */
export const getRepoKPIs = query({
  args: {
    fullName: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<RepoKPIs> => {
    return getRepoKPIsInternal(
      ctx,
      args.fullName,
      args.startDate,
      args.endDate,
    );
  },
});

/**
 * Get repository KPIs with trend comparison
 *
 * Calculates current period KPIs and compares to previous period
 * of equal duration to show trend indicators.
 *
 * @param fullName - Repository full name (org/repo)
 * @param startDate - Start timestamp (Unix ms)
 * @param endDate - End timestamp (Unix ms)
 * @returns Repository KPIs with trend data
 */
export const getRepoKPIsWithTrends = query({
  args: {
    fullName: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<RepoKPIsWithTrends> => {
    // Get current period KPIs
    const currentKPIs = await getRepoKPIsInternal(
      ctx,
      args.fullName,
      args.startDate,
      args.endDate,
    );

    // Calculate previous period (same duration, shifted back)
    const duration = args.endDate - args.startDate;
    const previousStart = args.startDate - duration;
    const previousEnd = args.startDate;

    // Get previous period KPIs
    const previousKPIs = await getRepoKPIsInternal(
      ctx,
      args.fullName,
      previousStart,
      previousEnd,
    );

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      const change = current - previous;
      const percentage =
        previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;
      return { change, percentage };
    };

    return {
      ...currentKPIs,
      trends: {
        prsOpened: calculateTrend(
          currentKPIs.prsOpened,
          previousKPIs.prsOpened,
        ),
        commits: calculateTrend(currentKPIs.commits, previousKPIs.commits),
        reviews: calculateTrend(currentKPIs.reviews, previousKPIs.reviews),
        contributors: calculateTrend(
          currentKPIs.contributors,
          previousKPIs.contributors,
        ),
      },
      previousPeriod: previousKPIs,
    };
  },
});

/**
 * Get KPIs for multiple users (batch query)
 */
export const getUserKPIsBatch = query({
  args: {
    ghLogins: v.array(v.string()),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<UserKPIs[]> => {
    const kpis = await Promise.all(
      args.ghLogins.map((login) =>
        getUserKPIsInternal(ctx, login, args.startDate, args.endDate),
      ),
    );
    return kpis;
  },
});
