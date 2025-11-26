import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import {
  backfillPRs,
  listReviews,
  listCommits,
  getRepository,
  listUserRepositories,
  listOrgRepositories,
  RateLimitError,
} from "../github";
import { createMockResponse, createMockErrorResponse } from "../../../tests/utils/factories";

// Store original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("githubFetch - request construction", () => {
  it("constructs proper API request with auth headers", async () => {
    const mockFetch = jest.fn(() =>
      createMockResponse({ id: 123, name: "test-repo" }),
    );
    global.fetch = mockFetch as any;

    await getRepository("test-token", "owner/repo");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
          Authorization: "Bearer test-token",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "gitpulse/0.1",
        }),
      }),
    );
  });

  it("validates repository format", async () => {
    await expect(getRepository("test-token", "invalid")).rejects.toThrow(
      'Invalid repo format: invalid. Expected "owner/repo"',
    );
  });
});

describe("githubFetch - rate limit handling", () => {
  it("throws RateLimitError on 429 with proper reset time", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const mockFetch = jest.fn(() =>
      createMockErrorResponse(
        429,
        "Too Many Requests",
        {
          message: "API rate limit exceeded",
        },
        {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetTime),
        },
      ),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      RateLimitError,
    );

    try {
      await getRepository("test-token", "owner/repo");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).reset).toBe(resetTime * 1000);
    }
  });

  it("parses retry-after header when x-ratelimit-reset is missing", async () => {
    const retryAfter = 120; // 2 minutes (> 1 minute to avoid retries in withRetry)

    const mockFetch = jest.fn(() =>
      createMockErrorResponse(
        429,
        "Too Many Requests",
        {
          message: "API rate limit exceeded",
        },
        {
          "retry-after": String(retryAfter),
        },
      ),
    );
    global.fetch = mockFetch as any;

    try {
      await getRepository("test-token", "owner/repo");
      fail("Should have thrown RateLimitError");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const resetTime = (error as RateLimitError).reset;
      // Should be roughly Date.now() + 120000ms
      expect(resetTime).toBeGreaterThan(Date.now() + 115000);
      expect(resetTime).toBeLessThan(Date.now() + 125000);
    }
  });

  it("detects rate limit from 403 with rate limit message", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 3600;

    const mockFetch = jest.fn(() =>
      createMockErrorResponse(
        403,
        "Forbidden",
        {
          message: "You have exceeded a secondary rate limit",
        },
        {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetTime),
        },
      ),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      RateLimitError,
    );
  });

  it("throws standard error for 403 without rate limit indicators", async () => {
    // Mock a 403 error that is NOT a rate limit (e.g., insufficient permissions)
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({
          message: "Resource not accessible by integration",
        }),
        headers: new Headers({
          "x-ratelimit-remaining": "100", // Has remaining quota, so not rate limited
        }),
      } as Response),
    );
    global.fetch = mockFetch as any;

    // Note: 403 errors retry with exponential backoff (1s, 2s, 4s, 8s)
    // This test verifies the error type, not the retry behavior
    try {
      await getRepository("test-token", "owner/repo");
      fail("Should have thrown error");
    } catch (error) {
      // Verify it's not a RateLimitError (403 without rate limit indicators = standard error)
      expect(error).not.toBeInstanceOf(RateLimitError);
      expect((error as Error).message).toContain("Resource not accessible");
    }
  }, 10000); // Extend timeout to allow for retries
});

