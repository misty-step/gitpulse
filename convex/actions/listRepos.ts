"use node";

/**
 * List Repositories Action
 *
 * Wraps GitHub API calls to list repositories for users or organizations.
 * Must be an action (not mutation) because it makes external API calls.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { listUserRepositories, listOrgRepositories } from "../lib/github";

/**
 * List all repositories for a GitHub user or organization
 *
 * @param scopeType - "user" or "org"
 * @param identifier - GitHub username or organization name
 * @returns Array of repository full names (e.g., ["facebook/react", "vercel/next.js"])
 */
export const listReposForScope = action({
  args: {
    scopeType: v.union(v.literal("user"), v.literal("org")),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const { scopeType, identifier } = args;

    // Get GitHub token from Convex environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token not configured in Convex environment");
    }

    // Call appropriate GitHub API helper
    const repos =
      scopeType === "user"
        ? await listUserRepositories(githubToken, identifier)
        : await listOrgRepositories(githubToken, identifier);

    // Return array of full names for batch ingestion
    return repos.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      description: r.description,
      isPrivate: r.private,
    }));
  },
});
