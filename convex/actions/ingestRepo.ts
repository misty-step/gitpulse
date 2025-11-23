"use node";

/**
 * GitHub Repository Ingestion Action
 *
 * Fetches GitHub activity (PRs, commits, reviews) and stores in Convex.
 * Runs as a serverless action with GitHub API access.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import {
  backfillPRs,
  listReviews,
  listCommits,
  getRepository,
} from "../lib/github";
import type { IngestionResult } from "../lib/types";

/**
 * Ingest a GitHub repository
 *
 * Workflow:
 * 1. Fetch repository metadata
 * 2. Upsert repository record
 * 3. Fetch pull requests since date
 * 4. Fetch commits since date
 * 5. Fetch reviews for each PR
 * 6. Store events in database
 * 7. Trigger embedding generation (future)
 *
 * @param repoFullName - Repository full name (e.g., "facebook/react")
 * @param sinceISO - ISO date string to fetch activity since (e.g., "2025-01-01")
 * @returns Ingestion statistics
 */
export const ingestRepository = action({
  args: {
    repoFullName: v.string(),
    sinceISO: v.string(),
  },
  handler: async (ctx, args): Promise<IngestionResult> => {
    const { repoFullName, sinceISO } = args;

    // Get GitHub token from Convex environment variable
    const githubToken = process.env.GITHUB_TOKEN!;

    // 1. Fetch repository metadata
    const repoData = await getRepository(githubToken, repoFullName);

    // 2. Upsert repository record
    const repoId = await ctx.runMutation(api.repos.upsert, {
      ghId: repoData.id,
      ghNodeId: repoData.node_id,
      fullName: repoData.full_name,
      name: repoData.name,
      owner: repoData.owner.login,
      description: repoData.description ?? undefined,
      url: repoData.html_url,
      homepage: repoData.homepage ?? undefined,
      language: repoData.language ?? undefined,
      isPrivate: repoData.private,
      isFork: repoData.fork,
      isArchived: repoData.archived,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      watchers: repoData.watchers_count,
      size: 0, // GitHub doesn't return size in basic API
      ghCreatedAt: new Date(repoData.created_at).getTime(),
      ghUpdatedAt: new Date(repoData.updated_at).getTime(),
      ghPushedAt: new Date(repoData.pushed_at).getTime(),
    });

    // 3. Fetch pull requests
    const prs = await backfillPRs(githubToken, repoFullName, sinceISO);

    let prsIngested = 0;
    let reviewsIngested = 0;

    // Process each PR
    for (const pr of prs) {
      // Upsert PR author as user
      const actorId = await ctx.runMutation(api.users.upsert, {
        ghId: pr.user.id,
        ghLogin: pr.user.login,
        ghNodeId: pr.user.node_id,
      });

      // Create PR opened event
      await ctx.runMutation(api.events.create, {
        type: "pr_opened",
        ghId: pr.id.toString(),
        ghNodeId: pr.node_id,
        actorId,
        repoId,
        ts: new Date(pr.created_at).getTime(),
        metadata: {
          prNumber: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files,
        },
      });
      prsIngested++;

      // Fetch reviews for this PR
      const reviews = await listReviews(githubToken, repoFullName, pr.number);

      for (const review of reviews) {
        // Upsert reviewer as user
        const reviewerId = await ctx.runMutation(api.users.upsert, {
          ghId: review.user.id,
          ghLogin: review.user.login,
          ghNodeId: review.user.node_id,
        });

        // Create review event
        await ctx.runMutation(api.events.create, {
          type: "review",
          ghId: review.id.toString(),
          ghNodeId: review.node_id,
          actorId: reviewerId,
          repoId,
          ts: new Date(review.submitted_at).getTime(),
          metadata: {
            prNumber: pr.number,
            state: review.state,
            body: review.body,
            url: review.html_url,
          },
        });
        reviewsIngested++;
      }
    }

    // 4. Fetch commits
    const commits = await listCommits(githubToken, repoFullName, sinceISO);

    let commitsIngested = 0;

    for (const commit of commits) {
      // Skip commits without author (GitHub system commits)
      if (!commit.author) continue;

      // Upsert commit author as user
      const actorId = await ctx.runMutation(api.users.upsert, {
        ghId: commit.author.id,
        ghLogin: commit.author.login,
        ghNodeId: commit.author.node_id,
      });

      // Create commit event
      await ctx.runMutation(api.events.create, {
        type: "commit",
        ghId: commit.sha,
        ghNodeId: commit.node_id,
        actorId,
        repoId,
        ts: new Date(commit.commit.author.date).getTime(),
        metadata: {
          sha: commit.sha,
          message: commit.commit.message,
          url: commit.html_url,
          additions: commit.stats?.additions,
          deletions: commit.stats?.deletions,
        },
      });
      commitsIngested++;
    }

    return {
      success: true,
      repository: repoFullName,
      since: sinceISO,
      stats: {
        prsIngested,
        reviewsIngested,
        commitsIngested,
        totalEvents: prsIngested + reviewsIngested + commitsIngested,
      },
    };
  },
});
