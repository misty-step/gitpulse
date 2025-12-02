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
  const baseEvent = (
    id: string,
    repoId: string,
    url: string,
  ): Doc<"events"> => ({
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
        citations: [
          "https://example.com/1",
          "https://example.com/2",
          "https://example.com/3",
          "https://example.com/4",
        ],
      },
      0.95,
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
        0.75,
      ),
    ).toThrow(CoverageValidationError);
  });

  it("passes automatically when there are no events", () => {
    const result = validateCoverage([], { markdown: "", citations: [] });
    expect(result.pass).toBe(true); // Still passes validation (no data to validate)
    expect(result.coverageScore).toBe(0); // Honest: 0 events = 0% coverage
  });

  it("passes when coverage meets a 95% threshold (e.g., 24/25 cited)", () => {
    const eventCount = 25;
    const citedCount = 24;
    const events = Array.from({ length: eventCount }, (_, index) =>
      baseEvent(
        `evt-${index}`,
        index % 2 === 0 ? "repo1" : "repo2",
        `https://example.com/${index}`,
      ),
    );
    const citations = events
      .slice(0, citedCount)
      .map((event) => event.sourceUrl!);

    const result = validateCoverage(events, { markdown: "", citations }, 0.95);

    expect(result.pass).toBe(true);
    expect(result.coverageScore).toBeCloseTo(citedCount / eventCount);
    expect(result.breakdown).toHaveLength(2);
  });

  it("throws with diagnostics when coverage falls to 94%", () => {
    const eventCount = 50;
    const citedCount = 47; // 94%
    const events = Array.from({ length: eventCount }, (_, index) =>
      baseEvent(
        `evt-${index}`,
        index % 3 === 0 ? "repo-alpha" : "repo-beta",
        `https://example.org/${index}`,
      ),
    );
    const citations = events
      .slice(0, citedCount)
      .map((event) => event.sourceUrl!);

    expect.assertions(5);
    try {
      validateCoverage(events, { markdown: "", citations }, 0.95);
    } catch (error) {
      expect(error).toBeInstanceOf(CoverageValidationError);
      const coverageError = error as CoverageValidationError;
      expect(coverageError.summary.coverageScore).toBeCloseTo(
        citedCount / eventCount,
      );
      expect(coverageError.summary.breakdown.length).toBeGreaterThan(0);
      expect(coverageError.threshold).toBe(0.95);
      expect(coverageError.message).toContain("94.00%");
      return;
    }
    throw new Error("Expected CoverageValidationError to be thrown");
  });
});
