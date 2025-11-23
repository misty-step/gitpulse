import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const ACTIVE_STATUSES = new Set<Doc<"reportRegenerations">["status"]>([
  "queued",
  "collecting",
  "generating",
  "validating",
  "saving",
]);

export const latestByReport = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const report = await ctx.db.get(args.reportId);
    if (!report || report.userId !== identity.subject) {
      return null;
    }

    return await ctx.db
      .query("reportRegenerations")
      .withIndex("by_reportId_and_createdAt", (q) =>
        q.eq("reportId", args.reportId),
      )
      .order("desc")
      .first();
  },
});

export const listByReport = query({
  args: {
    reportId: v.id("reports"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const report = await ctx.db.get(args.reportId);
    if (!report || report.userId !== identity.subject) {
      return [];
    }

    const limit = args.limit ?? 10;

    return await ctx.db
      .query("reportRegenerations")
      .withIndex("by_reportId_and_createdAt", (q) =>
        q.eq("reportId", args.reportId),
      )
      .order("desc")
      .take(limit);
  },
});

export const createRequest = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (report.userId !== identity.subject) {
      throw new Error("You do not have access to regenerate this report");
    }

    if (report.scheduleType !== "daily" && report.scheduleType !== "weekly") {
      throw new Error(
        "Regeneration is only available for daily or weekly reports right now",
      );
    }

    const existingJob = await ctx.db
      .query("reportRegenerations")
      .withIndex("by_reportId_and_createdAt", (q) =>
        q.eq("reportId", args.reportId),
      )
      .order("desc")
      .take(1);

    if (
      existingJob.length > 0 &&
      ACTIVE_STATUSES.has(
        existingJob[0].status as Doc<"reportRegenerations">["status"],
      )
    ) {
      return existingJob[0]._id;
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("reportRegenerations", {
      reportId: args.reportId,
      userId: report.userId,
      ghLogins: report.ghLogins,
      kind: report.scheduleType,
      startDate: report.startDate,
      endDate: report.endDate,
      status: "queued",
      progress: 0,
      message: "Queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.actions.reports.runRegeneration.run,
      {
        jobId,
      },
    );

    return jobId;
  },
});

export const getByIdInternal = internalQuery({
  args: { jobId: v.id("reportRegenerations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const updateJob = internalMutation({
  args: {
    jobId: v.id("reportRegenerations"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("collecting"),
        v.literal("generating"),
        v.literal("validating"),
        v.literal("saving"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    progress: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...rest } = args;
    await ctx.db.patch(jobId, {
      ...rest,
      updatedAt: Date.now(),
    });
  },
});

export const markCompleted = internalMutation({
  args: {
    jobId: v.id("reportRegenerations"),
    newReportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      progress: 1,
      message: "Report regenerated",
      newReportId: args.newReportId,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    jobId: v.id("reportRegenerations"),
    message: v.string(),
    stage: v.optional(v.string()),
    stack: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      progress: 1,
      message: args.message,
      error: {
        message: args.message,
        stage: args.stage,
        stack: args.stack?.slice(0, 2000),
      },
      updatedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});
