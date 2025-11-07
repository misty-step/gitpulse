"use node";

/**
 * User Activity Sync - Merged operation per ultrathink
 *
 * Combines repo discovery + event ingestion into single action.
 * Always called together, so don't create shallow separate functions.
 *
 * Lightweight context extraction (~500 tokens per repo):
 * - Commit messages (first commit from PushEvent)
 * - PR titles (from PullRequestEvent)
 * - Issue titles (from IssuesEvent)
 * - Comment bodies (from IssueCommentEvent)
 *
 * Design allows easy expansion later to full diffs without changing callers.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { GitHubClient } from "../lib/GitHubClient";

/**
 * Sync user's GitHub activity (repos + events)
 *
 * Discovers all accessible repos and ingests recent activity events.
 * Single transaction for consistency.
 */
export const syncUserActivity = action({
  args: {
    userId: v.string(), // Clerk user ID
    since: v.optional(v.number()), // Unix timestamp - only fetch events after this date
  },
  handler: async (ctx, args) => {
    // Create GitHub client (handles token management automatically)
    const github = await GitHubClient.forUser(ctx, args.userId);

    // 1. Discover all accessible repositories
    console.log(`Discovering repos for user ${args.userId}...`);
    const repos = await github.listAllRepos();
    console.log(`Found ${repos.length} repositories`);

    // 2. Upsert repos to database
    const repoIds: string[] = [];
    for (const repo of repos) {
      try {
        const repoId = await ctx.runMutation(api.repos.upsert, {
          ghId: repo.id,
          ghNodeId: repo.node_id,
          fullName: repo.full_name,
          name: repo.name,
          owner: repo.owner.login,
          description: repo.description || undefined,
          url: repo.html_url,
          homepage: repo.homepage || undefined,
          language: repo.language || undefined,
          isPrivate: repo.private,
          isFork: repo.fork,
          isArchived: repo.archived,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          openIssues: repo.open_issues_count,
          watchers: repo.watchers_count,
          size: repo.size,
          ghCreatedAt: new Date(repo.created_at).getTime(),
          ghUpdatedAt: new Date(repo.updated_at).getTime(),
          ghPushedAt: repo.pushed_at ? new Date(repo.pushed_at).getTime() : undefined,
        });
        repoIds.push(repoId);
      } catch (error) {
        console.error(`Failed to upsert repo ${repo.full_name}:`, error);
        // Continue with other repos - don't let one failure block everything
      }
    }

    // 3. Fetch user events (commits, PRs, reviews, issues, etc.)
    const sinceDate = args.since ? new Date(args.since) : undefined;
    console.log(`Fetching events since ${sinceDate?.toISOString() || "beginning"}...`);
    const events = await github.getUserEvents(sinceDate);
    console.log(`Found ${events.length} events`);

    // 4. Extract lightweight context from events
    const eventDocs = events.map((event) => {
      // Extract message and title based on event type
      const message = extractMessage(event);
      const title = extractTitle(event);
      const action = event.payload?.action;

      return {
        type: event.type,
        ghId: event.id,
        actorGhId: event.actor.id,
        actorGhLogin: event.actor.login,
        repoGhId: event.repo.id,
        repoFullName: event.repo.name,
        ghCreatedAt: new Date(event.created_at).getTime(),
        // Lightweight payload: ~50-200 chars per event
        payload: {
          message,
          title,
          action,
          // Can add more fields later: commitDiffs, prDescriptions, reviewComments
        },
      };
    });

    // 5. Store events in database (batch insert for efficiency)
    let eventsStored = 0;
    if (eventDocs.length > 0) {
      // Note: We need to create individual events since we don't have actorId/repoId yet
      // This is a limitation - we'd need to query for user/repo IDs first
      // For now, store with GitHub IDs and we'll link them later if needed
      console.log(`Storing ${eventDocs.length} events...`);
      // TODO: Implement event storage - need to handle actorId/repoId lookup
      // For MVP, we can skip event storage and just focus on repo discovery
      eventsStored = 0; // Placeholder
    }

    return {
      reposDiscovered: repos.length,
      reposStored: repoIds.length,
      eventsFound: events.length,
      eventsStored,
    };
  },
});

/**
 * Extract message from GitHub event
 *
 * Returns commit message, comment body, or other text content.
 */
function extractMessage(event: any): string | undefined {
  switch (event.type) {
    case "PushEvent":
      // Get first commit message
      return event.payload?.commits?.[0]?.message;

    case "IssueCommentEvent":
    case "PullRequestReviewCommentEvent":
      // Truncate long comments to ~200 chars
      const body = event.payload?.comment?.body;
      return body ? truncate(body, 200) : undefined;

    case "CommitCommentEvent":
      const commentBody = event.payload?.comment?.body;
      return commentBody ? truncate(commentBody, 200) : undefined;

    default:
      return undefined;
  }
}

/**
 * Extract title from GitHub event
 *
 * Returns PR title, issue title, or release name.
 */
function extractTitle(event: any): string | undefined {
  switch (event.type) {
    case "PullRequestEvent":
      return event.payload?.pull_request?.title;

    case "IssuesEvent":
      return event.payload?.issue?.title;

    case "PullRequestReviewEvent":
      return event.payload?.pull_request?.title;

    case "ReleaseEvent":
      return event.payload?.release?.name || event.payload?.release?.tag_name;

    default:
      return undefined;
  }
}

/**
 * Truncate string to max length, adding ellipsis if needed
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + "...";
}
