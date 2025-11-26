/**
 * Test Data Factories
 *
 * Reusable factory functions for creating test fixtures.
 * Pattern: Export factory functions with overrides parameter for customization.
 *
 * Usage:
 *   const user = createMockUser({ ghLogin: "alice" });
 *   const event = createMockEvent("pr_opened", { metadata: { prNumber: 123 } });
 */

import type { Id } from "../../convex/_generated/dataModel";
import type { ReportContext } from "../../convex/lib/reportContext";
import type { PromptPayload } from "../../convex/lib/prompts";

// ============================================================================
// Core Database Entities
// ============================================================================

/**
 * Creates a mock user document (users table)
 */
export function createMockUser(overrides?: Partial<{
  _id: Id<"users">;
  clerkId: string;
  tokenIdentifier: string;
  ghId: number;
  ghLogin: string;
  ghNodeId: string;
  name: string;
  email: string;
  avatarUrl: string;
  createdAt: number;
  updatedAt: number;
}>) {
  const now = Date.now();
  return {
    _id: "user_123" as Id<"users">,
    clerkId: "clerk_user_123",
    tokenIdentifier: "https://clerk.example.com#user_123",
    ghId: 1234567,
    ghLogin: "octocat",
    ghNodeId: "MDQ6VXNlcjEyMzQ1Njc=",
    name: "Test User",
    email: "octocat@github.com",
    avatarUrl: "https://avatars.githubusercontent.com/u/1234567",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a mock repository document (repos table)
 */
export function createMockRepo(overrides?: Partial<{
  _id: Id<"repos">;
  ghId: number;
  ghNodeId: string;
  fullName: string;
  name: string;
  owner: string;
  description: string;
  url: string;
  language: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stars: number;
  createdAt: number;
  updatedAt: number;
  ghCreatedAt: number;
  ghUpdatedAt: number;
}>) {
  const now = Date.now();
  return {
    _id: "repo_123" as Id<"repos">,
    ghId: 9876543,
    ghNodeId: "MDEwOlJlcG9zaXRvcnk5ODc2NTQz",
    fullName: "acme/test-repo",
    name: "test-repo",
    owner: "acme",
    description: "A test repository",
    url: "https://github.com/acme/test-repo",
    language: "TypeScript",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stars: 42,
    createdAt: now,
    updatedAt: now,
    ghCreatedAt: now - 86400000, // 1 day ago
    ghUpdatedAt: now - 3600000,  // 1 hour ago
    ...overrides,
  };
}

/**
 * Creates a mock event document (events table)
 */
export function createMockEvent(
  type: "pr_opened" | "pr_closed" | "pr_review" | "commit" | "issue_opened" | "issue_closed" | "issue_comment" | "pr_comment",
  overrides?: Partial<{
    _id: Id<"events">;
    ghId: string;
    ghNodeId: string;
    actorId: Id<"users">;
    repoId: Id<"repos">;
    ts: number;
    metadata: any;
    canonicalText: string;
    sourceUrl: string;
    metrics: { additions?: number; deletions?: number; filesChanged?: number };
    contentHash: string;
    contentScope: "event" | "timeslice";
    createdAt: number;
  }>,
) {
  const now = Date.now();

  // Default metadata based on event type
  const defaultMetadata = (() => {
    switch (type) {
      case "pr_opened":
        return {
          prNumber: 42,
          title: "Test PR",
          url: "https://github.com/acme/test-repo/pull/42",
          additions: 10,
          deletions: 5,
          changedFiles: 2,
        };
      case "commit":
        return {
          sha: "abc123def456",
          message: "feat: add new feature",
          url: "https://github.com/acme/test-repo/commit/abc123",
          additions: 20,
          deletions: 10,
          changedFiles: 3,
        };
      case "pr_review":
        return {
          prNumber: 42,
          state: "APPROVED",
          body: "LGTM!",
          url: "https://github.com/acme/test-repo/pull/42#pullrequestreview-123",
        };
      default:
        return {};
    }
  })();

  return {
    _id: `event_${type}_123` as Id<"events">,
    type,
    ghId: `gh_${type}_123`,
    ghNodeId: `node_${type}_123`,
    actorId: "user_123" as Id<"users">,
    repoId: "repo_123" as Id<"repos">,
    ts: now,
    metadata: defaultMetadata,
    canonicalText: `${type} event occurred`,
    sourceUrl: `https://github.com/acme/test-repo`,
    metrics: {
      additions: 10,
      deletions: 5,
      filesChanged: 2,
    },
    contentHash: `hash_${type}_123`,
    contentScope: "event" as const,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Creates a mock report document (reports table)
 */
export function createMockReport(overrides?: Partial<{
  _id: Id<"reports">;
  userId: string;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
  ghLogins: string[];
  markdown: string;
  html: string;
  citations: string[];
  promptVersion: string;
  provider: string;
  model: string;
  generatedAt: number;
  cacheKey: string;
  coverageScore: number;
}>) {
  const now = Date.now();
  const oneDayAgo = now - 86400000;

  return {
    _id: "report_123" as Id<"reports">,
    userId: "clerk_user_123",
    title: "Daily Standup - 2025-11-26",
    description: "Daily standup report",
    startDate: oneDayAgo,
    endDate: now,
    ghLogins: ["octocat"],
    markdown: "## Work Completed\n\n- Built feature X",
    html: "<h2>Work Completed</h2><ul><li>Built feature X</li></ul>",
    citations: ["https://github.com/acme/test-repo/pull/42"],
    promptVersion: "v1.0.0",
    provider: "google",
    model: "gemini-2.5-flash",
    generatedAt: now,
    cacheKey: "cache_key_123",
    coverageScore: 0.85,
    ...overrides,
  };
}

/**
 * Creates a mock installation document (installations table)
 */
export function createMockInstallation(overrides?: Partial<{
  _id: Id<"installations">;
  installationId: number;
  clerkUserId: string;
  repositories: string[];
  rateLimitRemaining: number;
  rateLimitReset: number;
  lastCursor?: string;
  etag?: string;
}>) {
  return {
    _id: "installation_123" as Id<"installations">,
    installationId: 12345,
    clerkUserId: "user_123",
    repositories: ["acme/test-repo"],
    rateLimitRemaining: 5000,
    rateLimitReset: Date.now() + 3600000, // 1 hour from now
    lastCursor: undefined,
    etag: undefined,
    ...overrides,
  };
}

// ============================================================================
// GitHub API Responses
// ============================================================================

/**
 * Creates a mock GitHub user payload (from GitHub API)
 */
export function createMockGitHubUser(overrides?: Partial<{
  id: number;
  login: string;
  node_id: string;
  avatar_url: string;
  name: string;
  email: string;
  bio: string;
  company: string;
  location: string;
  blog: string;
  twitter_username: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
}>) {
  return {
    id: 1234567,
    login: "octocat",
    node_id: "MDQ6VXNlcjEyMzQ1Njc=",
    avatar_url: "https://avatars.githubusercontent.com/u/1234567",
    name: "The Octocat",
    email: "octocat@github.com",
    bio: "GitHub's mascot",
    company: "@github",
    location: "San Francisco",
    blog: "https://github.blog",
    twitter_username: "github",
    public_repos: 10,
    public_gists: 5,
    followers: 100,
    following: 50,
    ...overrides,
  };
}

/**
 * Creates a mock GitHub webhook payload (for webhook tests)
 */
export function createMockWebhookPayload(
  action: "opened" | "closed" | "submitted" | "created",
  eventType: "pull_request" | "pull_request_review" | "push" | "issues",
  overrides?: any,
) {
  const basePayload = {
    action,
    sender: createMockGitHubUser(),
    repository: {
      id: 9876543,
      node_id: "MDEwOlJlcG9zaXRvcnk5ODc2NTQz",
      name: "test-repo",
      full_name: "acme/test-repo",
      owner: createMockGitHubUser({ login: "acme" }),
      private: false,
      html_url: "https://github.com/acme/test-repo",
      description: "A test repository",
      fork: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2025-11-26T00:00:00Z",
      pushed_at: "2025-11-26T00:00:00Z",
      homepage: null,
      size: 1024,
      stargazers_count: 42,
      watchers_count: 42,
      language: "TypeScript",
      forks_count: 5,
      archived: false,
      disabled: false,
      open_issues_count: 3,
      license: { key: "mit", name: "MIT License" },
      forks: 5,
      open_issues: 3,
      watchers: 42,
      default_branch: "main",
    },
    ...overrides,
  };

  // Add event-specific fields
  switch (eventType) {
    case "pull_request":
      return {
        ...basePayload,
        pull_request: {
          id: 123456,
          node_id: "PR_123",
          number: 42,
          state: action === "closed" ? "closed" : "open",
          title: "Test PR",
          body: "This is a test pull request",
          html_url: "https://github.com/acme/test-repo/pull/42",
          created_at: "2025-11-26T00:00:00Z",
          updated_at: "2025-11-26T00:00:00Z",
          closed_at: action === "closed" ? "2025-11-26T00:00:00Z" : null,
          merged_at: action === "closed" ? "2025-11-26T00:00:00Z" : null,
          user: createMockGitHubUser(),
          additions: 10,
          deletions: 5,
          changed_files: 2,
          ...overrides?.pull_request,
        },
      };
    case "pull_request_review":
      return {
        ...basePayload,
        review: {
          id: 789012,
          node_id: "PRR_123",
          user: createMockGitHubUser(),
          body: "LGTM!",
          state: "APPROVED",
          html_url: "https://github.com/acme/test-repo/pull/42#pullrequestreview-123",
          submitted_at: "2025-11-26T00:00:00Z",
          ...overrides?.review,
        },
        pull_request: {
          number: 42,
          html_url: "https://github.com/acme/test-repo/pull/42",
          ...overrides?.pull_request,
        },
      };
    case "push":
      return {
        ...basePayload,
        ref: "refs/heads/main",
        before: "abc123",
        after: "def456",
        commits: [
          {
            id: "def456",
            message: "feat: add new feature",
            timestamp: "2025-11-26T00:00:00Z",
            url: "https://github.com/acme/test-repo/commit/def456",
            author: {
              name: "Octocat",
              email: "octocat@github.com",
              username: "octocat",
            },
            added: ["file1.ts"],
            removed: [],
            modified: ["file2.ts"],
          },
        ],
        ...overrides,
      };
    default:
      return basePayload;
  }
}

/**
 * Creates a mock GitHub timeline node (for backfill tests)
 */
export function createMockTimelineNode(overrides?: any) {
  return {
    __typename: "PullRequest",
    id: "PR_123",
    number: 42,
    title: "Test PR",
    body: "Description",
    state: "open",
    url: "https://github.com/acme/test-repo/pull/42",
    updatedAt: new Date().toISOString(),
    actor: {
      id: 999,
      login: "octocat",
      nodeId: "user_node_123",
    },
    ...overrides,
  };
}

/**
 * Creates a mock GitHub timeline result (for backfill tests)
 */
export function createMockTimelineResult(overrides?: any) {
  return {
    nodes: [createMockTimelineNode()],
    hasNextPage: false,
    endCursor: undefined,
    etag: "W/\"abc123\"",
    totalCount: 1,
    rateLimit: {
      cost: 1,
      remaining: 4999,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
    },
    ...overrides,
  };
}

// ============================================================================
// Report Generation Context
// ============================================================================

/**
 * Creates a mock report context (for report generator tests)
 */
export function createMockReportContext(overrides?: Partial<ReportContext>): ReportContext {
  return {
    timeframe: { start: 1000, end: 2000 },
    totals: {
      eventCount: 5,
      byType: {
        commit: 3,
        pr_opened: 1,
        review: 1,
      },
    },
    repos: [{ id: "repo1", name: "test-repo", owner: "acme" }],
    events: [],
    ...overrides,
  } as ReportContext;
}

/**
 * Creates a mock prompt payload (for LLM orchestrator tests)
 */
export function createMockPrompt(overrides?: Partial<PromptPayload>): PromptPayload {
  return {
    systemPrompt: "You are a helpful assistant",
    userPrompt: "Generate a report",
    allowedUrls: [],
    requiredHeadings: ["## Work Completed", "## Key Decisions"],
    minWordCount: 50,
    ...overrides,
  };
}

// ============================================================================
// HTTP Response Mocks
// ============================================================================

/**
 * Creates a mock successful HTTP response
 */
export function createMockResponse(data: any, init?: Partial<Response>) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(init?.headers || {}),
    ...init,
  } as Response);
}

/**
 * Creates a mock HTTP error response
 */
export function createMockErrorResponse(
  status: number,
  statusText: string,
  body: any,
  headers?: Record<string, string>,
) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(headers || {}),
  } as Response);
}

// ============================================================================
// Convex Action Context
// ============================================================================

/**
 * Creates a mock Convex action context (for action tests)
 */
export function createMockActionCtx(overrides?: any) {
  return {
    runQuery: jest.fn(),
    runMutation: jest.fn(),
    runAction: jest.fn(),
    scheduler: {
      runAfter: jest.fn(),
      runAt: jest.fn(),
    },
    auth: {
      getUserIdentity: jest.fn(),
    },
    ...overrides,
  };
}
