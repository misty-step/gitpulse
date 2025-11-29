import { describe, expect, it } from "@jest/globals";
import { normalizeUrl } from "../url";

describe("normalizeUrl", () => {
  describe("null/undefined handling", () => {
    it("returns undefined for null input", () => {
      expect(normalizeUrl(null)).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      expect(normalizeUrl(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(normalizeUrl("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only string", () => {
      expect(normalizeUrl("   ")).toBeUndefined();
      expect(normalizeUrl("\t\n")).toBeUndefined();
    });
  });

  describe("whitespace trimming", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normalizeUrl("  https://github.com/org/repo  ")).toBe(
        "https://github.com/org/repo",
      );
    });

    it("trims tabs and newlines", () => {
      expect(normalizeUrl("\thttps://github.com\n")).toBe("https://github.com");
    });
  });

  describe("trailing slash removal", () => {
    it("removes trailing slash from URLs", () => {
      expect(normalizeUrl("https://github.com/org/repo/")).toBe(
        "https://github.com/org/repo",
      );
    });

    it("removes trailing slash from domain-only URLs", () => {
      expect(normalizeUrl("https://github.com/")).toBe("https://github.com");
    });

    it("preserves URLs without trailing slash", () => {
      expect(normalizeUrl("https://github.com/org/repo")).toBe(
        "https://github.com/org/repo",
      );
    });

    it("does not strip double slashes in protocol", () => {
      expect(normalizeUrl("https://github.com")).toBe("https://github.com");
    });

    it("handles single character path correctly", () => {
      // Single "/" should remain as-is (length 1, not stripped)
      expect(normalizeUrl("/")).toBe("/");
    });
  });

  describe("GitHub URL patterns", () => {
    it("normalizes pull request URLs", () => {
      expect(normalizeUrl("https://github.com/org/repo/pull/123/")).toBe(
        "https://github.com/org/repo/pull/123",
      );
    });

    it("normalizes commit URLs", () => {
      expect(normalizeUrl("https://github.com/org/repo/commit/abc123/")).toBe(
        "https://github.com/org/repo/commit/abc123",
      );
    });

    it("normalizes issue URLs", () => {
      expect(normalizeUrl("https://github.com/org/repo/issues/42/")).toBe(
        "https://github.com/org/repo/issues/42",
      );
    });

    it("normalizes review URLs with anchor", () => {
      expect(
        normalizeUrl(
          "https://github.com/org/repo/pull/123#pullrequestreview-456",
        ),
      ).toBe("https://github.com/org/repo/pull/123#pullrequestreview-456");
    });
  });

  describe("non-GitHub URLs", () => {
    it("normalizes generic HTTP URLs", () => {
      expect(normalizeUrl("http://example.com/path/")).toBe(
        "http://example.com/path",
      );
    });

    it("preserves query strings", () => {
      expect(normalizeUrl("https://example.com/path?query=value")).toBe(
        "https://example.com/path?query=value",
      );
    });

    it("preserves fragment identifiers", () => {
      expect(normalizeUrl("https://example.com/path#section")).toBe(
        "https://example.com/path#section",
      );
    });
  });
});
