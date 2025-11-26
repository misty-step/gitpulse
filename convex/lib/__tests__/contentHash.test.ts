import { computeContentHash, stableStringify } from "../contentHash";

describe("contentHash", () => {
  const baseInput = {
    canonicalText: "PR #1 – add auth",
    sourceUrl: "https://github.com/org/repo/pull/1",
    metrics: { additions: 10, deletions: 2, filesChanged: 3 },
  };

  it("produces deterministic hashes for identical input", () => {
    const first = computeContentHash(baseInput);
    const second = computeContentHash({ ...baseInput });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes hash when canonicalText differs", () => {
    const a = computeContentHash(baseInput);
    const b = computeContentHash({ ...baseInput, canonicalText: "PR #1 – add auth (v2)" });

    expect(a).not.toBe(b);
  });

  it("normalizes whitespace in canonicalText and sourceUrl", () => {
    const spaced = computeContentHash({
      ...baseInput,
      canonicalText: `  ${baseInput.canonicalText}   `,
      sourceUrl: ` ${baseInput.sourceUrl}  `,
    });
    const trimmed = computeContentHash(baseInput);

    expect(spaced).toBe(trimmed);
  });

  it("is stable across object key ordering in metrics", () => {
    const m1 = computeContentHash(baseInput);
    const m2 = computeContentHash({
      ...baseInput,
      metrics: { deletions: 2, filesChanged: 3, additions: 10 },
    });

    expect(m1).toBe(m2);
  });

  it("handles undefined metrics by omitting them", () => {
    const withMetrics = computeContentHash(baseInput);
    const withoutMetrics = computeContentHash({
      canonicalText: baseInput.canonicalText,
      sourceUrl: baseInput.sourceUrl,
    });

    expect(withMetrics).not.toBe(withoutMetrics);
  });

  it("supports unicode content deterministically", () => {
    const unicode = computeContentHash({
      ...baseInput,
      canonicalText: "修复：非ASCII 🚀",
    });
    const unicodeAgain = computeContentHash({
      ...baseInput,
      canonicalText: "修复：非ASCII 🚀",
    });

    expect(unicode).toBe(unicodeAgain);
  });

  it("handles nested metrics structures with stableStringify", () => {
    const complex = stableStringify({
      outer: { b: 2, a: 1 },
      arr: [3, { z: 1, y: 0 }],
    });
    expect(complex).toBe('{"arr":[3,{"y":0,"z":1}],"outer":{"a":1,"b":2}}');
  });

  it("stableStringify excludes undefined fields", () => {
    const value = stableStringify({ a: 1, b: undefined, c: null });
    expect(value).toBe('{"a":1,"c":null}');
  });

  it("different metrics values change the hash", () => {
    const base = computeContentHash(baseInput);
    const changed = computeContentHash({
      ...baseInput,
      metrics: { additions: 11, deletions: 2, filesChanged: 3 },
    });

    expect(base).not.toBe(changed);
  });

  it("array ordering influences hash deterministically", () => {
    const first = stableStringify([1, 2, { a: 1, b: 2 }]);
    const second = stableStringify([2, 1, { b: 2, a: 1 }]);

    expect(first).not.toBe(second);
  });
});
