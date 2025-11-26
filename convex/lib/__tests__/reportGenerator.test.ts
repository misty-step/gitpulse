import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { ReportContext } from "../reportContext";
import * as reportGenerator from "../reportGenerator";
import * as promptsModule from "../prompts";
import * as markdownModule from "../markdown";
import * as llmOrchestratorModule from "../llmOrchestrator";

const {
  generateDailyReportFromContext,
  generateWeeklyReportFromContext,
  buildSyntheticDailyReport,
  buildSyntheticWeeklyReport,
} = reportGenerator;

// Mock dependencies
jest.mock("../prompts");
jest.mock("../markdown");
jest.mock("../llmOrchestrator");
jest.mock("../logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const prompts = jest.requireMock("../prompts") as jest.Mocked<
  typeof promptsModule
>;
const markdown = jest.requireMock("../markdown") as jest.Mocked<
  typeof markdownModule
>;
const llmOrchestrator = jest.requireMock(
  "../llmOrchestrator",
) as jest.Mocked<typeof llmOrchestratorModule>;

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock implementations
  markdown.markdownToHtml.mockImplementation((md: string) => `<p>${md}</p>`);
  prompts.extractCitations.mockReturnValue([]);
  llmOrchestrator.validateLLMMarkdown.mockReturnValue([]);
});

function createMockContext(overrides?: Partial<ReportContext>): ReportContext {
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

describe("generateDailyReportFromContext", () => {
  it("generates daily report with LLM for non-empty context", async () => {
    const context = createMockContext();
    const allowedUrls = ["https://github.com/acme/test-repo/pull/1"];

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: allowedUrls,
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Work Completed\nBuilt new feature",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    prompts.extractCitations.mockReturnValue([
      "https://github.com/acme/test-repo/pull/1",
    ]);

    const result = await generateDailyReportFromContext(
      "octocat",
      context,
      allowedUrls,
    );

    expect(result.markdown).toBe("## Work Completed\nBuilt new feature");
    expect(result.citations).toEqual([
      "https://github.com/acme/test-repo/pull/1",
    ]);
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(prompts.buildDailyStandupPrompt).toHaveBeenCalledWith(
      "octocat",
      context,
      allowedUrls,
    );
  });

  it("returns no-activity message for empty event context", async () => {
    const context = createMockContext({
      totals: { eventCount: 0, byType: {} },
    });

    const result = await generateDailyReportFromContext(
      "octocat",
      context,
      [],
    );

    expect(result.markdown).toContain("No GitHub activity");
    expect(result.citations).toEqual([]);
    expect(result.provider).toBe("system");
    expect(result.model).toBe("none");
    expect(llmOrchestrator.generateWithOrchestrator).not.toHaveBeenCalled();
  });

  it("falls back to synthetic report when LLM orchestrator fails", async () => {
    const context = createMockContext();

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: [],
    });

    llmOrchestrator.generateWithOrchestrator.mockRejectedValue(
      new Error("LLM timeout"),
    );

    const result = await generateDailyReportFromContext(
      "octocat",
      context,
      [],
    );

    expect(result.markdown).toContain("Generation failed");
    expect(result.markdown).toContain("3 commits");
    expect(result.provider).toBe("system");
    expect(result.model).toBe("none");
  });
});

describe("generateWeeklyReportFromContext", () => {
  it("generates weekly report with LLM for non-empty context", async () => {
    const context = createMockContext();
    const allowedUrls = ["https://github.com/acme/test-repo/pull/1"];

    prompts.buildWeeklyRetroPrompt.mockReturnValue({
      system: "Generate retro",
      user: "Context here",
      githubUrls: allowedUrls,
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Accomplishments\nShipped major feature",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    prompts.extractCitations.mockReturnValue([
      "https://github.com/acme/test-repo/pull/1",
    ]);

    const result = await generateWeeklyReportFromContext(
      "octocat",
      context,
      allowedUrls,
    );

    expect(result.markdown).toBe("## Accomplishments\nShipped major feature");
    expect(result.citations).toEqual([
      "https://github.com/acme/test-repo/pull/1",
    ]);
    expect(result.provider).toBe("google");
    expect(prompts.buildWeeklyRetroPrompt).toHaveBeenCalledWith(
      "octocat",
      context,
      allowedUrls,
    );
  });

  it("returns no-activity message for empty event context", async () => {
    const context = createMockContext({
      totals: { eventCount: 0, byType: {} },
    });

    const result = await generateWeeklyReportFromContext(
      "octocat",
      context,
      [],
    );

    expect(result.markdown).toContain("No GitHub activity");
    expect(result.citations).toEqual([]);
    expect(result.provider).toBe("system");
    expect(llmOrchestrator.generateWithOrchestrator).not.toHaveBeenCalled();
  });
});

