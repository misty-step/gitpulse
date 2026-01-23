/**
 * Reports queries and mutations
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { logger } from "./lib/logger";

type Report = {
  _id: any;
  userId: string;
  scheduleType?: "daily" | "weekly";
  startDate: number;
  endDate: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: any;
};

function dedupeByWindow(reports: Report[]): Report[] {
  const seen = new Map<string, Report>();

  for (const report of reports) {
    if (!report.scheduleType) continue;
    const key = `${report.userId}:${report.scheduleType}:${report.startDate}:${report.endDate}`;
    const existing = seen.get(key);
    if (!existing || report.createdAt > existing.createdAt) {
      seen.set(key, report);
    }
  }

  // Sort by endDate desc then createdAt desc
  return Array.from(seen.values()).sort((a, b) => {
    if (b.endDate === a.endDate) {
      return b.createdAt - a.createdAt;
    }
    return b.endDate - a.endDate;
  });
}

/**
 * Get report by ID
 *
 * Security: Verifies ownership before returning to prevent IDOR attacks.
 * Returns null for unauthenticated requests or reports owned by other users.
 */
export const getById = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const report = await ctx.db.get(args.id);
    if (!report) return null;

    // Verify ownership
    if (report.userId !== identity.subject) return null;

    return report;
  },
});

/**
 * List reports by user (Clerk ID)
 * Sorted by endDate (report period) descending, not generation time
 */
export const listByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const raw = await ctx.db
      .query("reports")
      .withIndex("by_userId_and_endDate", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit * 3); // overfetch to allow dedupe

    // Return all reports - let UI decide what to show
    // Silent filtering here caused bugs where generated reports were invisible
    return dedupeByWindow(raw).slice(0, limit);
  },
});

/**
 * List reports by GitHub login (fallback for users without Clerk ID)
 * Sorted by endDate (report period) descending, not generation time
 */
export const listByGhLogin = query({
  args: {
    ghLogin: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    // Find all reports where userId matches the gh:login pattern
    const allReports = await ctx.db
      .query("reports")
      .order("desc")
      .take(limit * 3); // Get extra to filter & dedupe

    // Filter by ghLogin only - let UI decide what to show
    const filteredReports = allReports.filter(
      (report) => report.userId === `gh:${args.ghLogin}`,
    );

    return dedupeByWindow(filteredReports).slice(0, limit);
  },
});

export const listByWindow = query({
  args: {
    userId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    scheduleType: v.union(v.literal("daily"), v.literal("weekly")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_userId_and_schedule", (q) =>
        q.eq("userId", args.userId).eq("scheduleType", args.scheduleType),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("startDate"), args.startDate),
          q.eq(q.field("endDate"), args.endDate),
        ),
      )
      .order("desc")
      .take(limit);

    // Keep all versions for detail navigation; callers can limit if desired
    return reports;
  },
});

/**
 * List all reports (for admin/debug)
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("reports")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

/**
 * Get total count of all reports
 *
 * Efficient query for dashboard/statistics - returns count without loading data.
 * Use this instead of list() when you only need the total number.
 */
export const count = query({
  handler: async (ctx) => {
    const reports = await ctx.db.query("reports").collect();
    return reports.length;
  },
});

/**
 * Delete report
 *
 * Security: Verifies ownership before deletion to prevent unauthorized access
 */
export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("Report not found");

    if (report.userId !== identity.subject) {
      throw new Error("Unauthorized: You can only delete your own reports");
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Internal maintenance: prune duplicate reports for the same user/schedule/window,
 * keeping only the newest createdAt.
 */
export const pruneDuplicates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("reports").collect();
    const keepers = new Map<string, Report>();

    for (const report of all as Report[]) {
      if (!report.scheduleType) continue;
      const key = `${report.userId}:${report.scheduleType}:${report.startDate}:${report.endDate}`;
      const existing = keepers.get(key);
      if (!existing || report.createdAt > existing.createdAt) {
        keepers.set(key, report);
      }
    }

    let deleted = 0;
    for (const report of all as Report[]) {
      if (!report.scheduleType) continue;
      const key = `${report.userId}:${report.scheduleType}:${report.startDate}:${report.endDate}`;
      const keeper = keepers.get(key);
      if (!keeper || keeper._id === report._id) continue;
      await ctx.db.delete(report._id);
      deleted++;
    }
    return deleted;
  },
});

/**
 * Update report userId (for fixing test data)
 */
