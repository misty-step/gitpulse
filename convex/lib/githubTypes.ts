/**
 * GitHub Type Definitions
 *
 * Type-only exports for GitHub API structures.
 * Separated from githubApp.ts to avoid pulling in Node.js runtime dependencies
 * (jsonwebtoken) when only types are needed.
 */

export interface InstallationToken {
  token: string;
  expiresAt: number;
}

export interface RepoTimelineNode {
  __typename: "PullRequest" | "Issue";
  id: string;
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  url?: string;
  updatedAt?: string;
  actor?: {
    id?: number;
    login?: string;
    nodeId?: string;
  } | null;
}

export interface RateLimitInfo {
  remaining?: number;
  reset?: number;
}

export interface RepoTimelineResult {
  nodes: RepoTimelineNode[];
  endCursor?: string;
  hasNextPage: boolean;
  etag?: string | null;
  totalCount: number;
  rateLimit: RateLimitInfo;
  notModified?: boolean;
}

export interface FetchRepoTimelineArgs {
  token: string;
  repoFullName: string;
  sinceISO: string;
  untilISO?: string;
  cursor?: string;
  etag?: string;
}

export const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // refresh installation token 60s before expiry
export const MIN_BACKFILL_BUDGET = 100; // pause when fewer than 100 calls remain
