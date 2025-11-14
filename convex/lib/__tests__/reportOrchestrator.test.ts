import { describe, expect, it, jest } from "@jest/globals";
import type { Doc, Id } from "../../_generated/dataModel";
import * as reportOrchestrator from "../reportOrchestrator";
import { isEventCited, CoverageValidationError } from "../coverage";

const { buildCacheKey, generateReportForUser, normalizeUrl } =
  reportOrchestrator;
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import { api, internal } from "../../_generated/api";

jest.mock("../../_generated/api", () => ({
  api: {
    events: { listByActor: "api.events.listByActor" },
    repos: { getById: "api.repos.getById" },
  },
  internal: {
    events: {
      countByActorInternal: "internal.events.countByActorInternal",
    },
    reports: {
      create: "internal.reports.create",
      getByCacheKey: "internal.reports.getByCacheKey",
    },
  },
}));

jest.mock("../reportContext", () => ({
  buildReportContext: jest.fn(() => ({
    context: {
      timeframe: { start: 0, end: 0 },
      totals: { eventCount: 1 },
    },
    allowedUrls: ["https://github.com/acme/gitpulse/pull/1"],
  })),
}));

jest.mock("../reportGenerator", () => ({
  generateDailyReportFromContext: jest.fn(async () => ({
    markdown: "## Report",
    html: "<h2>Report</h2>",
    citations: ["https://github.com/acme/gitpulse/pull/1"],
    provider: "google",
    model: "gemini-2.5-flash",
  })),
  generateWeeklyReportFromContext: jest.fn(),
}));

jest.mock("../metrics", () => ({
  emitMetric: jest.fn(),
}));

const reportContextModule = jest.requireMock(
  "../reportContext"
) as jest.Mocked<typeof import("../reportContext")>;
const reportGeneratorModule = jest.requireMock(
  "../reportGenerator"
) as jest.Mocked<typeof import("../reportGenerator")>;
const metricsModule = jest.requireMock("../metrics") as jest.Mocked<
  typeof import("../metrics")
>;