export const updateUserId = mutation({
  args: {
    oldUserId: v.string(),
    newUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all reports with old userId
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", args.oldUserId),
      )
      .collect();

    // Update each report
    const updates = await Promise.all(
      reports.map((report) =>
        ctx.db.patch(report._id, { userId: args.newUserId }),
      ),
    );

    return {
      updated: updates.length,
      reports: reports.map((r) => ({ id: r._id, title: r.title })),
    };
  },
});

/**
 * Internal: Create report
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    ghLogins: v.array(v.string()),
    repos: v.optional(v.array(v.string())), // ["owner/repo", ...] for display
    markdown: v.string(),
    html: v.string(),
    json: v.optional(v.string()),
    citations: v.array(v.string()),
    promptVersion: v.string(),
    provider: v.string(),
    model: v.string(),
    generatedAt: v.number(),
    isAutoGenerated: v.optional(v.boolean()),
    scheduleType: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    cacheKey: v.optional(v.string()),
    coverageScore: v.optional(v.number()),
    coverageBreakdown: v.optional(
      v.array(
        v.object({
          scopeKey: v.string(),
          used: v.number(),
          total: v.number(),
        }),
      ),
    ),
    sections: v.optional(
      v.array(
        v.object({
          title: v.string(),
          bullets: v.array(v.string()),
          citations: v.array(v.string()),
        }),
      ),
    ),
    // Diagnostic fields
    eventCount: v.optional(v.number()),
    citationCount: v.optional(v.number()),
    expectedCitations: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("reports", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByCacheKey = internalQuery({
  args: {
    cacheKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .first();
  },
});

// ============================================================================
// Report Staleness Management (for intelligent post-sync report generation)
// ============================================================================

/**
 * Mark a report as stale (new events exist that weren't included)
 */
export const markStale = internalMutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    // Don't re-mark if already stale
    if (report.isStale) return report._id;

    await ctx.db.patch(args.reportId, {
      isStale: true,
      staleDetectedAt: Date.now(),
    });
    return report._id;
  },
});

/**
 * Clear staleness flag (called after regeneration)
 */
export const clearStale = internalMutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    await ctx.db.patch(args.reportId, {
      isStale: false,
      staleDetectedAt: undefined,
    });
    return report._id;
  },
});

/**
 * Get stale reports for a user (for badge display and regeneration prompts)
 */
export const getStaleReportsForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_userId_and_isStale", (q) =>
        q.eq("userId", args.userId).eq("isStale", true),
      )
      .collect();
  },
});

/**
 * Get reports for a specific window (for staleness detection during post-sync analysis)
 */
export const getReportForWindow = internalQuery({
  args: {
    userId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    scheduleType: v.union(v.literal("daily"), v.literal("weekly")),
  },
  handler: async (ctx, args) => {
    // Get the most recent report for this exact window
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_userId_and_schedule", (q) =>
        q.eq("userId", args.userId).eq("scheduleType", args.scheduleType),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("startDate"), args.startDate),
          q.eq(q.field("endDate"), args.endDate),
        ),
      )
      .order("desc")
      .first();

    return reports;
  },
});

/**
 * Internal: Patch coverageScore on existing report (data fix)
 */
export const patchCoverageScore = internalMutation({
  args: {
    reportId: v.id("reports"),
    coverageScore: v.number(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    await ctx.db.patch(args.reportId, {
      coverageScore: args.coverageScore,
    });
    return args.reportId;
  },
});

/**
 * Internal: Delete report by ID (for upsert behavior)
 */
export const deleteById = internalMutation({
  args: {
    id: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.id);
    if (!report) return null;

    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Internal: Clean up duplicate reports (keep newest per window)
 */
export const cleanupDuplicates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("reports").collect();
    const windows = new Map<string, Report[]>();

    // Group by window
    for (const report of all as Report[]) {
      if (!report.scheduleType) continue;
      const key = `${report.userId}:${report.scheduleType}:${report.startDate}:${report.endDate}`;
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key)!.push(report);
    }

    let deleted = 0;
    for (const [, reports] of windows) {
      if (reports.length <= 1) continue;

      // Sort by createdAt desc, keep first (newest)
      reports.sort((a, b) => b.createdAt - a.createdAt);
      for (let i = 1; i < reports.length; i++) {
        await ctx.db.delete(reports[i]._id);
        deleted++;
      }
    }

    logger.info({ deleted }, "Cleaned up duplicate reports");
    return { deleted };
  },
});

