/**
 * GraphQL queries and fragments for GitHub API
 *
 * These queries are optimized for fetching commit data from multiple repositories
 * while minimizing API calls and tracking rate limits
 */

/**
 * Fragment for commit history fields
 * Reusable fragment that includes all necessary commit data
 */
export const COMMIT_HISTORY_FRAGMENT = `
  fragment CommitHistoryFields on CommitHistoryConnection {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      oid
      committedDate
      message
      messageHeadline
      messageBody
      author {
        name
        email
        user {
          login
          id
        }
      }
      committer {
        name
        email
        user {
          login
          id
        }
      }
      repository {
        nameWithOwner
        id
      }
    }
  }
`;

/**
 * Query to convert repository owner/name pairs to node IDs
 * Supports batching up to 50 repositories in a single query
 *
 * @example
 * const variables = {
 *   repos: [
 *     { owner: "facebook", name: "react" },
 *     { owner: "vercel", name: "next.js" }
 *   ]
 * }
 */
export const REPOSITORY_NODE_ID_QUERY = `
  query GetRepositoryNodeIds($repos: [RepositoryInput!]!) {
    rateLimit {
      cost
      remaining
      resetAt
    }
    repositories: nodes(ids: []) {
      ... on Repository {
        id
      }
    }
  }
`;

/**
 * Dynamic query builder for repository node IDs
 * GitHub GraphQL doesn't support dynamic field names, so we need to build the query dynamically
 *
 * @param repos Array of {owner: string, name: string} objects
 * @returns GraphQL query string
 */
export function buildRepositoryNodeIdQuery(repos: Array<{ owner: string; name: string }>): string {
  const repoQueries = repos
    .map((repo, index) => {
      const safeAlias = `repo${index}`;
      return `${safeAlias}: repository(owner: "${repo.owner}", name: "${repo.name}") {
        id
        nameWithOwner
        defaultBranchRef {
          name
        }
      }`;
    })
    .join('\n    ');

  return `
    query GetRepositoryNodeIds {
      rateLimit {
        cost
        remaining
        resetAt
      }
      ${repoQueries}
    }
  `;
}

/**
 * Query to fetch commit history for multiple repositories
 * Supports batching and pagination
 *
 * @example
 * const variables = {
 *   since: "2024-01-01T00:00:00Z",
 *   until: "2024-01-31T23:59:59Z",
 *   first: 100,
 *   author: { emails: ["user@example.com"] }
 * }
 */
export const BATCH_COMMITS_QUERY = `
  query BatchCommitHistory(
    $nodeIds: [ID!]!
    $since: GitTimestamp!
    $until: GitTimestamp!
    $first: Int = 100
    $after: String
    $author: CommitAuthor
  ) {
    rateLimit {
      cost
      remaining
      resetAt
      nodeCount
    }
    nodes(ids: $nodeIds) {
      ... on Repository {
        id
        nameWithOwner
        defaultBranchRef {
          target {
            ... on Commit {
              history(
                since: $since
                until: $until
                first: $first
                after: $after
                author: $author
              ) {
                ...CommitHistoryFields
              }
            }
          }
        }
      }
    }
  }
  ${COMMIT_HISTORY_FRAGMENT}
`;

/**
 * Dynamic query builder for batch commit fetching
 * Creates a query with repository-specific aliases for better error handling
 *
 * @param repoCount Number of repositories to query
 * @returns GraphQL query string
 */