const { buildReportContext } = reportContextModule;
const { generateDailyReportFromContext } = reportGeneratorModule;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("reportOrchestrator helpers", () => {
  it("buildCacheKey stays stable regardless of event ordering", () => {
    const events: Array<Doc<"events">> = [
      {
        _id: "evt1" as Id<"events">,
        _creationTime: 0,
        repoId: "repo1" as Id<"repos">,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 1,
        canonicalText: "a",
        sourceUrl: "u",
        metadata: {},
        contentScope: "event",
        contentHash: "hash-a",
        createdAt: 0,
      },
      {
        _id: "evt2" as Id<"events">,
        _creationTime: 0,
        repoId: "repo2" as Id<"repos">,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 2,
        canonicalText: "b",
        sourceUrl: "u2",
        metadata: {},
        contentScope: "event",
        contentHash: "hash-b",
        createdAt: 0,
      },
    ];

    const keyA = buildCacheKey("daily", "user", 0, 10, events);
    const keyB = buildCacheKey("daily", "user", 0, 10, [events[1], events[0]]);
    const keyC = buildCacheKey("daily", "user", 0, 10, [
      { ...events[0], contentHash: "different" },
    ]);

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  it("normalizeUrl trims whitespace and drops trailing slash", () => {
    expect(normalizeUrl(" https://example.com/path ")).toBe(
      "https://example.com/path"
    );
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
    expect(normalizeUrl(undefined)).toBeUndefined();
  });

  it("isEventCited returns true when event url matches citations", () => {
    const event = {
      _id: "evt1" as Id<"events">,
      _creationTime: 0,
      repoId: "repo1" as Id<"repos">,
      actorId: "actor1" as Id<"users">,
      type: "pr_opened",
      ts: 1,
      canonicalText: "a",
      sourceUrl: "",
      metadata: { url: "https://github.com/acme/gitpulse/pull/1" },
      contentScope: "event",
      contentHash: "hash",
      createdAt: 0,
    } as Doc<"events">;

    const cited = isEventCited(event, new Set(["https://github.com/acme/gitpulse/pull/1"]));
    expect(cited).toBe(true);
  });
});

describe("generateReportForUser", () => {
  it("builds cache key and persists coverage info", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events: Array<Doc<"events">> = [
      {
        _id: "evt1" as Id<"events">,
        _creationTime: 0,
        repoId,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 1,
        canonicalText: "a",
        sourceUrl: "https://github.com/acme/gitpulse/pull/1",
        metadata: { url: "https://github.com/acme/gitpulse/pull/1" },
        contentScope: "event",
        contentHash: "hash-a",
        createdAt: 0,
      },
    ];

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    runMutation.mockResolvedValueOnce("report1" as Id<"reports">);

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const userDoc = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    const startDate = 0;
    const endDate = 1000;

    const cacheKey = buildCacheKey("daily", "clerk_user", startDate, endDate, events);

    (buildReportContext as jest.Mock).mockReturnValueOnce({
      context: {
        timeframe: { start: startDate, end: endDate },
        totals: { eventCount: events.length },
      },
      allowedUrls: ["https://github.com/acme/gitpulse/pull/1"],
    });

    const reportId = await generateReportForUser(ctx, {
      userId: "clerk_user",
      user: userDoc,
      kind: "daily",
      startDate,
      endDate,
    });

    expect(reportId).toBe("report1");
    expect(generateDailyReportFromContext).toHaveBeenCalled();

    expect(runMutation).toHaveBeenCalledWith(
      internal.reports.create,
      expect.objectContaining({
        cacheKey,
        coverageScore: 1,
        coverageBreakdown: [
          { scopeKey: "repo:acme/gitpulse", used: 1, total: 1 },
        ],
      })
    );
    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.cache_miss",
      expect.objectContaining({ cacheKey })
    );
  });

  it("returns cached report when cache key hits", async () => {
    const events: Array<Doc<"events">> = [];
    const cachedId = "cached-report" as Id<"reports">;
    const cachedDoc = {
      _id: cachedId,
    } as Doc<"reports">;

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(cachedDoc);

    const runMutation = createAsyncMock<Id<"reports">>();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    const userDoc = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    const result = await generateReportForUser(ctx, {
      userId: "clerk_user",
      user: userDoc,
      kind: "daily",
      startDate: 0,
      endDate: 100,
    });

    expect(result).toBe(cachedId);
    expect(runMutation).not.toHaveBeenCalled();
    expect(generateDailyReportFromContext).not.toHaveBeenCalled();
    expect(buildReportContext).not.toHaveBeenCalled();
    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.cache_hit",
      expect.objectContaining({ cacheKey: expect.any(String) })
    );
  });

  it("generates new report when event hashes change", async () => {
    const repoId = "repo1" as Id<"repos">;
    const firstEvents: Array<Doc<"events">> = [
      {
        _id: "evt1" as Id<"events">,
        _creationTime: 0,
        repoId,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 1,
        canonicalText: "a",
        sourceUrl: "https://github.com/acme/gitpulse/pull/1",
        metadata: { url: "https://github.com/acme/gitpulse/pull/1" },
        contentScope: "event",
        contentHash: "hash-a",
        createdAt: 0,
      },
    ];

    const secondEvents = [
      {
        ...firstEvents[0],
        contentHash: "hash-b",
        _id: "evt2" as Id<"events">,
      },
    ];

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(firstEvents)
      .mockResolvedValueOnce(firstEvents.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">)
      .mockResolvedValueOnce(secondEvents)
      .mockResolvedValueOnce(secondEvents.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    runMutation
      .mockResolvedValueOnce("report-first" as Id<"reports">)
      .mockResolvedValueOnce("report-second" as Id<"reports">);

    const ctx = createMockActionCtx({ runQuery, runMutation });
    const userDoc = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    const firstKey = buildCacheKey("daily", "clerk_user", 0, 10, firstEvents);
    const secondKey = buildCacheKey("daily", "clerk_user", 0, 10, secondEvents);

    await generateReportForUser(ctx, {
      userId: "clerk_user",
      user: userDoc,
      kind: "daily",
      startDate: 0,
      endDate: 10,
    });

    await generateReportForUser(ctx, {
      userId: "clerk_user",
      user: userDoc,
      kind: "daily",
      startDate: 0,
      endDate: 10,
    });

    expect(runMutation).toHaveBeenNthCalledWith(
      1,
      internal.reports.create,
      expect.objectContaining({ cacheKey: firstKey })
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      internal.reports.create,
      expect.objectContaining({ cacheKey: secondKey })
    );
  });

  it("fails closed when the number of retrieved events differs from expected count", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events: Array<Doc<"events">> = [
      {
        _id: "evt1" as Id<"events">,
        _creationTime: 0,
        repoId,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 1,
        canonicalText: "a",
        sourceUrl: "https://github.com/acme/gitpulse/pull/1",
        metadata: { url: "https://github.com/acme/gitpulse/pull/1" },
        contentScope: "event",
        contentHash: "hash-a",
        createdAt: 0,
      },
    ];

    const runQuery = createAsyncMock<unknown>();
    runQuery.mockResolvedValueOnce(events).mockResolvedValueOnce(events.length + 5);

    const runMutation = createAsyncMock<Id<"reports">>();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    await expect(
      generateReportForUser(ctx, {
        userId: "clerk_user",
        user: {
          _id: "user-doc" as Id<"users">,
          githubUsername: "octocat",
        } as Doc<"users">,
        kind: "daily",
        startDate: 0,
        endDate: 10,
      })
    ).rejects.toThrow("Event count mismatch");

    expect(generateDailyReportFromContext).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.event_count_mismatch",
      expect.objectContaining({
        expected: events.length + 5,
        seen: events.length,
      })
    );
  });

  it("processes 10k events with >=95% coverage when the token estimate stays within budget", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events = createBulkEvents(10_000, repoId);
    const citations = events.map((event) => event.metadata?.url as string);

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    runMutation.mockResolvedValueOnce("report-10k" as Id<"reports">);

    const ctx = createMockActionCtx({ runQuery, runMutation });
    const userDoc = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    const originalEstimate = process.env.REPORT_TOKENS_PER_EVENT_ESTIMATE;
    process.env.REPORT_TOKENS_PER_EVENT_ESTIMATE = "30";

    try {
      generateDailyReportFromContext.mockResolvedValueOnce({
        markdown: "## Report",
        html: "<h2>Report</h2>",
        citations,
        provider: "google",
        model: "gemini-2.5-flash",
      });

      const reportId = await generateReportForUser(ctx, {
        userId: "clerk_user",
        user: userDoc,
        kind: "daily",
        startDate: 0,
        endDate: 10,
      });

      expect(reportId).toBe("report-10k");

      expect(buildReportContext).toHaveBeenCalledWith(
        expect.objectContaining({ events })
      );

      expect(runMutation).toHaveBeenCalledWith(
        internal.reports.create,
        expect.objectContaining({
          coverageScore: 1,
        })
      );
    } finally {
      if (originalEstimate === undefined) {
        delete process.env.REPORT_TOKENS_PER_EVENT_ESTIMATE;
      } else {
        process.env.REPORT_TOKENS_PER_EVENT_ESTIMATE = originalEstimate;
      }
    }
  });

  it("warns when estimated tokens exceed the soft threshold", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events = createBulkEvents(8200, repoId);

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    runMutation.mockResolvedValueOnce("report1" as Id<"reports">);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = createMockActionCtx({ runQuery, runMutation });
    const user = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    generateDailyReportFromContext.mockResolvedValueOnce({
      markdown: "## Report",
      html: "<h2>Report</h2>",
      citations: events.map((event) => event.sourceUrl!),
      provider: "google",
      model: "gemini-2.5-flash",
    });

    await generateReportForUser(ctx, {
      userId: "clerk_user",
      user,
      kind: "daily",
      startDate: 0,
      endDate: 10,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Estimated token usage")
    );
    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.token_budget_warning",
      expect.objectContaining({ estimatedTokens: expect.any(Number) })
    );
    warnSpy.mockRestore();
  });

  it("throws when estimated tokens exceed the hard limit", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events = createBulkEvents(9600, repoId);

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    const ctx = createMockActionCtx({ runQuery, runMutation });
    const user = {
      _id: "user-doc" as Id<"users">,
      githubUsername: "octocat",
    } as Doc<"users">;

    await expect(
      generateReportForUser(ctx, {
        userId: "clerk_user",
        user,
        kind: "daily",
        startDate: 0,
        endDate: 10,
      })
    ).rejects.toThrow("Estimated token usage");

    expect(generateDailyReportFromContext).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.token_budget_exceeded",
      expect.objectContaining({ estimatedTokens: expect.any(Number) })
    );
  });

  it("throws when coverage validation fails", async () => {
    const repoId = "repo1" as Id<"repos">;
    const events: Array<Doc<"events">> = [
      {
        _id: "evt1" as Id<"events">,
        _creationTime: 0,
        repoId,
        actorId: "actor1" as Id<"users">,
        type: "pr_opened",
        ts: 1,
        canonicalText: "a",
        sourceUrl: "https://github.com/acme/gitpulse/pull/1",
        metadata: { url: "https://github.com/acme/gitpulse/pull/1" },
        contentScope: "event",
        contentHash: "hash-a",
        createdAt: 0,
      },
    ];

    const runQuery = createAsyncMock<unknown>();
    runQuery
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(events.length)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: repoId,
        _creationTime: 0,
        fullName: "acme/gitpulse",
      } as unknown as Doc<"repos">);

    const runMutation = createAsyncMock<Id<"reports">>();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    generateDailyReportFromContext.mockResolvedValueOnce({
      markdown: "## Report",
      html: "<h2>Report</h2>",
      citations: [],
      provider: "google",
      model: "gemini-2.5-flash",
    });

    await expect(
      generateReportForUser(ctx, {
        userId: "clerk_user",
        user: {
          _id: "user-doc" as Id<"users">,
          githubUsername: "octocat",
        } as Doc<"users">,
        kind: "daily",
        startDate: 0,
        endDate: 10,
      })
    ).rejects.toThrow(CoverageValidationError);

    expect(metricsModule.emitMetric).toHaveBeenCalledWith(
      "report.coverage_failed",
      expect.objectContaining({ userId: "clerk_user", kind: "daily" })
    );
  });
});

function createBulkEvents(
  count: number,
  repoId: Id<"repos">
): Array<Doc<"events">> {
  return Array.from({ length: count }, (_, index) => ({
    _id: `evt-bulk-${index}` as Id<"events">,
    _creationTime: 0,
    repoId,
    actorId: "actor1" as Id<"users">,
    type: "commit",
    ts: index,
    canonicalText: `Event ${index}`,
    sourceUrl: `https://example.com/${index}`,
    metadata: { url: `https://example.com/${index}` },
    contentScope: "event",
    contentHash: `hash-${index}`,
    createdAt: 0,
  }));
}
