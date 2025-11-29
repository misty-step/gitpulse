/**
 * Tests for Prompt Engineering functions
 */

import { describe, expect, it } from "@jest/globals";
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractCitations,
  getPromptVersion,
  getCurrentPromptVersion,
  buildDailyStandupPrompt,
  buildWeeklyRetroPrompt,
  type UserKPIs,
  type SearchResult,
} from "../prompts";
import type { ReportContext } from "../reportContext";

describe("prompts", () => {
  describe("buildSystemPrompt", () => {
    it("returns a non-empty string", () => {
      const result = buildSystemPrompt();
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("includes citation rules", () => {
      const result = buildSystemPrompt();
      expect(result).toContain("cite a GitHub URL");
      expect(result).toContain("markdown link format");
    });

    it("includes markdown format instructions", () => {
      const result = buildSystemPrompt();
      expect(result).toContain("markdown");
    });
  });

  describe("buildUserPrompt", () => {
    const mockKPIs: UserKPIs[] = [
      { login: "octocat", prsOpened: 5, commits: 20, reviews: 10 },
    ];

    const mockSearchResults: SearchResult[] = [
      {
        similarity: 0.95,
        metadata: {
          type: "pr_opened",
          repo: "org/repo",
          user: "octocat",
          url: "https://github.com/org/repo/pull/1",
        },
        url: "https://github.com/org/repo/pull/1",
      },
    ];

    it("includes time range", () => {
      const result = buildUserPrompt(
        mockKPIs,
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).toContain("TIME RANGE:");
    });

    it("includes query when provided", () => {
      const result = buildUserPrompt(
        mockKPIs,
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
        "What PRs did I merge?",
      );
      expect(result).toContain("QUERY: What PRs did I merge?");
    });

    it("does not include query section when not provided", () => {
      const result = buildUserPrompt(
        mockKPIs,
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).not.toContain("QUERY:");
    });

    it("handles empty KPIs", () => {
      const result = buildUserPrompt(
        [],
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).toContain("No KPI data available");
    });

    it("includes KPI data when provided", () => {
      const result = buildUserPrompt(
        mockKPIs,
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).toContain("User: octocat");
      expect(result).toContain("PRs Opened: 5");
      expect(result).toContain("Commits: 20");
      expect(result).toContain("Reviews: 10");
    });

    it("handles empty search results", () => {
      const result = buildUserPrompt(mockKPIs, [], "2025-01-01", "2025-01-31");
      expect(result).toContain("No semantic search results available");
    });

    it("includes search results with citations", () => {
      const result = buildUserPrompt(
        mockKPIs,
        mockSearchResults,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).toContain("RELEVANT ACTIVITY");
      expect(result).toContain("pr_opened");
      expect(result).toContain("org/repo");
      expect(result).toContain("95.0%"); // similarity percentage
    });

    it("handles search results with missing metadata", () => {
      const resultsWithMissingData: SearchResult[] = [
        {
          similarity: 0.8,
          metadata: {},
        },
      ];
      const result = buildUserPrompt(
        mockKPIs,
        resultsWithMissingData,
        "2025-01-01",
        "2025-01-31",
      );
      expect(result).toContain("activity"); // fallback for type
      expect(result).toContain("unknown repo"); // fallback for repo
      expect(result).toContain("unknown user"); // fallback for user
      expect(result).toContain("No URL available"); // fallback for url
    });
  });

  describe("extractCitations", () => {
    it("extracts GitHub URLs from markdown links", () => {
      const markdown =
        "Fixed [PR #42](https://github.com/org/repo/pull/42) and [issue](https://github.com/org/repo/issues/1)";
      const result = extractCitations(markdown);
      expect(result).toHaveLength(2);
      expect(result).toContain("https://github.com/org/repo/pull/42");
      expect(result).toContain("https://github.com/org/repo/issues/1");
    });

    it("ignores non-GitHub URLs", () => {
      const markdown =
        "Check [docs](https://example.com) and [PR](https://github.com/org/repo/pull/1)";
      const result = extractCitations(markdown);
      expect(result).toHaveLength(1);
      expect(result).toContain("https://github.com/org/repo/pull/1");
    });

    it("returns unique URLs", () => {
      const markdown =
        "[PR #1](https://github.com/org/repo/pull/1) was great. See [PR #1](https://github.com/org/repo/pull/1) again.";
      const result = extractCitations(markdown);
      expect(result).toHaveLength(1);
    });

    it("returns empty array for no citations", () => {
      const markdown = "Plain text with no links";
      const result = extractCitations(markdown);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for non-GitHub links", () => {
      const markdown =
        "[Google](https://google.com) and [Docs](https://docs.example.com)";
      const result = extractCitations(markdown);
      expect(result).toHaveLength(0);
    });
  });

  describe("getPromptVersion", () => {
    it("returns a non-empty string", () => {
      const result = getPromptVersion();
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("returns deterministic hash", () => {
      const hash1 = getPromptVersion();
      const hash2 = getPromptVersion();
      expect(hash1).toBe(hash2);
    });
  });

  describe("getCurrentPromptVersion", () => {
    it("returns version with metadata", () => {
      const result = getCurrentPromptVersion();
      expect(result.version).toBeTruthy();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.description).toBeTruthy();
    });
  });

  describe("buildDailyStandupPrompt", () => {
    const mockContext: ReportContext = {
      timeframe: {
        start: new Date(Date.now() - 86400000).toISOString(), // yesterday
        end: new Date().toISOString(),
        days: 1,
      },
      totals: {
        eventCount: 21,
        repoCount: 2,
        byType: {
          pr_opened: 2,
          pr_merged: 1,
          review: 3,
          commit: 10,
          issue_closed: 1,
          comment: 5,
        },
      },
      repos: [
        { repo: "org/repo1", eventCount: 15, commits: 8, pullRequests: 3, reviews: 2, issues: 2 },
        { repo: "org/repo2", eventCount: 6, commits: 2, pullRequests: 1, reviews: 1, issues: 0 },
      ],
      timeline: [],
    };

    it("returns complete prompt payload", () => {
      const result = buildDailyStandupPrompt("octocat", mockContext, [
        "https://github.com/org/repo/pull/1",
      ]);
      expect(result.systemPrompt).toBeTruthy();
      expect(result.userPrompt).toBeTruthy();
      expect(result.requiredHeadings).toHaveLength(3);
      expect(result.minWordCount).toBe(280);
    });

    it("includes username in prompt", () => {
      const result = buildDailyStandupPrompt("octocat", mockContext, []);
      expect(result.userPrompt).toContain("octocat");
    });

    it("includes allowed URLs when provided", () => {
      const urls = [
        "https://github.com/org/repo/pull/1",
        "https://github.com/org/repo/commit/abc",
      ];
      const result = buildDailyStandupPrompt("octocat", mockContext, urls);
      expect(result.userPrompt).toContain("https://github.com/org/repo/pull/1");
      expect(result.userPrompt).toContain("https://github.com/org/repo/commit/abc");
      expect(result.allowedUrls).toEqual(urls);
    });

    it("handles empty allowed URLs", () => {
      const result = buildDailyStandupPrompt("octocat", mockContext, []);
      expect(result.userPrompt).toContain("no URLs available");
    });

    it("includes required headings", () => {
      const result = buildDailyStandupPrompt("octocat", mockContext, []);
      expect(result.requiredHeadings).toContain("## Work Completed");
      expect(result.requiredHeadings).toContain("## Key Decisions & Context");
      expect(result.requiredHeadings).toContain("## Momentum & Next Steps");
    });
  });

  describe("buildWeeklyRetroPrompt", () => {
    const mockContext: ReportContext = {
      timeframe: {
        start: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
        end: new Date().toISOString(),
        days: 7,
      },
      totals: {
        eventCount: 111,
        repoCount: 3,
        byType: {
          pr_opened: 10,
          pr_merged: 8,
          review: 15,
          commit: 50,
          issue_opened: 3,
          issue_closed: 5,
          comment: 20,
        },
      },
      repos: [
        { repo: "org/repo1", eventCount: 50, commits: 30, pullRequests: 10, reviews: 8, issues: 2 },
        { repo: "org/repo2", eventCount: 40, commits: 15, pullRequests: 6, reviews: 5, issues: 4 },
        { repo: "org/repo3", eventCount: 21, commits: 5, pullRequests: 4, reviews: 2, issues: 2 },
      ],
      timeline: [],
    };

    it("returns complete prompt payload", () => {
      const result = buildWeeklyRetroPrompt("octocat", mockContext, [
        "https://github.com/org/repo/pull/1",
      ]);
      expect(result.systemPrompt).toBeTruthy();
      expect(result.userPrompt).toBeTruthy();
      expect(result.requiredHeadings).toHaveLength(4);
      expect(result.minWordCount).toBe(550);
    });

    it("includes username in prompt", () => {
      const result = buildWeeklyRetroPrompt("octocat", mockContext, []);
      expect(result.userPrompt).toContain("octocat");
    });

    it("includes allowed URLs when provided", () => {
      const urls = ["https://github.com/org/repo/pull/1"];
      const result = buildWeeklyRetroPrompt("octocat", mockContext, urls);
      expect(result.userPrompt).toContain(urls[0]);
    });

    it("handles empty allowed URLs", () => {
      const result = buildWeeklyRetroPrompt("octocat", mockContext, []);
      expect(result.userPrompt).toContain("no URLs available");
    });

    it("includes required headings", () => {
      const result = buildWeeklyRetroPrompt("octocat", mockContext, []);
      expect(result.requiredHeadings).toContain("## Accomplishments");
      expect(result.requiredHeadings).toContain("## Technical Insights");
      expect(result.requiredHeadings).toContain("## Challenges & Growth");
      expect(result.requiredHeadings).toContain("## Momentum & Direction");
    });

    it("has higher min word count than daily", () => {
      const daily = buildDailyStandupPrompt("user", mockContext, []);
      const weekly = buildWeeklyRetroPrompt("user", mockContext, []);
      expect(weekly.minWordCount).toBeGreaterThan(daily.minWordCount);
    });
  });
});
