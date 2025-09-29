/**
 * Feature flag system for controlling experimental and opt-in features
 *
 * Feature flags allow gradual rollout and easy rollback of new features
 * without requiring code changes or deployments.
 */

/**
 * Check if GraphQL API is enabled for commit fetching
 *
 * When enabled, uses GitHub's GraphQL API which dramatically reduces
 * API calls (1 call per 50 repos vs 1 call per repo with REST).
 *
 * @returns true if GraphQL commits feature is enabled
 */
export function isGraphQLEnabled(): boolean {
  // Runtime check - can be toggled without restart
  const value = process.env.FEATURE_GRAPHQL_COMMITS;

  // Default to false for safety (opt-in feature)
  if (!value) {
    return false;
  }

  // Parse string to boolean
  return value.toLowerCase() === 'true';
}

/**
 * Get the GraphQL batch size for repository queries
 *
 * Controls how many repositories are queried in a single GraphQL request.
 * GitHub's limit is 50 nodes per query.
 *
 * @returns Batch size (default: 50)
 */
export function getGraphQLBatchSize(): number {
  const value = process.env.FEATURE_GRAPHQL_BATCH_SIZE;

  if (!value) {
    return 50; // Default batch size
  }

  const parsed = parseInt(value, 10);

  // Validate and clamp to GitHub's limits
  if (isNaN(parsed) || parsed < 1) {
    return 50;
  }

  // GitHub's maximum is 50 nodes per query
  return Math.min(parsed, 50);
}

/**
 * Get the GraphQL page size for commit pagination
 *
 * Controls how many commits are fetched per page when paginating
 * through commit history.
 *
 * @returns Page size (default: 100)
 */
export function getGraphQLPageSize(): number {
  const value = process.env.FEATURE_GRAPHQL_PAGE_SIZE;

  if (!value) {
    return 100; // Default page size
  }

  const parsed = parseInt(value, 10);

  // Validate and clamp to reasonable limits
  if (isNaN(parsed) || parsed < 1) {
    return 100;
  }

  // GitHub's recommended maximum is 100
  return Math.min(parsed, 100);
}

/**
 * Feature flag configuration object
 *
 * Useful for logging and debugging feature flag state
 */
export function getFeatureFlags() {
  return {
    graphqlCommits: isGraphQLEnabled(),
    graphqlBatchSize: getGraphQLBatchSize(),
    graphqlPageSize: getGraphQLPageSize(),
  };
}