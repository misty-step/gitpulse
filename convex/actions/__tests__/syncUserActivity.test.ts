/**
 * Tests for User Activity Sync Action
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({
  api: {
    repos: { upsert: "api.repos.upsert" },
  },
}));

// Mock the GitHubClient
const mockListAllRepos = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockGetUserEvents = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();

jest.mock("../../lib/GitHubClient", () => ({
  GitHubClient: {
    forUser: jest.fn().mockImplementation(() => ({
      listAllRepos: mockListAllRepos,
      getUserEvents: mockGetUserEvents,
    })),
  },
}));

// Mock logger
jest.mock("../../lib/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks
 
const { syncUserActivity } = require("../syncUserActivity");
import { GitHubClient } from "../../lib/GitHubClient";
import { logger } from "../../lib/logger.js";

describe("syncUserActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListAllRepos.mockReset();
    mockGetUserEvents.mockReset();
  });

  const mockRepo = {
    id: 12345,
    node_id: "MDEwOlJlcG9zaXRvcnkxMjM0NQ==",
    full_name: "org/repo",
    name: "repo",
    owner: { login: "org" },
    description: "Test repository",
    html_url: "https://github.com/org/repo",
    homepage: null,
    language: "TypeScript",
    private: false,
    fork: false,
    archived: false,
    stargazers_count: 100,
    forks_count: 10,
    open_issues_count: 5,
    watchers_count: 50,
    size: 1000,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    pushed_at: "2025-01-01T00:00:00Z",
  };

  const mockPushEvent = {
    id: "event_1",
    type: "PushEvent",
    actor: { id: 999, login: "octocat" },
    repo: { id: 12345, name: "org/repo" },
    created_at: "2025-01-15T10:00:00Z",
    payload: {
      commits: [{ message: "feat: add new feature" }],
    },
  };

  const mockPREvent = {
    id: "event_2",
    type: "PullRequestEvent",
    actor: { id: 999, login: "octocat" },
    repo: { id: 12345, name: "org/repo" },
    created_at: "2025-01-15T11:00:00Z",
    payload: {
      action: "opened",
      pull_request: { title: "Add awesome feature" },
    },
  };

  describe("successful sync", () => {
    it("discovers repos and returns stats", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.reposDiscovered).toBe(1);
      expect(result.reposStored).toBe(1);
      expect(result.eventsFound).toBe(0);
    });

    it("upserts repos with correct data", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(runMutation).toHaveBeenCalledWith(
        "api.repos.upsert",
        expect.objectContaining({
          ghId: 12345,
          fullName: "org/repo",
          name: "repo",
          owner: "org",
          isPrivate: false,
          isFork: false,
          isArchived: false,
          stars: 100,
          forks: 10,
        }),
      );
    });

    it("fetches user events and counts them", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([mockPushEvent, mockPREvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(2);
      expect(mockGetUserEvents).toHaveBeenCalledWith(undefined);
    });

    it("uses since parameter when provided", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([]);

      const sinceTimestamp = Date.now() - 86400000; // 1 day ago
      await syncUserActivity.handler(ctx, {
        userId: "user_123",
        since: sinceTimestamp,
      });

      expect(mockGetUserEvents).toHaveBeenCalledWith(expect.any(Date));
    });
  });

  describe("error handling", () => {
    it("continues processing when one repo upsert fails", async () => {
      const repo2 = { ...mockRepo, id: 67890, full_name: "org/repo2" };

      const runMutation = createAsyncMock()
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce("repo_67890");

      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo, repo2]);
      mockGetUserEvents.mockResolvedValue([]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.reposDiscovered).toBe(2);
      expect(result.reposStored).toBe(1); // Only one succeeded
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs error when repo upsert fails", async () => {
      const runMutation = createAsyncMock().mockRejectedValue(
        new Error("Database error"),
      );
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          repoFullName: "org/repo",
        }),
        "Failed to upsert repo",
      );
    });
  });

  describe("GitHubClient creation", () => {
    it("creates GitHubClient for the user", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_abc" });

      expect(GitHubClient.forUser).toHaveBeenCalledWith(ctx, "user_abc");
    });
  });

  describe("repo data transformation", () => {
    it("handles null description", async () => {
      const repoWithNullDesc = { ...mockRepo, description: null };

      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([repoWithNullDesc]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(runMutation).toHaveBeenCalledWith(
        "api.repos.upsert",
        expect.objectContaining({
          description: undefined,
        }),
      );
    });

    it("handles null pushed_at", async () => {
      const repoWithNullPushedAt = { ...mockRepo, pushed_at: null };

      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([repoWithNullPushedAt]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(runMutation).toHaveBeenCalledWith(
        "api.repos.upsert",
        expect.objectContaining({
          ghPushedAt: undefined,
        }),
      );
    });

    it("converts date strings to timestamps", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(runMutation).toHaveBeenCalledWith(
        "api.repos.upsert",
        expect.objectContaining({
          ghCreatedAt: new Date("2024-01-01T00:00:00Z").getTime(),
          ghUpdatedAt: new Date("2025-01-01T00:00:00Z").getTime(),
        }),
      );
    });
  });

  describe("event extraction", () => {
    it("extracts message from PushEvent", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([mockPushEvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      // Events are found but not stored (per current implementation)
      expect(result.eventsFound).toBe(1);
      expect(result.eventsStored).toBe(0);
    });

    it("extracts title from PullRequestEvent", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([mockPREvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(1);
    });

    it("handles IssueCommentEvent", async () => {
      const commentEvent = {
        id: "event_3",
        type: "IssueCommentEvent",
        actor: { id: 999, login: "octocat" },
        repo: { id: 12345, name: "org/repo" },
        created_at: "2025-01-15T12:00:00Z",
        payload: {
          comment: { body: "Great work on this PR!" },
        },
      };

      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([commentEvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(1);
    });

    it("handles IssuesEvent", async () => {
      const issueEvent = {
        id: "event_4",
        type: "IssuesEvent",
        actor: { id: 999, login: "octocat" },
        repo: { id: 12345, name: "org/repo" },
        created_at: "2025-01-15T13:00:00Z",
        payload: {
          action: "opened",
          issue: { title: "Bug: something is broken" },
        },
      };

      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([issueEvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(1);
    });

    it("handles ReleaseEvent", async () => {
      const releaseEvent = {
        id: "event_5",
        type: "ReleaseEvent",
        actor: { id: 999, login: "octocat" },
        repo: { id: 12345, name: "org/repo" },
        created_at: "2025-01-15T14:00:00Z",
        payload: {
          action: "published",
          release: { name: "v1.0.0", tag_name: "v1.0.0" },
        },
      };

      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([releaseEvent]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(1);
    });
  });

  describe("empty results", () => {
    it("handles no repos found", async () => {
      const ctx = createMockActionCtx({});

      mockListAllRepos.mockResolvedValue([]);
      mockGetUserEvents.mockResolvedValue([]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.reposDiscovered).toBe(0);
      expect(result.reposStored).toBe(0);
      expect(result.eventsFound).toBe(0);
    });

    it("handles no events found", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo]);
      mockGetUserEvents.mockResolvedValue([]);

      const result = await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(result.eventsFound).toBe(0);
      expect(result.eventsStored).toBe(0);
    });
  });

  describe("logging", () => {
    it("logs discovery progress", async () => {
      const runMutation = createAsyncMock().mockResolvedValue("repo_123");
      const ctx = createMockActionCtx({ runMutation });

      mockListAllRepos.mockResolvedValue([mockRepo, mockRepo]);
      mockGetUserEvents.mockResolvedValue([mockPushEvent]);

      await syncUserActivity.handler(ctx, { userId: "user_123" });

      expect(logger.info).toHaveBeenCalledWith(
        { userId: "user_123" },
        "Discovering repos for user",
      );
      expect(logger.info).toHaveBeenCalledWith(
        { count: 2 },
        "Found repositories",
      );
      expect(logger.info).toHaveBeenCalledWith({ count: 1 }, "Found events");
    });
  });
});
