/**
 * Tests for Health Check utilities
 */

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

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
      const { body, ok } = buildHealthResponse("deep", { status: "ok" });
      expect(ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.services?.convex?.status).toBe("ok");
    });

    it("returns error for deep mode with error convex", async () => {
      const { buildHealthResponse } = await import("../index");
      const { body, ok } = buildHealthResponse("deep", {
        status: "error",
        message: "Connection failed",
      });
      expect(ok).toBe(false);
      expect(body.status).toBe("error");
      expect(body.error).toContain("unhealthy");
    });

    it("returns ok for deep mode with all services healthy", async () => {
      const { buildHealthResponse } = await import("../index");
      const services = {
        convex: { status: "ok" as const, latencyMs: 50 },
        github: { status: "ok" as const, latencyMs: 100 },
        openrouter: { status: "ok" as const, latencyMs: 150 },
        clerk: { status: "ok" as const, latencyMs: 80 },
      };
      const { body, ok } = buildHealthResponse("deep", undefined, services);
      expect(ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(body.services).toEqual(services);
    });

    it("returns degraded when non-critical service fails", async () => {
      const { buildHealthResponse } = await import("../index");
      const services = {
        convex: { status: "ok" as const, latencyMs: 50 },
        github: { status: "error" as const, message: "API down" },
        openrouter: { status: "ok" as const, latencyMs: 150 },
        clerk: { status: "ok" as const, latencyMs: 80 },
      };
      const { body, ok } = buildHealthResponse("deep", undefined, services);
      // Degraded returns 200 (ok=true) but status is degraded
      expect(ok).toBe(true);
      expect(body.status).toBe("degraded");
    });

    it("returns error when convex (critical) fails", async () => {
      const { buildHealthResponse } = await import("../index");
      const services = {
        convex: { status: "error" as const, message: "Connection refused" },
        github: { status: "ok" as const, latencyMs: 100 },
        openrouter: { status: "ok" as const, latencyMs: 150 },
        clerk: { status: "ok" as const, latencyMs: 80 },
      };
      const { body, ok } = buildHealthResponse("deep", undefined, services);
      expect(ok).toBe(false);
      expect(body.status).toBe("error");
    });

    it("ignores unconfigured services", async () => {
      const { buildHealthResponse } = await import("../index");
      const services = {
        convex: { status: "ok" as const, latencyMs: 50 },
        github: { status: "ok" as const, latencyMs: 100 },
        openrouter: {
          status: "unconfigured" as const,
          message: "OPENROUTER_API_KEY not set",
        },
        clerk: { status: "ok" as const, latencyMs: 80 },
      };
      const { body, ok } = buildHealthResponse("deep", undefined, services);
      expect(ok).toBe(true);
      expect(body.status).toBe("ok");
    });
  });
});
