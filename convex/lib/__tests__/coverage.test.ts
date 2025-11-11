import { describe, expect, it } from "@jest/globals";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  computeCoverageSummary,
  validateCoverage,
  CoverageValidationError,
} from "../coverage";

describe("computeCoverageSummary", () => {
  it("aggregates usage per scope and sorts by scope key", () => {
    const summary = computeCoverageSummary([
      { scopeKey: "repo:alpha", used: true },
      { scopeKey: "repo:alpha", used: false },
      { scopeKey: "repo:beta", used: false },
    ]);

    expect(summary.coverageScore).toBeCloseTo(1 / 3);
    expect(summary.breakdown).toEqual([
      { scopeKey: "repo:alpha", used: 1, total: 2 },
      { scopeKey: "repo:beta", used: 0, total: 1 },
    ]);
  });

  it("returns zero coverage when there are no candidates", () => {
    const summary = computeCoverageSummary([]);
    expect(summary).toEqual({ coverageScore: 0, breakdown: [] });
  });
});

describe("validateCoverage", () => {
  const baseEvent = (id: string, repoId: string, url: string): Doc<"events"> => ({
    _id: id as Id<"events">,
    _creationTime: Date.now(),
    repoId: repoId as Id<"repos">,
    actorId: "actor" as Id<"users">,
    type: "commit",
    ts: Date.now(),
    canonicalText: "",
    sourceUrl: url,
    metadata: { url },
    contentScope: "event",
    contentHash: id,
    createdAt: Date.now(),
  });

  it("passes when cited events meet threshold", () => {
    const events = [
      baseEvent("evt1", "repo1", "https://example.com/1"),
      baseEvent("evt2", "repo1", "https://example.com/2"),
      baseEvent("evt3", "repo2", "https://example.com/3"),
      baseEvent("evt4", "repo2", "https://example.com/4"),
    ];

    const result = validateCoverage(
      events,
      {
        markdown: "",
        citations: ["https://example.com/1", "https://example.com/2", "https://example.com/3", "https://example.com/4"],
      },
      0.95
    );

    expect(result.pass).toBe(true);
    expect(result.coverageScore).toBe(1);
  });

  it("throws when coverage below threshold", () => {
    const events = [
      baseEvent("evt1", "repo1", "https://example.com/1"),
      baseEvent("evt2", "repo1", "https://example.com/2"),
      baseEvent("evt3", "repo2", "https://example.com/3"),
      baseEvent("evt4", "repo2", "https://example.com/4"),
    ];

    expect(() =>
      validateCoverage(
        events,
        {
          markdown: "",
          citations: ["https://example.com/1"],
        },
        0.75
      )
    ).toThrow(CoverageValidationError);
  });

  it("passes automatically when there are no events", () => {
    const result = validateCoverage([], { markdown: "", citations: [] });
    expect(result.pass).toBe(true);
    expect(result.coverageScore).toBe(1);
  });
});
