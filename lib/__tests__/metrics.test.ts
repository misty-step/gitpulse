/**
 * Client Metrics Tests
 */

import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { logClientMetric, type ClientMetricName } from "../metrics";

describe("logClientMetric", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleDebugSpy.mockRestore();
  });

  it("logs metric with timestamp in non-production", () => {
    process.env.NODE_ENV = "development";

    logClientMetric("ui_action", { action: "click", target: "button" });

    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "[metric]",
      expect.objectContaining({
        metric: "ui_action",
        action: "click",
        target: "button",
        timestamp: expect.any(String),
      })
    );
  });

  it("logs metric with empty data object", () => {
    process.env.NODE_ENV = "test";

    logClientMetric("latency_ms");

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "[metric]",
      expect.objectContaining({
        metric: "latency_ms",
        timestamp: expect.any(String),
      })
    );
  });

  it("does not log in production environment", () => {
    process.env.NODE_ENV = "production";

    logClientMetric("ui_action", { action: "navigate" });

    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it("accepts custom metric names", () => {
    process.env.NODE_ENV = "development";
    const customMetric: ClientMetricName = "custom_event";

    logClientMetric(customMetric, { customData: "value" });

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "[metric]",
      expect.objectContaining({
        metric: "custom_event",
        customData: "value",
      })
    );
  });

  it("includes ISO timestamp in payload", () => {
    process.env.NODE_ENV = "development";
    const beforeCall = new Date().toISOString();

    logClientMetric("ui_action");

    const afterCall = new Date().toISOString();
    const [, payload] = consoleDebugSpy.mock.calls[0] as [string, { timestamp: string }];

    expect(payload.timestamp >= beforeCall).toBe(true);
    expect(payload.timestamp <= afterCall).toBe(true);
  });
});
