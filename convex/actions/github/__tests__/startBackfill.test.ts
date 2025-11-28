import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../../tests/utils/jestMocks";
import { Id } from "../../../_generated/dataModel";

// Mock generated API
jest.mock("../../../_generated/api", () => ({
  api: {
    installations: {
      getByInstallationId: "api.installations.getByInstallationId",
    },
  },
  internal: {
    ingestionJobs: {
      getById: "internal.ingestionJobs.getById",
      create: "internal.ingestionJobs.create",
      resume: "internal.ingestionJobs.resume",
      updateProgress: "internal.ingestionJobs.updateProgress",
      complete: "internal.ingestionJobs.complete",
      markBlocked: "internal.ingestionJobs.markBlocked",
      fail: "internal.ingestionJobs.fail",
    },
    installations: {
      updateSyncState: "internal.installations.updateSyncState",
    },
    actions: {
      github: {
        startBackfill: {
          continueBackfill: "internal.actions.github.startBackfill.continueBackfill",
        },
      },
    },
  },
}));

// Mock dependencies
jest.mock("../../../lib/githubApp", () => ({
  mintInstallationToken: jest.fn(),
  fetchRepoTimeline: jest.fn(),
  shouldPause: jest.fn(),
}));

jest.mock("../../../lib/canonicalizeEvent", () => ({
  canonicalizeEvent: jest.fn(),
}));

jest.mock("../../../lib/canonicalFactService", () => ({
  persistCanonicalEvent: jest.fn(),
}));

jest.mock("../../../lib/github", () => ({
  getRepository: jest.fn(),
  RateLimitError: class RateLimitError extends Error {
    reset: number;
    constructor(message: string, reset: number) {
      super(message);
      this.reset = reset;
      this.name = "RateLimitError";
    }
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const githubApp = jest.requireMock("../../../lib/githubApp") as any;
const canonicalizeEvent = jest.requireMock("../../../lib/canonicalizeEvent") as any;
const canonicalFactService = jest.requireMock("../../../lib/canonicalFactService") as any;
const github = jest.requireMock("../../../lib/github") as any;

// Import after mocking
import { adminStartBackfillHandler } from "../startBackfill";
import { api, internal } from "../../../_generated/api";

function createMockInstallation() {
  return {
    _id: "installation_123" as Id<"installations">,
    installationId: 12345,
    clerkUserId: "user_123",
    repositories: ["acme/test-repo"],
    rateLimitRemaining: 5000,
    rateLimitReset: Date.now() + 3600000,
    lastCursor: undefined,
    etag: undefined,
  };
}

function createMockRepo() {
  return {
    id: "repo_123",
    name: "test-repo",
    owner: "acme",
    fullName: "acme/test-repo",
    defaultBranch: "main",
  };
}

function createMockTimelineNode(overrides?: any) {
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

function createMockTimelineResult(overrides?: any) {
  return {
    nodes: [createMockTimelineNode()],
    hasNextPage: false,
    endCursor: undefined,
    etag: "W/\"abc123\"",
    totalCount: 1,
    rateLimit: {
      remaining: 4999,
      reset: Date.now() + 3600000,
    },
    notModified: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  // Default mocks
  githubApp.mintInstallationToken.mockResolvedValue({
    token: "ghs_test_token",
    expiresAt: Date.now() + 3600000,
  });

  github.getRepository.mockResolvedValue(createMockRepo());

  githubApp.fetchRepoTimeline.mockResolvedValue(createMockTimelineResult());

  canonicalizeEvent.canonicalizeEvent.mockReturnValue({
    contentHash: "hash_123",
    canonicalText: "Test PR: Test PR",
    sourceUrl: "https://github.com/acme/test-repo/pull/42",
    actorLogin: "octocat",
    repoFullName: "acme/test-repo",
    eventType: "pr_opened",
    happenedAt: Date.now(),
  });

  canonicalFactService.persistCanonicalEvent.mockResolvedValue({
    status: "inserted",
    eventId: "event_123" as Id<"events">,
  });

  githubApp.shouldPause.mockReturnValue(false);
});

describe("adminStartBackfill - timeline pagination", () => {
  it("processes multiple pages of timeline events", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation) // getByInstallationId (initial)
      .mockResolvedValueOnce(installation); // getByInstallationId (before job creation)

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">); // create job

    // Mock 3 pages of results
    githubApp.fetchRepoTimeline
      .mockResolvedValueOnce(
        createMockTimelineResult({
          nodes: [createMockTimelineNode({ id: "PR_1" })],
          hasNextPage: true,
          endCursor: "2",
        }),
      )
      .mockResolvedValueOnce(
        createMockTimelineResult({
          nodes: [createMockTimelineNode({ id: "PR_2" })],
          hasNextPage: true,
          endCursor: "3",
        }),
      )
      .mockResolvedValueOnce(
        createMockTimelineResult({
          nodes: [createMockTimelineNode({ id: "PR_3" })],
          hasNextPage: false,
          endCursor: undefined,
        }),
      );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    });

    expect(result.ok).toBe(true);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].status).toBe("completed");

    // Should have called fetchRepoTimeline 3 times
    expect(githubApp.fetchRepoTimeline).toHaveBeenCalledTimes(3);

    // Should have processed 3 events
    expect(canonicalFactService.persistCanonicalEvent).toHaveBeenCalledTimes(3);
  });

  it("updates progress on each page", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline
      .mockResolvedValueOnce(
        createMockTimelineResult({
          hasNextPage: true,
          endCursor: "2",
          totalCount: 100,
        }),
      )
      .mockResolvedValueOnce(
        createMockTimelineResult({
          hasNextPage: false,
          totalCount: 100,
        }),
      );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    // Should have called updateProgress twice (once per page)
    expect(runMutation).toHaveBeenCalledWith(
      internal.ingestionJobs.updateProgress,
      expect.objectContaining({
        jobId: "job_123",
      }),
    );
  });
});

