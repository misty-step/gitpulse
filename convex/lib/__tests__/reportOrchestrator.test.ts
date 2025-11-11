import { describe, expect, it, jest } from "@jest/globals";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  buildCacheKey,
  generateReportForUser,
  isEventCited,
  normalizeUrl,
} from "../reportOrchestrator";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import { api, internal } from "../../_generated/api";

jest.mock("../../_generated/api", () => ({
  api: {
    events: { listByActor: "api.events.listByActor" },
    repos: { getById: "api.repos.getById" },
  },
  internal: {
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
  });
});
