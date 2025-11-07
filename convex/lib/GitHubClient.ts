/**
 * GitHubClient - Deep module for GitHub API access
 *
 * Deep module pattern (Ousterhout):
 * - Simple interface: forUser(), fetch(), listAllRepos(), getUserEvents()
 * - Complex implementation: Token management, refresh, pagination, rate limiting
 *
 * Information hiding:
 * - Encapsulates token retrieval, decryption, refresh logic
 * - Encapsulates GitHub API request formatting
 * - Encapsulates pagination and error handling
 * - Callers don't know about token expiry, refresh tokens, or API details
 *
 * Usage:
 *   const github = await GitHubClient.forUser(ctx, userId);
 *   const repos = await github.listAllRepos();
 *   const events = await github.getUserEvents(sinceDate);
 */

import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

export class GitHubClient {
  /**
   * Private constructor - use GitHubClient.forUser() instead
   */
  private constructor(
    private ctx: ActionCtx,
    private user: Doc<"users">,
    private accessToken: string
  ) {}

  /**
   * Create GitHubClient for a user
   *
   * Handles token retrieval and automatic refresh if expired.
   * Throws if user hasn't connected GitHub account.
   */
  static async forUser(ctx: ActionCtx, userId: string): Promise<GitHubClient> {
    // Get user from database
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: userId });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!user.githubAccessToken) {
      throw new Error("GitHub not connected. User must authorize via OAuth first.");
    }

    // Check token expiry
    if (user.githubTokenExpiry && user.githubTokenExpiry < Date.now()) {
      // Token expired - refresh it
      const newToken = await this.refreshToken(ctx, user);
      return new GitHubClient(ctx, user, newToken);
    }

    return new GitHubClient(ctx, user, user.githubAccessToken);
  }

  /**
   * Refresh expired GitHub access token
   *
   * Uses refresh token to get new access token from GitHub.
   * Updates token in database via mutation.
   */
  private static async refreshToken(
    ctx: ActionCtx,
    user: Doc<"users">
  ): Promise<string> {
    if (!user.githubRefreshToken) {
      throw new Error(
        "Cannot refresh token - no refresh token available. User must re-authorize."
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth not configured - missing credentials");
    }

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.githubRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh GitHub token: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub token refresh error: ${data.error_description || data.error}`);
    }

    const { access_token, expires_in } = data;

    // Update token in database
    if (user.clerkId) {
      await ctx.runMutation(api.users.updateGitHubAuth, {
        clerkId: user.clerkId,
        githubAccessToken: access_token,
        githubRefreshToken: user.githubRefreshToken,
        githubTokenExpiry: Date.now() + expires_in * 1000,
        githubUsername: user.githubUsername ?? user.ghLogin,
        githubProfile: {
          id: user.ghId,
          login: user.ghLogin,
          nodeId: user.ghNodeId,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          avatarUrl: user.avatarUrl ?? undefined,
          bio: user.bio ?? undefined,
          company: user.company ?? undefined,
          location: user.location ?? undefined,
          blog: user.blog ?? undefined,
          twitterUsername: user.twitterUsername ?? undefined,
          publicRepos: user.publicRepos ?? undefined,
          publicGists: user.publicGists ?? undefined,
          followers: user.followers ?? undefined,
          following: user.following ?? undefined,
        },
      });
    }

    return access_token;
  }

  /**
   * Make authenticated GitHub API request
   *
   * Automatically adds authorization header and GitHub API version header.
   */
  async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = path.startsWith("http") ? path : `https://api.github.com${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response;
  }

  /**
   * List all repositories accessible to the user
   *
   * Fetches repos where user is owner, collaborator, or organization member.
   * Handles pagination automatically to return complete list.
   *
   * @returns Array of GitHub repository objects
   */
  async listAllRepos(): Promise<any[]> {
    const repos: any[] = [];
    let page = 1;

    while (true) {
      const response = await this.fetch(
        `/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=updated&direction=desc`
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const batch = await response.json();

      if (batch.length === 0) {
        break; // No more repos
      }

      repos.push(...batch);
      page++;

      // Safety limit - GitHub caps at 300 repos per user in practice
      if (page > 50) {
        console.warn("GitHubClient: Hit pagination safety limit (5000 repos)");
        break;
      }
    }

    return repos;
  }

  /**
   * Get user's GitHub activity events
   *
   * Fetches events from /users/{username}/events endpoint.
   * GitHub limits to 300 events max, ~30 days history.
   *
   * @param since Optional date to filter events (only return events after this date)
   * @returns Array of GitHub event objects
   */
  async getUserEvents(since?: Date): Promise<any[]> {
    if (!this.user.githubUsername) {
      throw new Error("User missing githubUsername - cannot fetch events");
    }

    const events: any[] = [];
    let page = 1;

    // GitHub API: /users/{username}/events returns max 300 events, 30 days
    while (page <= 10) {
      // Max 10 pages = 1000 events (well above GitHub's 300 limit)
      const response = await this.fetch(
        `/users/${this.user.githubUsername}/events?per_page=100&page=${page}`
      );

      if (!response.ok) {
        // 404 is acceptable - user may have no public events
        if (response.status === 404) {
          break;
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const batch = await response.json();

      if (batch.length === 0) {
        break; // No more events
      }

      // Filter by date if since provided
      const filtered = since
        ? batch.filter((e: any) => new Date(e.created_at) >= since)
        : batch;

      events.push(...filtered);

      // Stop early if we've gone past the since date
      if (since && filtered.length < batch.length) {
        break;
      }

      page++;
    }

    return events;
  }

  /**
   * Get repository details by full name (owner/repo)
   */
  async getRepository(fullName: string): Promise<any> {
    const response = await this.fetch(`/repos/${fullName}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch repository ${fullName}: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }
}