describe("citation filtering", () => {
  it("filters citations to only allowed URLs", async () => {
    const context = createMockContext();
    const allowedUrls = [
      "https://github.com/acme/test-repo/pull/1",
      "https://github.com/acme/test-repo/pull/2",
    ];

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: allowedUrls,
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Report with citations",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    // LLM returns more URLs than allowed (including invalid ones)
    prompts.extractCitations.mockReturnValue([
      "https://github.com/acme/test-repo/pull/1",
      "https://github.com/other/repo/pull/99", // not in allowedUrls
      "https://github.com/acme/test-repo/pull/2",
      "https://example.com/malicious", // not a GitHub URL
    ]);

    const result = await generateDailyReportFromContext(
      "octocat",
      context,
      allowedUrls,
    );

    // Only allowed URLs should be in citations
    expect(result.citations).toEqual([
      "https://github.com/acme/test-repo/pull/1",
      "https://github.com/acme/test-repo/pull/2",
    ]);
  });

  it("deduplicates citations", async () => {
    const context = createMockContext();
    const allowedUrls = ["https://github.com/acme/test-repo/pull/1"];

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: allowedUrls,
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Report",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    // LLM mentions same URL multiple times
    prompts.extractCitations.mockReturnValue([
      "https://github.com/acme/test-repo/pull/1",
      "https://github.com/acme/test-repo/pull/1",
      "https://github.com/acme/test-repo/pull/1",
    ]);

    const result = await generateDailyReportFromContext(
      "octocat",
      context,
      allowedUrls,
    );

    // Should only appear once
    expect(result.citations).toEqual([
      "https://github.com/acme/test-repo/pull/1",
    ]);
  });

  it("returns empty citations when allowedUrls is empty", async () => {
    const context = createMockContext();

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: [],
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Report",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    prompts.extractCitations.mockReturnValue([
      "https://github.com/acme/test-repo/pull/1",
    ]);

    const result = await generateDailyReportFromContext("octocat", context, []);

    // No allowed URLs means no citations pass filter
    expect(result.citations).toEqual([]);
  });
});

describe("markdown to HTML conversion", () => {
  it("converts markdown to HTML for generated reports", async () => {
    const context = createMockContext();

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: [],
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Work\n- Did things",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    markdown.markdownToHtml.mockReturnValue("<h2>Work</h2><ul><li>Did things</li></ul>");

    const result = await generateDailyReportFromContext("octocat", context, []);

    expect(markdown.markdownToHtml).toHaveBeenCalledWith("## Work\n- Did things");
    expect(result.html).toBe("<h2>Work</h2><ul><li>Did things</li></ul>");
  });
});

describe("synthetic reports (LLM fallback)", () => {
  it("buildSyntheticDailyReport includes event counts", () => {
    const context = createMockContext({
      totals: {
        eventCount: 10,
        byType: {
          commit: 5,
          pr_opened: 3,
          review: 2,
        },
      },
    });

    const result = buildSyntheticDailyReport("octocat", context);

    expect(result.markdown).toContain("5 commits");
    expect(result.markdown).toContain("3 pull requests");
    expect(result.markdown).toContain("2 reviews");
    expect(result.provider).toBe("system");
    expect(result.model).toBe("none");
    expect(result.citations).toEqual([]);
  });

  it("buildSyntheticWeeklyReport includes event counts and repo count", () => {
    const context = createMockContext({
      totals: {
        eventCount: 20,
        byType: {
          commit: 15,
          pr_opened: 3,
          review: 2,
        },
      },
      repos: [
        { id: "repo1", name: "test-repo-1", owner: "acme" },
        { id: "repo2", name: "test-repo-2", owner: "acme" },
      ],
    });

    const result = buildSyntheticWeeklyReport("octocat", context);

    expect(result.markdown).toContain("15 commits");
    expect(result.markdown).toContain("3 pull requests");
    expect(result.markdown).toContain("2 reviews");
    expect(result.markdown).toContain("2 repositories");
    expect(result.provider).toBe("system");
    expect(result.citations).toEqual([]);
  });
});

describe("validation errors", () => {
  it("falls back to synthetic report when LLM output fails validation", async () => {
    const context = createMockContext();

    prompts.buildDailyStandupPrompt.mockReturnValue({
      system: "Generate standup",
      user: "Context here",
      githubUrls: [],
    });

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "Invalid format",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    llmOrchestrator.validateLLMMarkdown.mockReturnValue([
      "Missing required section",
      "Invalid structure",
    ]);

    const result = await generateDailyReportFromContext("octocat", context, []);

    // Should fall back to synthetic report due to validation error
    expect(result.provider).toBe("system");
    expect(result.model).toBe("none");
    expect(result.markdown).toContain("Generation failed");
  });
});
