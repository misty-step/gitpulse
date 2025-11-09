import { computeContentHash, stableStringify } from "./contentHash";

describe("contentHash", () => {
  it("produces deterministic hash for canonical text + url + metrics", () => {
    const hashA = computeContentHash({
      canonicalText: "PR #123 opened by devin",
      sourceUrl: "https://github.com/acme/gitpulse/pull/123",
      metrics: { additions: 10, deletions: 2 },
    });

    const hashB = computeContentHash({
      canonicalText: "PR #123 opened by devin",
      sourceUrl: "https://github.com/acme/gitpulse/pull/123",
      metrics: { deletions: 2, additions: 10 },
    });

    expect(hashA).toBe(hashB);
  });

  it("changes when canonical text differs", () => {
    const hashA = computeContentHash({
      canonicalText: "Commit abc123 by devin",
      sourceUrl: "https://github.com/acme/gitpulse/commit/abc123",
    });
    const hashB = computeContentHash({
      canonicalText: "Commit def456 by devin",
      sourceUrl: "https://github.com/acme/gitpulse/commit/abc123",
    });

    expect(hashA).not.toBe(hashB);
  });

  it("stableStringify sorts keys consistently", () => {
    const json = stableStringify({ b: 2, a: 1, c: { d: 4, b: 3 } });
    expect(json).toBe('{"a":1,"b":2,"c":{"b":3,"d":4}}');
  });
});
