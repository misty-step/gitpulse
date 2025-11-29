/**
 * Tests for GitHub Repository Ingestion Action
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import * as githubModule from "../../lib/github";

// Mock the Convex API with string values (avoids ESM import issues)
jest.mock("../../_generated/api", () => ({
  api: {
    repos: { upsert: "api.repos.upsert" },
    users: { upsert: "api.users.upsert" },
    events: { create: "api.events.create" },
  },
}));

// Import the mocked api for assertions
import { api } from "../../_generated/api";

// Mock GitHub API functions
jest.mock("../../lib/github", () => ({
  getRepository: jest.fn(),
  backfillPRs: jest.fn(),
  listReviews: jest.fn(),
  listCommits: jest.fn(),
}));

// Mock process.env
const mockEnv = {
  GITHUB_TOKEN: "test-token",
};

Object.defineProperty(process, "env", {
  value: mockEnv,
  writable: true,
});

const getRepository = githubModule.getRepository as jest.MockedFunction<
  typeof githubModule.getRepository
>;
const backfillPRs = githubModule.backfillPRs as jest.MockedFunction<
  typeof githubModule.backfillPRs
>;
const listReviews = githubModule.listReviews as jest.MockedFunction<
  typeof githubModule.listReviews
>;
const listCommits = githubModule.listCommits as jest.MockedFunction<
  typeof githubModule.listCommits
>;

// Import handler after mocks are set up
 
const { ingestRepository } = require("../ingestRepo");

describe("ingestRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRepoData = {
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
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    pushed_at: "2025-01-01T00:00:00Z",
  };

  const mockPR = {
    id: 1001,
    node_id: "PR_123",
    number: 42,
    title: "Test PR",
    state: "open",
    html_url: "https://github.com/org/repo/pull/42",
    created_at: "2025-01-15T10:00:00Z",
    additions: 10,
    deletions: 5,
    changed_files: 3,
    user: {
      id: 999,
      login: "octocat",
      node_id: "USER_999",
    },
  };

  const mockReview = {
    id: 2001,
    node_id: "PRR_456",
    state: "APPROVED",
    body: "LGTM!",
    html_url: "https://github.com/org/repo/pull/42#pullrequestreview-2001",
    submitted_at: "2025-01-15T11:00:00Z",
    user: {
      id: 888,
      login: "reviewer",
      node_id: "USER_888",
    },
  };

  const mockCommit = {
    sha: "abc123def456",
    node_id: "COMMIT_abc123",
    html_url: "https://github.com/org/repo/commit/abc123",
    commit: {
      message: "feat: add new feature",
      author: {
        date: "2025-01-15T12:00:00Z",
      },
    },
    author: {
      id: 777,
      login: "committer",
      node_id: "USER_777",
    },
    stats: {
      additions: 20,
      deletions: 10,
    },
  };

  describe("successful ingestion", () => {
    it("ingests repository with PRs, reviews, and commits", async () => {
      const runMutation = createAsyncMock();

      // Mock sequential mutation calls
      runMutation
        .mockResolvedValueOnce("repo_id_123") // repos.upsert
        .mockResolvedValueOnce("user_pr_author") // users.upsert (PR author)
        .mockResolvedValueOnce("event_pr_123") // events.create (PR)
        .mockResolvedValueOnce("user_reviewer") // users.upsert (reviewer)
        .mockResolvedValueOnce("event_review_123") // events.create (review)
        .mockResolvedValueOnce("user_committer") // users.upsert (committer)
        .mockResolvedValueOnce("event_commit_123"); // events.create (commit)

      const ctx = createMockActionCtx({ runMutation });

      // Mock GitHub API responses
      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([mockPR] as any);
      listReviews.mockResolvedValue([mockReview] as any);
      listCommits.mockResolvedValue([mockCommit] as any);

      const result = await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(result.success).toBe(true);
      expect(result.repository).toBe("org/repo");
      expect(result.stats.prsIngested).toBe(1);
      expect(result.stats.reviewsIngested).toBe(1);
      expect(result.stats.commitsIngested).toBe(1);
      expect(result.stats.totalEvents).toBe(3);
    });

    it("upserts repository with correct data", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("repo_id_123");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(runMutation).toHaveBeenCalledWith(
        api.repos.upsert,
        expect.objectContaining({
          ghId: 12345,
          fullName: "org/repo",
          name: "repo",
          owner: "org",
          isPrivate: false,
        }),
      );
    });

    it("creates PR event with correct metadata", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([mockPR] as any);
      listReviews.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      // Check that events.create was called with PR data
      expect(runMutation).toHaveBeenCalledWith(
        api.events.create,
        expect.objectContaining({
          type: "pr_opened",
          metadata: expect.objectContaining({
            prNumber: 42,
            title: "Test PR",
            additions: 10,
            deletions: 5,
          }),
        }),
      );
    });

    it("creates review event with correct metadata", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([mockPR] as any);
      listReviews.mockResolvedValue([mockReview] as any);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      // Check that events.create was called with review data
      expect(runMutation).toHaveBeenCalledWith(
        api.events.create,
        expect.objectContaining({
          type: "review",
          metadata: expect.objectContaining({
            prNumber: 42,
            state: "APPROVED",
            body: "LGTM!",
          }),
        }),
      );
    });

    it("creates commit event with correct metadata", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([mockCommit] as any);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      // Check that events.create was called with commit data
      expect(runMutation).toHaveBeenCalledWith(
        api.events.create,
        expect.objectContaining({
          type: "commit",
          ghId: "abc123def456",
          metadata: expect.objectContaining({
            sha: "abc123def456",
            message: "feat: add new feature",
            additions: 20,
            deletions: 10,
          }),
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty repository (no PRs or commits)", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("repo_id_123");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      const result = await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(result.success).toBe(true);
      expect(result.stats.prsIngested).toBe(0);
      expect(result.stats.reviewsIngested).toBe(0);
      expect(result.stats.commitsIngested).toBe(0);
      expect(result.stats.totalEvents).toBe(0);
    });

    it("skips commits without author", async () => {
      const commitWithoutAuthor = {
        ...mockCommit,
        author: null, // System commit
      };

      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([commitWithoutAuthor] as any);

      const result = await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(result.stats.commitsIngested).toBe(0);
    });

    it("handles PR with no reviews", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([mockPR] as any);
      listReviews.mockResolvedValue([]); // No reviews
      listCommits.mockResolvedValue([]);

      const result = await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(result.stats.prsIngested).toBe(1);
      expect(result.stats.reviewsIngested).toBe(0);
    });

    it("handles repository with null description", async () => {
      const repoWithNullDesc = {
        ...mockRepoData,
        description: null,
      };

      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("repo_id_123");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(repoWithNullDesc as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(runMutation).toHaveBeenCalledWith(
        api.repos.upsert,
        expect.objectContaining({
          description: undefined, // null converted to undefined
        }),
      );
    });
  });

  describe("API interactions", () => {
    it("calls GitHub API with correct token", async () => {
      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(getRepository).toHaveBeenCalledWith("test-token", "org/repo");
      expect(backfillPRs).toHaveBeenCalledWith(
        "test-token",
        "org/repo",
        "2025-01-01",
      );
      expect(listCommits).toHaveBeenCalledWith(
        "test-token",
        "org/repo",
        "2025-01-01",
      );
    });

    it("calls listReviews for each PR", async () => {
      const mockPR2 = { ...mockPR, id: 1002, number: 43 };

      const runMutation = createAsyncMock();
      runMutation.mockResolvedValue("id");

      const ctx = createMockActionCtx({ runMutation });

      getRepository.mockResolvedValue(mockRepoData as any);
      backfillPRs.mockResolvedValue([mockPR, mockPR2] as any);
      listReviews.mockResolvedValue([]);
      listCommits.mockResolvedValue([]);

      await ingestRepository.handler(ctx, {
        repoFullName: "org/repo",
        sinceISO: "2025-01-01",
      });

      expect(listReviews).toHaveBeenCalledTimes(2);
      expect(listReviews).toHaveBeenCalledWith("test-token", "org/repo", 42);
      expect(listReviews).toHaveBeenCalledWith("test-token", "org/repo", 43);
    });
  });
});
