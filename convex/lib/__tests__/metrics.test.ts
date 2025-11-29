import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { emitMetric } from "../metrics";
import * as loggerModule from "../logger";

// Mock the logger module
jest.mock("../logger", () => ({
  emitMetric: jest.fn(),
}));

const mockEmitMetric = loggerModule.emitMetric as jest.MockedFunction<
  typeof loggerModule.emitMetric
>;

describe("emitMetric", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("delegation to logger", () => {
    it("delegates to logger emitMetric", () => {
      emitMetric("events_ingested", { count: 5 });

      expect(mockEmitMetric).toHaveBeenCalledTimes(1);
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        count: 5,
      });
    });

    it("passes empty fields object when not provided", () => {
      emitMetric("report_latency_ms");

      expect(mockEmitMetric).toHaveBeenCalledWith("report_latency_ms", {});
    });
  });

  describe("metric names", () => {
    it("accepts events_ingested metric", () => {
      emitMetric("events_ingested", { repo: "org/repo" });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        repo: "org/repo",
      });
    });

    it("accepts report_latency_ms metric", () => {
      emitMetric("report_latency_ms", { latency: 1500, provider: "google" });
      expect(mockEmitMetric).toHaveBeenCalledWith("report_latency_ms", {
        latency: 1500,
        provider: "google",
      });
    });

    it("accepts llm_cost_usd metric", () => {
      emitMetric("llm_cost_usd", { cost: 0.005, model: "gemini-2.5-flash" });
      expect(mockEmitMetric).toHaveBeenCalledWith("llm_cost_usd", {
        cost: 0.005,
        model: "gemini-2.5-flash",
      });
    });

    it("accepts custom string metric names", () => {
      emitMetric("custom_metric", { value: 42 });
      expect(mockEmitMetric).toHaveBeenCalledWith("custom_metric", {
        value: 42,
      });
    });
  });

  describe("fields handling", () => {
    it("passes string fields", () => {
      emitMetric("events_ingested", { repo: "org/repo", actor: "octocat" });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        repo: "org/repo",
        actor: "octocat",
      });
    });

    it("passes number fields", () => {
      emitMetric("events_ingested", { count: 100, duration: 1500 });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        count: 100,
        duration: 1500,
      });
    });

    it("passes boolean fields", () => {
      emitMetric("events_ingested", { success: true, cached: false });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        success: true,
        cached: false,
      });
    });

    it("passes nested object fields", () => {
      emitMetric("events_ingested", {
        metadata: { source: "webhook", type: "pr_opened" },
      });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        metadata: { source: "webhook", type: "pr_opened" },
      });
    });

    it("passes array fields", () => {
      emitMetric("events_ingested", { tags: ["important", "urgent"] });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        tags: ["important", "urgent"],
      });
    });

    it("passes null fields", () => {
      emitMetric("events_ingested", { error: null });
      expect(mockEmitMetric).toHaveBeenCalledWith("events_ingested", {
        error: null,
      });
    });
  });
});