export function buildBatchCommitsQuery(repoCount: number): string {
  const repoQueries: string[] = [];

  for (let i = 0; i < repoCount; i++) {
    repoQueries.push(`
      repo${i}: node(id: $nodeId${i}) {
        ... on Repository {
          id
          nameWithOwner
          defaultBranchRef {
            target {
              ... on Commit {
                history(
                  since: $since
                  until: $until
                  first: $first
                  after: $after${i}
                  author: $author
                ) {
                  ...CommitHistoryFields
                }
              }
            }
          }
        }
      }
    `);
  }

  const variableDefinitions = [
    ...Array(repoCount).fill(0).map((_, i) => `$nodeId${i}: ID!`),
    ...Array(repoCount).fill(0).map((_, i) => `$after${i}: String`),
    '$since: GitTimestamp!',
    '$until: GitTimestamp!',
    '$first: Int = 100',
    '$author: CommitAuthor',
  ].join(', ');

  return `
    query BatchCommitHistory(${variableDefinitions}) {
      rateLimit {
        cost
        remaining
        resetAt
        nodeCount
      }
      ${repoQueries.join('\n')}
    }
    ${COMMIT_HISTORY_FRAGMENT}
  `;
}

/**
 * Query to fetch a single repository's commit history with pagination
 * Used for repositories with more commits than can be fetched in batch queries
 */
export const SINGLE_REPO_COMMITS_QUERY = `
  query SingleRepoCommitHistory(
    $owner: String!
    $name: String!
    $since: GitTimestamp!
    $until: GitTimestamp!
    $first: Int = 100
    $after: String
    $author: CommitAuthor
  ) {
    rateLimit {
      cost
      remaining
      resetAt
    }
    repository(owner: $owner, name: $name) {
      id
      nameWithOwner
      defaultBranchRef {
        target {
          ... on Commit {
            history(
              since: $since
              until: $until
              first: $first
              after: $after
              author: $author
            ) {
              ...CommitHistoryFields
            }
          }
        }
      }
    }
  }
  ${COMMIT_HISTORY_FRAGMENT}
`;

/**
 * Query to check rate limit status without fetching other data
 * Useful for monitoring and deciding when to pause/resume operations
 */
export const RATE_LIMIT_CHECK_QUERY = `
  query CheckRateLimit {
    rateLimit {
      cost
      limit
      remaining
      resetAt
      nodeCount
      used
    }
  }
`;

/**
 * Query to validate repository access
 * Checks if the authenticated user has access to specified repositories
 */
export const VALIDATE_REPOSITORY_ACCESS_QUERY = `
  query ValidateRepositoryAccess($owner: String!, $name: String!) {
    rateLimit {
      cost
      remaining
      resetAt
    }
    repository(owner: $owner, name: $name) {
      id
      nameWithOwner
      isPrivate
      viewerPermission
      viewerCanAdminister
    }
  }
`;

/**
 * Helper function to format date for GitHub GraphQL API
 * @param date JavaScript Date object or ISO string
 * @returns ISO 8601 formatted date string
 */
export function formatGitHubDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Helper to build author filter for commit queries
 * @param author Author email or GitHub username
 * @returns CommitAuthor object for GraphQL query
 */
export function buildAuthorFilter(author?: string): { emails?: string[] } | undefined {
  if (!author) return undefined;

  // Check if it's an email
  if (author.includes('@')) {
    return { emails: [author] };
  }

  // For GitHub usernames, we'll need to resolve them separately
  // as the GraphQL API doesn't support filtering by username directly
  return undefined;
}

/**
 * Type definitions for query responses
 */
export interface RateLimitInfo {
  cost: number;
  remaining: number;
  resetAt: string;
  limit?: number;
  used?: number;
  nodeCount?: number;
}

export interface CommitNode {
  oid: string;
  committedDate: string;
  message: string;
  messageHeadline: string;
  messageBody: string;
  author: {
    name: string | null;
    email: string | null;
    user: {
      login: string;
      id: string;
    } | null;
  };
  committer: {
    name: string | null;
    email: string | null;
    user: {
      login: string;
      id: string;
    } | null;
  };
  repository: {
    nameWithOwner: string;
    id: string;
  };
}

export interface CommitHistoryConnection {
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  nodes: CommitNode[];
}

export interface RepositoryNode {
  id: string;
  nameWithOwner: string;
  defaultBranchRef: {
    target: {
      history: CommitHistoryConnection;
    };
  } | null;
}