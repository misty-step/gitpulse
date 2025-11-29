/**
 * Tests for Health Check utilities
 */

import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

// Store original env
const originalEnv = process.env;

describe("health utilities", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("HEALTH_DEEP_TIMEOUT_MS", () => {
    it("uses default timeout when env not set", async () => {
      delete process.env.HEALTH_DEEP_TIMEOUT_MS;
      const { HEALTH_DEEP_TIMEOUT_MS } = await import("../index");
      expect(HEALTH_DEEP_TIMEOUT_MS).toBe(5000);
    });

    it("uses env value when set", async () => {
      process.env.HEALTH_DEEP_TIMEOUT_MS = "10000";
      jest.resetModules();
      const { HEALTH_DEEP_TIMEOUT_MS } = await import("../index");
      expect(HEALTH_DEEP_TIMEOUT_MS).toBe(10000);
    });
  });

  describe("parseHealthMode", () => {
    it("returns deep when query param present", async () => {
      const { parseHealthMode } = await import("../index");
      const url = new URL("http://localhost/health?deep");
      expect(parseHealthMode(url)).toBe("deep");
    });

    it("returns liveness when no query param", async () => {
      const { parseHealthMode } = await import("../index");
      const url = new URL("http://localhost/health");
      expect(parseHealthMode(url)).toBe("liveness");
    });
  });

  describe("buildHealthResponse", () => {
    it("returns ok for liveness mode", async () => {
      const { buildHealthResponse } = await import("../index");
      const { body, ok } = buildHealthResponse("liveness");
      expect(ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.mode).toBe("liveness");
    });

    it("returns ok for deep mode with healthy convex", async () => {
      const { buildHealthResponse } = await import("../index");
      const { body, ok } = buildHealthResponse("deep", "ok");
      expect(ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.convex).toBe("ok");
    });

    it("returns error for deep mode with degraded convex", async () => {
      const { buildHealthResponse } = await import("../index");
      const { body, ok } = buildHealthResponse("deep", "degraded");
      expect(ok).toBe(false);
      expect(body.status).toBe("error");
      expect(body.error).toContain("degraded");
    });

    it("returns error for deep mode with error convex", async () => {
      const { buildHealthResponse } = await import("../index");
      const { body, ok } = buildHealthResponse("deep", "error");
      expect(ok).toBe(false);
      expect(body.status).toBe("error");
      expect(body.error).toContain("error");
    });
  });
});
