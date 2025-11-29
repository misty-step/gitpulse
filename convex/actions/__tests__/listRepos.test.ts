/**
 * Tests for List Repositories Action
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import * as githubModule from "../../lib/github";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({}));

// Mock GitHub API functions
jest.mock("../../lib/github", () => ({
  listUserRepositories: jest.fn(),
  listOrgRepositories: jest.fn(),
}));

// Mock process.env
const mockEnv = {
  GITHUB_TOKEN: "test-token",
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

Object.defineProperty(process, "env", {
  value: mockEnv,
  writable: true,
});

const listUserRepositories = githubModule.listUserRepositories as jest.MockedFunction<
  typeof githubModule.listUserRepositories
>;
const listOrgRepositories = githubModule.listOrgRepositories as jest.MockedFunction<
  typeof githubModule.listOrgRepositories
>;

// Import handler after mocks
 
const { listReposForScope } = require("../listRepos");

describe("listReposForScope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...mockEnv };
  });

  const mockRepo = {
    full_name: "org/repo",
    name: "repo",
    description: "Test repository",
    private: false,
  };

  describe("user scope", () => {
    it("lists repositories for a user", async () => {
      const ctx = createMockActionCtx({});
      listUserRepositories.mockResolvedValue([mockRepo] as any);

      const result = await listReposForScope.handler(ctx, {
        scopeType: "user",
        identifier: "octocat",
      });

      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe("org/repo");
      expect(listUserRepositories).toHaveBeenCalledWith("test-token", "octocat");
    });

    it("returns formatted repository data", async () => {
      const ctx = createMockActionCtx({});
      listUserRepositories.mockResolvedValue([mockRepo] as any);

      const result = await listReposForScope.handler(ctx, {
        scopeType: "user",
        identifier: "octocat",
      });

      expect(result[0]).toEqual({
        fullName: "org/repo",
        name: "repo",
        description: "Test repository",
        isPrivate: false,
      });
    });
  });

  describe("org scope", () => {
    it("lists repositories for an organization", async () => {
      const ctx = createMockActionCtx({});
      listOrgRepositories.mockResolvedValue([mockRepo] as any);

      const result = await listReposForScope.handler(ctx, {
        scopeType: "org",
        identifier: "acme-corp",
      });

      expect(result).toHaveLength(1);
      expect(listOrgRepositories).toHaveBeenCalledWith("test-token", "acme-corp");
    });
  });

  describe("multiple repositories", () => {
    it("returns all repositories", async () => {
      const repos = [
        mockRepo,
        { ...mockRepo, full_name: "org/repo2", name: "repo2" },
        { ...mockRepo, full_name: "org/repo3", name: "repo3" },
      ];

      const ctx = createMockActionCtx({});
      listUserRepositories.mockResolvedValue(repos as any);

      const result = await listReposForScope.handler(ctx, {
        scopeType: "user",
        identifier: "octocat",
      });

      expect(result).toHaveLength(3);
    });
  });

  describe("error handling", () => {
    it("throws error when GitHub token not configured", async () => {
      process.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv; // Remove token

      const ctx = createMockActionCtx({});

      await expect(
        listReposForScope.handler(ctx, {
          scopeType: "user",
          identifier: "octocat",
        }),
      ).rejects.toThrow("GitHub token not configured");
    });
  });

  describe("empty results", () => {
    it("handles no repositories found", async () => {
      const ctx = createMockActionCtx({});
      listUserRepositories.mockResolvedValue([]);

      const result = await listReposForScope.handler(ctx, {
        scopeType: "user",
        identifier: "empty-user",
      });

      expect(result).toHaveLength(0);
    });
  });
});