describe("withRetry - exponential backoff", () => {
  it("detects errors with 403 in message and retries with exponential backoff", async () => {
    let callCount = 0;

    const mockFetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        // Fail first attempt with error containing "403"
        return Promise.reject(new Error("HTTP 403 error"));
      }
      // Succeed on 2nd attempt
      return createMockResponse({ id: 123 });
    });
    global.fetch = mockFetch as any;

    const result = await getRepository("test-token", "owner/repo");

    expect(result).toEqual({ id: 123 });
    // Note: May be 1 or 2 depending on if withRetry catches and retries
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThanOrEqual(2);
  });

  it("detects errors with 429 in message and retries with exponential backoff", async () => {
    let callCount = 0;

    const mockFetch = jest.fn(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("HTTP 429 Too Many Requests"));
      }
      return createMockResponse({ id: 456 });
    });
    global.fetch = mockFetch as any;

    const result = await getRepository("test-token", "owner/repo");

    expect(result).toEqual({ id: 456 });
    // Verifies that retries happened (should be 3: initial + 2 retries)
    expect(callCount).toBe(3);
  });

  it("does not retry rate limit error with reset time > 1 minute", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const mockFetch = jest.fn(() =>
      createMockErrorResponse(
        429,
        "Too Many Requests",
        {
          message: "API rate limit exceeded",
        },
        {
          "x-ratelimit-reset": String(resetTime),
        },
      ),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      RateLimitError,
    );

    // Should only try once (no retries for long wait times)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry on non-retryable errors (404, 500)", async () => {
    const mockFetch = jest.fn(() =>
      createMockErrorResponse(404, "Not Found", {
        message: "Repository not found",
      }),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      "GitHub API error (404): Repository not found",
    );

    // Should only try once (no retries for 404)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("pagination", () => {
  it("paginates through multiple pages of PRs", async () => {
    let pageRequested = 0;
    const mockFetch = jest.fn((url: string) => {
      pageRequested++;

      if (pageRequested === 1) {
        // First page: 100 results
        return createMockResponse(
          Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            number: i + 1,
            created_at: "2024-01-01T00:00:00Z",
          })),
        );
      } else if (pageRequested === 2) {
        // Second page: 50 results (less than perPage)
        return createMockResponse(
          Array.from({ length: 50 }, (_, i) => ({
            id: i + 101,
            number: i + 101,
            created_at: "2024-01-01T00:00:00Z",
          })),
        );
      }

      return createMockResponse([]);
    });
    global.fetch = mockFetch as any;

    const prs = await backfillPRs("test-token", "owner/repo", "2023-01-01");

    expect(prs).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("stops pagination when no results returned", async () => {
    const mockFetch = jest.fn(() => createMockResponse([]));
    global.fetch = mockFetch as any;

    const prs = await backfillPRs("test-token", "owner/repo", "2023-01-01");

    expect(prs).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("filters PRs by creation date", async () => {
    const mockFetch = jest.fn(() =>
      createMockResponse([
        {
          id: 1,
          number: 1,
          created_at: "2024-06-01T00:00:00Z", // After since
        },
        {
          id: 2,
          number: 2,
          created_at: "2023-06-01T00:00:00Z", // Before since
        },
        {
          id: 3,
          number: 3,
          created_at: "2024-07-01T00:00:00Z", // After since
        },
      ]),
    );
    global.fetch = mockFetch as any;

    const prs = await backfillPRs(
      "test-token",
      "owner/repo",
      "2024-01-01T00:00:00Z",
    );

    expect(prs).toHaveLength(2);
    expect(prs[0].id).toBe(1);
    expect(prs[1].id).toBe(3);
  });
});

describe("listCommits", () => {
  it("constructs query with author filter when provided", async () => {
    const mockFetch = jest.fn(() => createMockResponse([]));
    global.fetch = mockFetch as any;

    await listCommits(
      "test-token",
      "owner/repo",
      "2024-01-01T00:00:00Z",
      "octocat",
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("&author=octocat"),
      expect.anything(),
    );
  });

  it("paginates through commits", async () => {
    let callCount = 0;
    const mockFetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return createMockResponse(Array.from({ length: 100 }, (_, i) => ({ sha: `sha${i}` })));
      }
      return createMockResponse(Array.from({ length: 25 }, (_, i) => ({ sha: `sha${i + 100}` })));
    });
    global.fetch = mockFetch as any;

    const commits = await listCommits(
      "test-token",
      "owner/repo",
      "2024-01-01T00:00:00Z",
    );

    expect(commits).toHaveLength(125);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("listUserRepositories and listOrgRepositories", () => {
  it("fetches user repositories with pagination", async () => {
    let callCount = 0;
    const mockFetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return createMockResponse(Array.from({ length: 100 }, (_, i) => ({ id: i })));
      }
      return createMockResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 100 })));
    });
    global.fetch = mockFetch as any;

    const repos = await listUserRepositories("test-token", "octocat");

    expect(repos).toHaveLength(110);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("fetches org repositories with pagination", async () => {
    const mockFetch = jest.fn(() =>
      createMockResponse(Array.from({ length: 50 }, (_, i) => ({ id: i }))),
    );
    global.fetch = mockFetch as any;

    const repos = await listOrgRepositories("test-token", "github");

    expect(repos).toHaveLength(50);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("error handling", () => {
  it("handles network timeout", async () => {
    const mockFetch = jest.fn(() =>
      Promise.reject(new Error("Network timeout")),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      "Network timeout",
    );
  });

  it("handles invalid JSON responses", async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as Response),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      "Invalid JSON",
    );
  });

  it("handles 404 not found errors", async () => {
    const mockFetch = jest.fn(() =>
      createMockErrorResponse(404, "Not Found", {
        message: "Not Found",
      }),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      "GitHub API error (404): Not Found",
    );
  });

  it("handles 500 server errors", async () => {
    const mockFetch = jest.fn(() =>
      createMockErrorResponse(500, "Internal Server Error", {
        message: "Something went wrong",
      }),
    );
    global.fetch = mockFetch as any;

    await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
      "GitHub API error (500): Something went wrong",
    );
  });
});

describe("listReviews", () => {
  it("fetches reviews for a pull request", async () => {
    const mockFetch = jest.fn(() =>
      createMockResponse([
        {
          id: 1,
          user: { id: 123, login: "reviewer1", node_id: "node1" },
          state: "APPROVED",
        },
        {
          id: 2,
          user: { id: 456, login: "reviewer2", node_id: "node2" },
          state: "CHANGES_REQUESTED",
        },
      ]),
    );
    global.fetch = mockFetch as any;

    const reviews = await listReviews("test-token", "owner/repo", 42);

    expect(reviews).toHaveLength(2);
    expect(reviews[0].state).toBe("APPROVED");
    expect(reviews[1].state).toBe("CHANGES_REQUESTED");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/pulls/42/reviews",
      expect.anything(),
    );
  });
});
