import { computeCoverageSummary } from "./coverage";

describe("computeCoverageSummary", () => {
  it("returns zero coverage when no candidates", () => {
    const summary = computeCoverageSummary([]);
    expect(summary.coverageScore).toBe(0);
    expect(summary.breakdown).toHaveLength(0);
  });

  it("computes coverage and breakdown", () => {
    const summary = computeCoverageSummary([
      { scopeKey: "repo:a", used: true },
      { scopeKey: "repo:a", used: false },
      { scopeKey: "repo:b", used: true },
    ]);

    expect(summary.coverageScore).toBeCloseTo(2 / 3);
    expect(summary.breakdown).toEqual([
      { scopeKey: "repo:a", used: 1, total: 2 },
      { scopeKey: "repo:b", used: 1, total: 1 },
    ]);
  });
});
