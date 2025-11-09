import { describe, expect, it } from "@jest/globals";
import { computeCoverageSummary } from "../coverage";

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
