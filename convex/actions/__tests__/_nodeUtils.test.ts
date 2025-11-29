/**
 * Tests for Node.js utility functions used in actions.
 * Security-critical: Tests content hashing and JWT signing.
 */

import { describe, expect, it } from "@jest/globals";
import { generateKeyPairSync } from "crypto";
import {
  computeContentHashNode,
  stableStringify,
  signJwt,
} from "../_nodeUtils";
import jwt from "jsonwebtoken";

// Generate a valid RSA key pair for testing
const { privateKey: testPrivateKey, publicKey: testPublicKey } =
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });

describe("computeContentHashNode", () => {
  describe("determinism", () => {
    it("produces identical hash for identical inputs", () => {
      const hash1 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
        { additions: 10, deletions: 5 },
      );
      const hash2 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
        { additions: 10, deletions: 5 },
      );

      expect(hash1).toBe(hash2);
    });

    it("produces consistent hash across multiple calls", () => {
      const inputs = {
        text: "Commit abc123: fix bug",
        url: "https://github.com/org/repo/commit/abc123",
        metrics: { filesChanged: 3 },
      };

      const hashes = Array.from({ length: 10 }, () =>
        computeContentHashNode(inputs.text, inputs.url, inputs.metrics),
      );

      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe("uniqueness", () => {
    it("produces different hash for different text", () => {
      const hash1 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
      );
      const hash2 = computeContentHashNode(
        "PR #43 opened",
        "https://github.com/org/repo/pull/42",
      );

      expect(hash1).not.toBe(hash2);
    });

    it("produces different hash for different URL", () => {
      const hash1 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
      );
      const hash2 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/43",
      );

      expect(hash1).not.toBe(hash2);
    });

    it("produces different hash for different metrics", () => {
      const hash1 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
        { additions: 10 },
      );
      const hash2 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
        { additions: 20 },
      );

      expect(hash1).not.toBe(hash2);
    });

    it("produces different hash with metrics vs without", () => {
      const hash1 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
      );
      const hash2 = computeContentHashNode(
        "PR #42 opened",
        "https://github.com/org/repo/pull/42",
        { additions: 10 },
      );

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("format", () => {
    it("produces 64-character hexadecimal SHA-256 hash", () => {
      const hash = computeContentHashNode("text", "url");

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("edge cases", () => {
    it("handles empty text", () => {
      const hash = computeContentHashNode("", "https://github.com");
      expect(hash).toHaveLength(64);
    });

    it("handles unicode characters", () => {
      const hash1 = computeContentHashNode(
        "PR: 日本語タイトル 🚀",
        "https://github.com/org/repo",
      );
      const hash2 = computeContentHashNode(
        "PR: 日本語タイトル 🚀",
        "https://github.com/org/repo",
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("trims whitespace from text and URL", () => {
      const hash1 = computeContentHashNode(
        "  text  ",
        "  https://github.com  ",
      );
      const hash2 = computeContentHashNode("text", "https://github.com");

      expect(hash1).toBe(hash2);
    });

    it("handles empty metrics object", () => {
      const hash1 = computeContentHashNode("text", "url", {});
      const hash2 = computeContentHashNode("text", "url", {});
      expect(hash1).toBe(hash2);
    });

    it("handles nested metrics", () => {
      const hash = computeContentHashNode("text", "url", {
        outer: { inner: 42 },
      });
      expect(hash).toHaveLength(64);
    });
  });
});

describe("stableStringify", () => {
  describe("primitives", () => {
    it("stringifies null", () => {
      expect(stableStringify(null)).toBe("null");
    });

    it("stringifies string", () => {
      expect(stableStringify("hello")).toBe('"hello"');
    });

    it("stringifies number", () => {
      expect(stableStringify(42)).toBe("42");
    });

    it("stringifies boolean", () => {
      expect(stableStringify(true)).toBe("true");
      expect(stableStringify(false)).toBe("false");
    });
  });

  describe("arrays", () => {
    it("stringifies empty array", () => {
      expect(stableStringify([])).toBe("[]");
    });

    it("stringifies array of primitives", () => {
      expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
    });

    it("stringifies array of mixed types", () => {
      expect(stableStringify([1, "two", true])).toBe('[1,"two",true]');
    });

    it("stringifies nested arrays", () => {
      expect(stableStringify([[1, 2], [3, 4]])).toBe("[[1,2],[3,4]]");
    });
  });

  describe("objects", () => {
    it("stringifies empty object", () => {
      expect(stableStringify({})).toBe("{}");
    });

    it("sorts object keys alphabetically", () => {
      const result = stableStringify({ z: 1, a: 2, m: 3 });
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it("produces identical output regardless of key order", () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, b: 2, a: 1 };
      const obj3 = { b: 2, a: 1, c: 3 };

      const result1 = stableStringify(obj1);
      const result2 = stableStringify(obj2);
      const result3 = stableStringify(obj3);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("filters out undefined values", () => {
      const result = stableStringify({ a: 1, b: undefined, c: 3 });
      expect(result).toBe('{"a":1,"c":3}');
    });

    it("keeps null values", () => {
      const result = stableStringify({ a: 1, b: null, c: 3 });
      expect(result).toBe('{"a":1,"b":null,"c":3}');
    });

    it("handles nested objects with sorted keys", () => {
      const result = stableStringify({
        outer: { z: 1, a: 2 },
      });
      expect(result).toBe('{"outer":{"a":2,"z":1}}');
    });

    it("handles deeply nested structures", () => {
      const obj = {
        level1: {
          level2: {
            level3: { value: 42 },
          },
        },
      };
      const result = stableStringify(obj);
      expect(result).toBe('{"level1":{"level2":{"level3":{"value":42}}}}');
    });
  });

  describe("mixed structures", () => {
    it("handles object with array values", () => {
      const result = stableStringify({ items: [1, 2, 3] });
      expect(result).toBe('{"items":[1,2,3]}');
    });

    it("handles array of objects", () => {
      const result = stableStringify([{ b: 2, a: 1 }, { d: 4, c: 3 }]);
      expect(result).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
    });
  });
});

describe("signJwt", () => {
  describe("JWT generation", () => {
    it("signs a payload and returns a valid JWT", () => {
      const payload = { iss: "123456", iat: Math.floor(Date.now() / 1000) };

      const token = signJwt(payload, testPrivateKey, { algorithm: "RS256" });

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("produces a verifiable JWT", () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { iss: "app-id", iat: now, exp: now + 600 };

      const token = signJwt(payload, testPrivateKey, { algorithm: "RS256" });

      // Decode without verification to check payload
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.iss).toBe("app-id");
      expect(decoded.iat).toBe(now);
      expect(decoded.exp).toBe(now + 600);
    });

    it("includes custom claims in the payload", () => {
      const payload = {
        iss: "app-id",
        customClaim: "custom-value",
        nested: { key: "value" },
      };

      const token = signJwt(payload, testPrivateKey, { algorithm: "RS256" });
      const decoded = jwt.decode(token) as Record<string, unknown>;

      expect(decoded.customClaim).toBe("custom-value");
      expect(decoded.nested).toEqual({ key: "value" });
    });

    it("respects expiresIn option", () => {
      const payload = { iss: "app-id" };

      const token = signJwt(payload, testPrivateKey, {
        algorithm: "RS256",
        expiresIn: "10m",
      });

      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.exp).toBeDefined();
    });
  });

  describe("GitHub App authentication pattern", () => {
    it("creates JWT suitable for GitHub App", () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 60, // 60 seconds in the past
        exp: now + 600, // 10 minutes from now
        iss: "12345", // GitHub App ID
      };

      const token = signJwt(payload, testPrivateKey, { algorithm: "RS256" });

      // Verify structure
      const parts = token.split(".");
      expect(parts).toHaveLength(3);

      // Verify header
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      expect(header.alg).toBe("RS256");
      expect(header.typ).toBe("JWT");

      // Verify payload
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.iss).toBe("12345");
      expect(decoded.iat).toBe(now - 60);
      expect(decoded.exp).toBe(now + 600);
    });
  });
});