describe("adminStartBackfill - rate limiting", () => {
  it("pauses and schedules auto-resume when rate limit budget exhausted", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const scheduler = { runAt: jest.fn(), runAfter: jest.fn() };
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    const resetTime = Date.now() + 3600000;

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        rateLimit: {
          remaining: 10,
          reset: resetTime,
        },
      }),
    );

    // Mock shouldPause to return true when remaining is low
    githubApp.shouldPause.mockReturnValue(true);

    const ctx = createMockActionCtx({ runQuery, runMutation, scheduler });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.jobs[0].status).toBe("blocked");
    expect(result.jobs[0].blockedUntil).toBe(resetTime);

    // Should have scheduled auto-resume
    expect(scheduler.runAt).toHaveBeenCalledWith(
      resetTime,
      internal.actions.github.startBackfill.continueBackfill,
      expect.objectContaining({ jobId: "job_123" }),
    );
  });

  it("handles rate limit error from getRepository", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const scheduler = { runAt: jest.fn(), runAfter: jest.fn() };
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    const resetTime = Date.now() + 3600000;

    // Mock getRepository to throw RateLimitError
    github.getRepository.mockRejectedValueOnce(
      new github.RateLimitError("Rate limit exceeded", resetTime),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation, scheduler });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.jobs[0].status).toBe("blocked");
    expect(result.jobs[0].blockedUntil).toBe(resetTime);

    // Should have marked job as blocked
    expect(runMutation).toHaveBeenCalledWith(
      internal.ingestionJobs.markBlocked,
      expect.objectContaining({
        jobId: "job_123",
        blockedUntil: resetTime,
      }),
    );
  });
});

describe("adminStartBackfill - deduplication", () => {
  it("skips events that are already persisted", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        nodes: [
          createMockTimelineNode({ id: "PR_1" }),
          createMockTimelineNode({ id: "PR_2" }),
          createMockTimelineNode({ id: "PR_3" }),
        ],
      }),
    );

    // Mock deduplication: only first event is new
    canonicalFactService.persistCanonicalEvent
      .mockResolvedValueOnce({
        status: "inserted",
        eventId: "event_1" as Id<"events">,
      })
      .mockResolvedValueOnce({
        status: "duplicate",
        eventId: "event_2" as Id<"events">,
      })
      .mockResolvedValueOnce({
        status: "duplicate",
        eventId: "event_3" as Id<"events">,
      });

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);

    // Only 1 event should have been counted as ingested
    expect(result.jobs[0].eventsIngested).toBe(1);
  });
});

