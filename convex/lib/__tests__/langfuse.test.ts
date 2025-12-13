/**
 * Langfuse Observability Tests
 */

import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import {
  getLangfuse,
  flushLangfuse,
  isLangfuseConfigured,
  calculateCost,
  MODEL_PRICING,
} from "../langfuse";

// Mock langfuse module to avoid actual API calls
jest.mock("langfuse", () => {
  const mockFlushAsync = jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void);
  return {
    Langfuse: jest.fn().mockImplementation((config) => ({
      flushAsync: mockFlushAsync,
      trace: jest.fn(),
      ...(config || {}),
    })),
  };
});

describe("langfuse", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isLangfuseConfigured", () => {
    it("returns true when both keys are present", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";

      // Re-import to get fresh state
      const { isLangfuseConfigured: check } = require("../langfuse");
      expect(check()).toBe(true);
    });

    it("returns false when secret key is missing", () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";

      const { isLangfuseConfigured: check } = require("../langfuse");
      expect(check()).toBe(false);
    });

    it("returns false when public key is missing", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      delete process.env.LANGFUSE_PUBLIC_KEY;

      const { isLangfuseConfigured: check } = require("../langfuse");
      expect(check()).toBe(false);
    });

    it("returns false when both keys are missing", () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      const { isLangfuseConfigured: check } = require("../langfuse");
      expect(check()).toBe(false);
    });
  });

  describe("calculateCost", () => {
    it("calculates cost for known model", () => {
      // gemini-2.5-flash: input $0.075/1M, output $0.3/1M
      const cost = calculateCost("gemini-2.5-flash", 1000, 500);

      // 1000 * 0.075 / 1M + 500 * 0.3 / 1M
      // = 0.000075 + 0.00015 = 0.000225
      expect(cost).toBeCloseTo(0.000225, 6);
    });

    it("calculates cost for GPT-4o", () => {
      // gpt-4o: input $2.5/1M, output $10/1M
      const cost = calculateCost("gpt-4o", 10000, 2000);

      // 10000 * 2.5 / 1M + 2000 * 10 / 1M
      // = 0.025 + 0.02 = 0.045
      expect(cost).toBeCloseTo(0.045, 6);
    });

    it("returns zero for unknown model", () => {
      const cost = calculateCost("unknown-model", 1000, 1000);
      expect(cost).toBe(0);
    });

    it("handles embedding models (output cost zero)", () => {
      // voyage-3-large: input $0.1/1M, output $0
      const cost = calculateCost("voyage-3-large", 5000, 0);

      // 5000 * 0.1 / 1M = 0.0005
      expect(cost).toBeCloseTo(0.0005, 6);
    });

    it("handles zero tokens", () => {
      const cost = calculateCost("gemini-2.5-flash", 0, 0);
      expect(cost).toBe(0);
    });

    it("handles large token counts", () => {
      // 1M input tokens at $0.075/1M = $0.075
      const cost = calculateCost("gemini-2.5-flash", 1_000_000, 0);
      expect(cost).toBeCloseTo(0.075, 6);
    });
  });

  describe("MODEL_PRICING", () => {
    it("has pricing for major models", () => {
      expect(MODEL_PRICING["gemini-2.5-flash"]).toBeDefined();
      expect(MODEL_PRICING["gpt-4o"]).toBeDefined();
      expect(MODEL_PRICING["anthropic/claude-3.5-sonnet"]).toBeDefined();
      expect(MODEL_PRICING["voyage-3-large"]).toBeDefined();
    });

    it("has input and output pricing for each model", () => {
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing).toHaveProperty("input");
        expect(pricing).toHaveProperty("output");
        expect(typeof pricing.input).toBe("number");
        expect(typeof pricing.output).toBe("number");
        expect(pricing.input).toBeGreaterThanOrEqual(0);
        expect(pricing.output).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("getLangfuse", () => {
    it("throws error when keys not configured", () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      // Re-import to get fresh singleton state
      jest.resetModules();
      const { getLangfuse: get } = require("../langfuse");

      expect(() => get()).toThrow("Langfuse not configured");
    });

    it("creates instance when keys are present", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";

      jest.resetModules();
      const { getLangfuse: get } = require("../langfuse");

      const instance = get();
      expect(instance).toBeDefined();
    });

    it("returns same instance on subsequent calls (singleton)", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";

      jest.resetModules();
      const { getLangfuse: get } = require("../langfuse");

      const instance1 = get();
      const instance2 = get();
      expect(instance1).toBe(instance2);
    });

    it("uses custom host when provided", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
      process.env.LANGFUSE_HOST = "https://custom.langfuse.com";

      jest.resetModules();
      const { getLangfuse: get } = require("../langfuse");

      const instance = get();
      expect(instance.baseUrl).toBe("https://custom.langfuse.com");
    });

    it("uses default US cloud host when not specified", () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
      delete process.env.LANGFUSE_HOST;

      jest.resetModules();
      const { getLangfuse: get } = require("../langfuse");

      const instance = get();
      expect(instance.baseUrl).toBe("https://us.cloud.langfuse.com");
    });
  });

  describe("flushLangfuse", () => {
    it("does nothing when instance not created", async () => {
      // Fresh module without getLangfuse called
      jest.resetModules();
      const { flushLangfuse: flush } = require("../langfuse");

      // Should not throw
      await expect(flush()).resolves.toBeUndefined();
    });

    it("flushes when instance exists", async () => {
      process.env.LANGFUSE_SECRET_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-test";

      jest.resetModules();
      const { getLangfuse: get, flushLangfuse: flush } = require("../langfuse");

      const instance = get();
      await flush();

      expect(instance.flushAsync).toHaveBeenCalled();
    });
  });
});
