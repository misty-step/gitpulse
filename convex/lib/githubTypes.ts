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

// ============================================================================
// GitHub Events API Types
// ============================================================================

/**
 * GitHub Event from /repos/{owner}/{repo}/events API
 *
 * This is the rich event stream that captures ALL repository activity:
 * commits, PRs, reviews, comments, releases, etc.
 */
export interface GitHubEvent {
  id: string;
  type: GitHubEventType;
  actor: {
    id: number;
    login: string;
    display_login?: string;
    gravatar_id?: string;
    avatar_url: string;
    url: string;
  };
  repo: {
    id: number;
    name: string; // "owner/repo" format
    url: string;
  };
  payload: GitHubEventPayload;
  public: boolean;
  created_at: string;
  org?: {
    id: number;
    login: string;
    avatar_url: string;
  };
}

/**
 * Event types we care about for activity tracking.
 * Other types (WatchEvent, ForkEvent, etc.) are ignored.
 */
export type GitHubEventType =
  | "PushEvent"
  | "PullRequestEvent"
  | "PullRequestReviewEvent"
  | "PullRequestReviewCommentEvent"
  | "IssueCommentEvent"
  | "IssuesEvent"
  | "CreateEvent"
  | "DeleteEvent"
  | "ReleaseEvent"
  | string; // Allow unknown types to pass through

/**
 * Union of all event payloads we handle.
 * Each event type has a different payload structure.
 */
export type GitHubEventPayload =
  | PushEventPayload
  | PullRequestEventPayload
  | PullRequestReviewEventPayload
  | IssueCommentEventPayload
  | IssuesEventPayload
  | CreateEventPayload
  | ReleaseEventPayload
  | Record<string, unknown>; // Fallback for unhandled types

export interface PushEventPayload {
  push_id?: number;
  size: number;
  distinct_size: number;
  ref: string;
  head: string;
  before: string;
  commits: Array<{
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    url: string;
    distinct: boolean;
  }>;
}

export interface PullRequestEventPayload {
  action: "opened" | "closed" | "reopened" | "edited" | "synchronize" | string;
  number: number;
  pull_request: {
    id: number;
    node_id: string;
    number: number;
    title: string;
    body?: string | null;
    state: string;
    html_url: string;
    user: { id: number; login: string; avatar_url: string };
    created_at: string;
    updated_at: string;
    closed_at?: string | null;
    merged_at?: string | null;
    merged?: boolean;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    base?: { ref: string };
    head?: { ref: string };
  };
}

export interface PullRequestReviewEventPayload {
  action: "submitted" | "edited" | "dismissed" | string;
  review: {
    id: number;
    node_id: string;
    user: { id: number; login: string; avatar_url: string };
    body?: string | null;
    state: "approved" | "changes_requested" | "commented" | "dismissed" | string;
    html_url: string;
    submitted_at: string;
  };
  pull_request: {
    number: number;
    html_url: string;
    title: string;
  };
}

export interface IssueCommentEventPayload {
  action: "created" | "edited" | "deleted" | string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    pull_request?: Record<string, unknown>; // Present if comment is on a PR
    state: string;
  };
  comment: {
    id: number;
    node_id: string;
    user: { id: number; login: string; avatar_url: string };
    body: string;
    html_url: string;
    created_at: string;
    updated_at: string;
  };
}

export interface IssuesEventPayload {
  action: "opened" | "closed" | "reopened" | "edited" | string;
  issue: {
    id: number;
    node_id: string;
    number: number;
    title: string;
    body?: string | null;
    state: string;
    html_url: string;
    user: { id: number; login: string; avatar_url: string };
    created_at: string;
    updated_at: string;
    closed_at?: string | null;
  };
}

export interface CreateEventPayload {
  ref: string | null;
  ref_type: "branch" | "tag" | "repository";
  master_branch?: string;
  description?: string | null;
}

export interface ReleaseEventPayload {
  action: "published" | "created" | "edited" | "deleted" | string;
  release: {
    id: number;
    node_id: string;
    tag_name: string;
    name?: string | null;
    body?: string | null;
    html_url: string;
    author: { id: number; login: string; avatar_url: string };
    created_at: string;
    published_at?: string | null;
    prerelease: boolean;
    draft: boolean;
  };
}

/**
 * Result from fetchRepoEvents - matches the existing pattern for timeline results.
 */
export interface RepoEventsResult {
  events: GitHubEvent[];
  hasNextPage: boolean;
  endCursor?: string; // Page number as string for consistency with existing code
  rateLimit: RateLimitInfo;
}

export interface FetchRepoEventsArgs {
  token: string;
  repoFullName: string;
  page?: number;
  perPage?: number;
}
