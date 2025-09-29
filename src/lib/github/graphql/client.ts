/**
 * GitHub GraphQL API client
 *
 * Provides a client for interacting with GitHub's GraphQL API
 * with proper authentication and headers for rate limit optimization
 */

import { GraphQLClient } from 'graphql-request';
import { logger } from '../../logger';

const MODULE_NAME = 'github:graphql:client';

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