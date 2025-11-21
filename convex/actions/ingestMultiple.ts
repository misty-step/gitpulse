"use node";

/**
 * Multiple Repository Ingestion Action
 *
 * Ingests multiple GitHub repositories in sequence with progress tracking.
 * Reuses existing ingestRepository action for each repo.
 * Creates an ingestionJob record to track progress in real-time.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { BatchIngestionResult, ErrorCode } from "../lib/types";
import { logger } from "../lib/logger.js";

/**
 * Ingest multiple GitHub repositories sequentially
 *
 * Workflow:
 * 1. Create ingestionJob record
 * 2. Iterate through array of repository full names
 * 3. Call ingestRepository for each one
 * 4. Update progress after each repo
 * 5. Mark job complete/failed
 * 6. Return aggregate statistics
 *
 * @param repoFullNames - Array of repository full names (e.g., ["facebook/react", "vercel/next.js"])
 * @param sinceISO - ISO date string to fetch activity since (e.g., "2025-01-01")
 * @param metadata - Optional metadata (username, org name, etc.)
 * @returns Aggregate ingestion statistics with per-repo results and jobId
 */
export const ingestMultipleRepos = action({
  args: {
    repoFullNames: v.array(v.string()),
    sinceISO: v.string(),
    metadata: v.optional(v.any()), // { username, scopeType, totalRepos, etc. }
  },
  handler: async (ctx, args): Promise<BatchIngestionResult> => {
    const { repoFullNames, sinceISO, metadata } = args;

    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      const error = `[${ErrorCode.NOT_AUTHENTICATED}] User not authenticated for batch ingestion`;
      logger.error(error);
      throw new Error(error);
    }
    const userId = identity.subject;
    logger.info(
      { userId, repoCount: repoFullNames.length },
      "Starting batch ingestion for user",
    );

    // Create ingestion job record
    const jobId: Id<"ingestionJobs"> = await ctx.runMutation(
      internal.ingestionJobs.create,
      {
        userId,
        repoFullName: metadata?.username
          ? `batch:${metadata.username}`
          : `batch:${repoFullNames.length}-repos`,
        since: new Date(sinceISO).getTime(),
        status: "running",
        progress: 0,
      },
    );

    const results: {
      repoFullName: string;
      success: boolean;
      error?: string;
      stats?: any;
    }[] = [];

    let succeeded = 0;
    let failed = 0;
    let totalEvents = 0;

    try {
      // Process each repository sequentially
      for (let i = 0; i < repoFullNames.length; i++) {
        const repoFullName = repoFullNames[i];

        try {
          // Call existing ingestRepository action
          const result = await ctx.runAction(
            api.actions.ingestRepo.ingestRepository,
            {
              repoFullName,
              sinceISO,
            },
          );

          results.push({
            repoFullName,
            success: true,
            stats: result.stats,
          });

          succeeded++;
          totalEvents += result.stats?.totalEvents || 0;

          // Update progress after each repo
          const progress = Math.floor(((i + 1) / repoFullNames.length) * 100);
          await ctx.runMutation(internal.ingestionJobs.updateProgress, {
            jobId,
            progress,
            eventsIngested: totalEvents,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          results.push({
            repoFullName,
            success: false,
            error: errorMessage,
          });

          failed++;

          // Continue ingesting remaining repos even if one fails
          logger.error(
            { repoFullName, errorMessage },
            "Failed to ingest repository",
          );

          // Still update progress to show we've processed this repo
          const progress = Math.floor(((i + 1) / repoFullNames.length) * 100);
          await ctx.runMutation(internal.ingestionJobs.updateProgress, {
            jobId,
            progress,
            eventsIngested: totalEvents,
          });
        }
      }

      // Mark job as completed
      await ctx.runMutation(internal.ingestionJobs.complete, {
        jobId,
        eventsIngested: totalEvents,
      });

      return {
        jobId,
        total: repoFullNames.length,
        succeeded,
        failed,
        results,
      };
    } catch (error) {
      // Mark job as failed if entire batch fails
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.ingestionJobs.fail, {
        jobId,
        errorMessage,
      });

      throw error;
    }
  },
});
