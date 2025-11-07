/**
 * Ingestion Jobs - Track GitHub data ingestion progress
 *
 * Used for background batch processing with real-time progress updates.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { ErrorCode } from "./lib/types";

/**
 * List active ingestion jobs for current user
 *
 * Returns jobs that are pending or running.
 * Returns empty array if not authenticated (graceful degradation).
 */
export const listActive = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    // Graceful degradation: Return empty array if not authenticated
    // This allows the component to render without crashing during auth initialization
    if (!identity) {
      console.info("[AUTH] listActive query called without authentication - returning empty array");
      return [];
    }

    const userId = identity.subject;
    console.info(`[AUTH] listActive query for user: ${userId}`);

    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "running"))
      )
      .order("desc")
      .take(10);

    return jobs;
  },
});

/**
 * Get a specific ingestion job by ID
 *
 * Returns null if not authenticated or unauthorized (graceful degradation).
 */
export const getById = query({
  args: { jobId: v.id("ingestionJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return null if not authenticated
    if (!identity) {
      return null;
    }

    const job = await ctx.db.get(args.jobId);

    // Return null if job doesn't exist
    if (!job) {
      return null;
    }

    // Verify ownership - return null if unauthorized
    if (job.userId !== identity.subject) {
      return null;
    }

    return job;
  },
});

/**
 * List all jobs for current user (with pagination support)
 *
 * Returns empty array if not authenticated (graceful degradation).
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return empty array if not authenticated
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 50;

    const jobs = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return jobs;
  },
});

/**
 * Create a new ingestion job (internal use only)
 *
 * Called from actions to track batch ingestion progress
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    repoFullName: v.string(),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    status: v.string(),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("ingestionJobs", {
      ...args,
      createdAt: Date.now(),
      startedAt: args.status === "running" ? Date.now() : undefined,
    });

    return jobId;
  },
});

/**
 * Update ingestion job progress (internal use only)
 */
export const updateProgress = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    progress: v.number(),
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;

    await ctx.db.patch(jobId, updates);
  },
});

/**
 * Mark job as completed (internal use only)
 */
export const complete = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...stats } = args;

    await ctx.db.patch(jobId, {
      status: "completed",
      progress: 100,
      completedAt: Date.now(),
      ...stats,
    });
  },
});

/**
 * Mark job as failed (internal use only)
 */
export const fail = internalMutation({
  args: {
    jobId: v.id("ingestionJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
  },
});

/**
 * Dismiss/acknowledge a job (user action)
 *
 * Doesn't delete, just marks as acknowledged so it won't show in active jobs
 */
export const dismiss = mutation({
  args: { jobId: v.id("ingestionJobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      const error = `[${ErrorCode.NOT_AUTHENTICATED}] User not authenticated`;
      console.error(error);
      throw new Error(error);
    }

    const job = await ctx.db.get(args.jobId);

    // Verify ownership
    if (!job || job.userId !== identity.subject) {
      const error = `[${ErrorCode.UNAUTHORIZED}] User ${identity.subject} unauthorized to dismiss job ${args.jobId}`;
      console.error(error);
      throw new Error(error);
    }

    // For now, we'll just let the query filter handle this
    // In future, could add an "acknowledged" field
    // await ctx.db.patch(args.jobId, { acknowledged: true });
  },
});