describe("adminStartBackfill - job completion", () => {
  it("marks job as completed when no more pages", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        hasNextPage: false,
      }),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.jobs[0].status).toBe("completed");

    // Should have called complete mutation
    expect(runMutation).toHaveBeenCalledWith(
      internal.ingestionJobs.complete,
      expect.objectContaining({
        jobId: "job_123",
      }),
    );
  });

  it("chains to next repository after completion", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const scheduler = { runAt: jest.fn(), runAfter: jest.fn() };
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        hasNextPage: false,
      }),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation, scheduler });

    await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/repo1", "acme/repo2"], // Multiple repos
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    // Should schedule continuation for next repo
    expect(scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.actions.github.startBackfill.continueBackfill,
      expect.objectContaining({ jobId: "job_123" }),
    );
  });
});

describe("adminStartBackfill - error handling", () => {
  it("handles network failures gracefully", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockRejectedValueOnce(
      new Error("Network timeout"),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    await expect(
      adminStartBackfillHandler(ctx, {
        installationId: 12345,
        clerkUserId: "user_123",
        repositories: ["acme/test-repo"],
        since: Date.now() - 7 * 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow("Network timeout");

    // Should have marked job as failed
    expect(runMutation).toHaveBeenCalledWith(
      internal.ingestionJobs.fail,
      expect.objectContaining({
        jobId: "job_123",
        errorMessage: "Network timeout",
      }),
    );
  });

  it("throws on missing installation", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();

    runQuery.mockResolvedValueOnce(null); // Installation not found

    const ctx = createMockActionCtx({ runQuery, runMutation });

    await expect(
      adminStartBackfillHandler(ctx, {
        installationId: 12345,
        clerkUserId: "user_123",
        repositories: ["acme/test-repo"],
        since: Date.now() - 7 * 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow("Installation 12345 not registered");
  });

  it("throws on empty repository list", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery.mockResolvedValueOnce(installation);

    const ctx = createMockActionCtx({ runQuery, runMutation });

    await expect(
      adminStartBackfillHandler(ctx, {
        installationId: 12345,
        clerkUserId: "user_123",
        repositories: [], // Empty
        since: Date.now() - 7 * 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow("No repositories available");
  });
});

describe("adminStartBackfill - empty repository", () => {
  it("handles repository with no events", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        nodes: [], // No events
        hasNextPage: false,
      }),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/empty-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.jobs[0].status).toBe("completed");
    expect(result.jobs[0].eventsIngested).toBe(0);
  });
});

describe("adminStartBackfill - etag caching", () => {
  it("handles 304 Not Modified responses", async () => {
    const runQuery = createAsyncMock();
    const runMutation = createAsyncMock();
    const installation = createMockInstallation();

    runQuery
      .mockResolvedValueOnce(installation)
      .mockResolvedValueOnce(installation);

    runMutation.mockResolvedValueOnce("job_123" as Id<"ingestionJobs">);

    githubApp.fetchRepoTimeline.mockResolvedValueOnce(
      createMockTimelineResult({
        nodes: [],
        notModified: true, // 304 response
        hasNextPage: false,
      }),
    );

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await adminStartBackfillHandler(ctx, {
      installationId: 12345,
      clerkUserId: "user_123",
      repositories: ["acme/test-repo"],
      since: Date.now() - 7 * 24 * 60 * 60 * 1000,
    });

    expect(result.ok).toBe(true);
    expect(result.jobs[0].status).toBe("completed");

    // Should not have tried to persist any events
    expect(canonicalFactService.persistCanonicalEvent).not.toHaveBeenCalled();
  });
});
