/**
 * GitHub GraphQL API client
 *
 * Provides a client for interacting with GitHub's GraphQL API
 * with proper authentication and headers for rate limit optimization
 */

import { GraphQLClient } from 'graphql-request';
import { logger } from '../../logger';
import { buildRepositoryNodeIdQuery, buildBatchCommitsQuery, buildAuthorFilter, formatGitHubDate, type CommitNode, type RepositoryNode } from './queries';
import type { Commit } from '../types';
import { transformGraphQLCommit } from './transformers';

const MODULE_NAME = 'github:graphql:client';

// Cache for repository IDs with TTL
interface CacheEntry {
  value: string;
  expiresAt: number;
}

const repositoryIdCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export class GitHubGraphQLClient {
  private client: GraphQLClient;
  private accessToken: string;

  /**
   * Creates a new GitHub GraphQL client
   * @param accessToken GitHub OAuth access token or GitHub App installation token
   */
  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('GitHub access token is required');
    }

    this.accessToken = accessToken;

    // Configure client with GitHub GraphQL endpoint
    this.client = new GraphQLClient('https://api.github.com/graphql', {
      headers: {
        // Add authorization header with Bearer token
        'Authorization': `Bearer ${accessToken}`,
        // Add X-Github-Next-Global-ID header for new ID format support
        // This header enables the new global node ID format in GitHub's GraphQL API
        'X-Github-Next-Global-ID': '1',
        // Standard headers
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    logger.debug(MODULE_NAME, 'GitHub GraphQL client initialized', {
      endpoint: 'https://api.github.com/graphql',
      hasToken: true,
      headers: ['Authorization', 'X-Github-Next-Global-ID'],
    });
  }

  /**
   * Execute a GraphQL query
   * @param query The GraphQL query string
   * @param variables Optional variables for the query
   * @returns The query response
   */
  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      logger.debug(MODULE_NAME, 'Executing GraphQL query', {
        queryLength: query.length,
        hasVariables: !!variables,
      });

      const response = await this.client.request<T>(query, variables);

      logger.debug(MODULE_NAME, 'GraphQL query successful', {
        responseKeys: Object.keys(response || {}),
      });

      return response;
    } catch (error: any) {
      logger.error(MODULE_NAME, 'GraphQL query failed', {
        error: error.message,
        statusCode: error.response?.status,
        errors: error.response?.errors,
      });

      // Check for rate limit errors
      if (error.response?.status === 403 || error.response?.status === 429) {
        logger.warn(MODULE_NAME, 'Rate limit detected in GraphQL API', {
          remaining: error.response?.headers?.['x-ratelimit-remaining'],
          reset: error.response?.headers?.['x-ratelimit-reset'],
        });
      }

      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation
   * @param mutation The GraphQL mutation string
   * @param variables Optional variables for the mutation
   * @returns The mutation response
   */
  async mutate<T = any>(mutation: string, variables?: Record<string, any>): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  /**
   * Get the current rate limit status
   * @returns Rate limit information from GitHub's GraphQL API
   */
  async getRateLimit(): Promise<{
    cost: number;
    remaining: number;
    resetAt: string;
  }> {
    const query = `
      query GetRateLimit {
        rateLimit {
          cost
          remaining
          resetAt
        }
      }
    `;

    const response = await this.query<{
      rateLimit: {
        cost: number;
        remaining: number;
        resetAt: string;
      };
    }>(query);

    return response.rateLimit;
  }

  /**
   * Resolve repository names to GraphQL node IDs
   * @param repos Array of repository names in "owner/name" format
   * @returns Map of repository full name to node ID
   */
  async resolveRepositoryIds(repos: string[]): Promise<Map<string, string>> {
    if (!repos || repos.length === 0) {
      return new Map();
    }

    const results = new Map<string, string>();
    const uncachedRepos: Array<{ owner: string; name: string; fullName: string }> = [];
    const now = Date.now();

    // Check cache first
    for (const repo of repos) {
      const cached = repositoryIdCache.get(repo);
      if (cached && cached.expiresAt > now) {
        results.set(repo, cached.value);
        logger.debug(MODULE_NAME, `Repository ID cache hit for ${repo}`);
      } else {
        // Parse repository string
        const parts = repo.split('/');
        if (parts.length !== 2) {
          logger.warn(MODULE_NAME, `Invalid repository format: ${repo}`);
          continue;
        }
        const [owner, name] = parts;
        uncachedRepos.push({ owner, name, fullName: repo });
      }
    }

    // If all were cached, return early
    if (uncachedRepos.length === 0) {
      logger.debug(MODULE_NAME, `All ${repos.length} repository IDs found in cache`);
      return results;
    }

    logger.debug(MODULE_NAME, `Fetching ${uncachedRepos.length} repository IDs from GitHub`);

    // Batch repositories in groups of 50 (GitHub's limit)
    const batchSize = 50;
    for (let i = 0; i < uncachedRepos.length; i += batchSize) {
      const batch = uncachedRepos.slice(i, i + batchSize);

      // Build dynamic query for this batch
      const query = buildRepositoryNodeIdQuery(batch);

      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 1000; // 1 second

      while (attempts < maxAttempts) {
        attempts++;
        try {
          logger.debug(MODULE_NAME, `Fetching batch ${Math.floor(i / batchSize) + 1}, attempt ${attempts}`);

          const response = await this.query<any>(query);

          // Process response and extract repository IDs
          for (let j = 0; j < batch.length; j++) {
            const repoAlias = `repo${j}`;
            const repoData = response[repoAlias];

            if (repoData && repoData.id) {
              const fullName = batch[j].fullName;
              const nodeId = repoData.id;

              // Add to results
              results.set(fullName, nodeId);

              // Add to cache
              repositoryIdCache.set(fullName, {
                value: nodeId,
                expiresAt: Date.now() + CACHE_TTL,
              });

              logger.debug(MODULE_NAME, `Resolved ${fullName} to ${nodeId}`);
            } else {
              // Repository returned null (private, deleted, or doesn't exist)
              logger.warn(MODULE_NAME, `Repository not accessible: ${batch[j].fullName}`);
            }
          }

          // Success - break out of retry loop
          break;
        } catch (error: any) {
          logger.error(MODULE_NAME, `Failed to fetch repository IDs (attempt ${attempts}/${maxAttempts})`, {
            error: error.message,
            batch: batch.map(r => r.fullName),
          });

          // If this was the last attempt, throw the error
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to resolve repository IDs after ${maxAttempts} attempts: ${error.message}`);
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // Add a small delay between batches to be respectful of rate limits
      if (i + batchSize < uncachedRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(MODULE_NAME, `Resolved ${results.size} repository IDs from ${repos.length} requested`);
    return results;
  }

  /**
   * Fetch commits from multiple repositories using GraphQL
   * @param nodeIds Array of repository node IDs
   * @param since Start date in ISO 8601 format
   * @param until End date in ISO 8601 format
   * @param author Optional author filter (email or username)
   * @returns Array of commits from all repositories
   */
  async fetchCommitsGraphQL(
    nodeIds: string[],
    since: string,
    until: string,
    author?: string
  ): Promise<Commit[]> {
    if (!nodeIds || nodeIds.length === 0) {
      return [];
    }

    const startTime = Date.now();
    logger.debug(MODULE_NAME, `Fetching commits from ${nodeIds.length} repositories`, {
      since,
      until,
      author,
    });

    const allCommits: Commit[] = [];
    const batchSize = 50;

    // Format dates for GitHub GraphQL API
    const formattedSince = formatGitHubDate(since);
    const formattedUntil = formatGitHubDate(until);
    const authorFilter = buildAuthorFilter(author);

    // Process repositories in batches of 50
    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      logger.debug(MODULE_NAME, `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(nodeIds.length / batchSize)}`);

      // Build query for this batch
      const query = buildBatchCommitsQuery(batch.length);

      // Build variables object
      const variables: Record<string, any> = {
        since: formattedSince,
        until: formattedUntil,
        first: 100,
        author: authorFilter,
      };

      // Add node IDs
      batch.forEach((nodeId, index) => {
        variables[`nodeId${index}`] = nodeId;
        variables[`after${index}`] = null; // Initial cursor
      });

      try {
        const response = await this.query<any>(query, variables);

        // Extract commits from response
        for (let j = 0; j < batch.length; j++) {
          const repoAlias = `repo${j}`;
          const repoData: RepositoryNode | null = response[repoAlias];

          if (!repoData || !repoData.defaultBranchRef) {
            logger.warn(MODULE_NAME, `Repository ${batch[j]} has no default branch or no commits`);
            continue;
          }

          const history = repoData.defaultBranchRef.target?.history;
          if (!history || !history.nodes) {
            continue;
          }

          // Transform commits to match existing Commit interface
          const commits = history.nodes.map(node =>
            transformGraphQLCommit(node, repoData.nameWithOwner)
          );

          allCommits.push(...commits);

          // Handle pagination if there are more commits
          if (history.pageInfo.hasNextPage && history.pageInfo.endCursor) {
            const paginatedCommits = await this.fetchPaginatedCommits(
              batch[j],
              formattedSince,
              formattedUntil,
              history.pageInfo.endCursor,
              authorFilter
            );
            allCommits.push(...paginatedCommits);
          }
        }

        // Log rate limit info from response
        if (response.rateLimit) {
          logger.debug(MODULE_NAME, 'Rate limit status', {
            cost: response.rateLimit.cost,
            remaining: response.rateLimit.remaining,
            resetAt: response.rateLimit.resetAt,
          });
        }
      } catch (error: any) {
        logger.error(MODULE_NAME, `Failed to fetch commits for batch ${Math.floor(i / batchSize) + 1}`, {
          error: error.message,
          batch,
        });
        throw error;
      }

      // Add delay between batches to be respectful of rate limits
      if (i + batchSize < nodeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    logger.info(MODULE_NAME, `Fetched ${allCommits.length} commits from ${nodeIds.length} repositories in ${duration}ms`);

    return allCommits;
  }

  /**
   * Fetch paginated commits for a single repository
   * @private
   */
  private async fetchPaginatedCommits(
    nodeId: string,
    since: string,
    until: string,
    cursor: string,
    authorFilter?: { emails?: string[] }
  ): Promise<Commit[]> {
    const commits: Commit[] = [];
    let currentCursor: string | null = cursor;
    let pageCount = 0;

    while (currentCursor && pageCount < 100) { // Safety limit of 100 pages
      pageCount++;

      const query = buildBatchCommitsQuery(1);
      const variables: Record<string, any> = {
        nodeId0: nodeId,
        after0: currentCursor,
        since,
        until,
        first: 100,
        author: authorFilter,
      };

      try {
        const response: any = await this.query<any>(query, variables);
        const repoData: RepositoryNode | null = response.repo0;

        if (!repoData || !repoData.defaultBranchRef) {
          break;
        }

        const history: any = repoData.defaultBranchRef.target?.history;
        if (!history || !history.nodes || history.nodes.length === 0) {
          break;
        }

        // Transform and add commits
        const pageCommits = history.nodes.map((node: CommitNode) =>
          transformGraphQLCommit(node, repoData.nameWithOwner)
        );
        commits.push(...pageCommits);

        logger.debug(MODULE_NAME, `Fetched page ${pageCount} with ${pageCommits.length} commits for ${repoData.nameWithOwner}`);

        // Check if there are more pages
        if (history.pageInfo.hasNextPage && history.pageInfo.endCursor) {
          currentCursor = history.pageInfo.endCursor;
        } else {
          break;
        }
      } catch (error: any) {
        logger.error(MODULE_NAME, `Failed to fetch paginated commits at page ${pageCount}`, {
          error: error.message,
          nodeId,
        });
        break; // Stop pagination on error
      }
    }

    logger.debug(MODULE_NAME, `Fetched ${commits.length} additional commits across ${pageCount} pages`);
    return commits;
  }

  /**
   * Clear the repository ID cache
   */
  clearRepositoryIdCache(): void {
    repositoryIdCache.clear();
    logger.debug(MODULE_NAME, 'Repository ID cache cleared');
  }

  /**
   * Update the access token (useful for token refresh scenarios)
   * @param newAccessToken The new access token to use
   */
  updateAccessToken(newAccessToken: string) {
    if (!newAccessToken) {
      throw new Error('New access token is required');
    }

    this.accessToken = newAccessToken;

    // Recreate client with new token
    this.client = new GraphQLClient('https://api.github.com/graphql', {
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
        'X-Github-Next-Global-ID': '1',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    logger.debug(MODULE_NAME, 'Access token updated');
  }
}

/**
 * Factory function to create a GitHub GraphQL client
 * @param accessToken GitHub OAuth access token or GitHub App installation token
 * @returns A configured GitHubGraphQLClient instance
 */
export function createGitHubGraphQLClient(accessToken: string): GitHubGraphQLClient {
  return new GitHubGraphQLClient(accessToken);
}