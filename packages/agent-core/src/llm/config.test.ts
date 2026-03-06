import { describe, expect, test } from "bun:test";

import { buildModelChain, readLlmRuntimeConfig } from "./config";

describe("readLlmRuntimeConfig", () => {
  test("uses defaults when env is empty", () => {
    const config = readLlmRuntimeConfig({});

    expect(config.primaryModel).toBe("anthropic/claude-sonnet-4.6");
    expect(config.fallbackModels.length).toBeGreaterThan(0);
    expect(config.maxSteps).toBe(6);
    expect(config.maxTotalMs).toBe(15_000);
    expect(config.retryDelayMs).toBe(750);
    expect(config.telemetryEnabled).toBe(false);
  });

  test("accepts explicit env overrides", () => {
    const config = readLlmRuntimeConfig({
      GITPULSE_MODEL_PRIMARY: "openai/gpt-5",
      GITPULSE_MODEL_FALLBACKS: "google/gemini-2.5-pro,openai/gpt-4.1-mini",
      GITPULSE_LLM_MAX_STEPS: "9",
      GITPULSE_LLM_MAX_TOTAL_MS: "12000",
      GITPULSE_LLM_RETRY_DELAY_MS: "600",
      GITPULSE_LLM_TELEMETRY: "false",
      GITPULSE_OPENROUTER_APP_NAME: "GitPulse-Tests",
      GITPULSE_OPENROUTER_REFERER: "https://example.com",
      GITPULSE_PROMPT_VERSION: "test.v1",
    });

    expect(config.primaryModel).toBe("openai/gpt-5");
    expect(config.fallbackModels).toEqual([
      "google/gemini-2.5-pro",
      "openai/gpt-4.1-mini",
    ]);
    expect(config.maxSteps).toBe(9);
    expect(config.maxTotalMs).toBe(12_000);
    expect(config.retryDelayMs).toBe(600);
    expect(config.telemetryEnabled).toBe(false);
    expect(config.appName).toBe("GitPulse-Tests");
    expect(config.referer).toBe("https://example.com");
    expect(config.promptVersion).toBe("test.v1");
  });
});

describe("buildModelChain", () => {
  test("puts override first and removes duplicates", () => {
    const config = readLlmRuntimeConfig({
      GITPULSE_MODEL_PRIMARY: "anthropic/claude-sonnet-4.6",
      GITPULSE_MODEL_FALLBACKS:
        "openai/gpt-5-mini,anthropic/claude-sonnet-4.6,openai/gpt-5-mini",
    });

    const chain = buildModelChain({
      config,
      overrideModel: "google/gemini-2.5-pro",
    });

    expect(chain).toEqual([
      "google/gemini-2.5-pro",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5-mini",
    ]);
  });

  test("rejects malformed positive integer env values and allows zero retry delay", () => {
    const config = readLlmRuntimeConfig({
      GITPULSE_LLM_MAX_STEPS: "9abc",
      GITPULSE_LLM_MAX_TOTAL_MS: "02000",
      GITPULSE_LLM_RETRY_DELAY_MS: "0",
    });

    expect(config.maxSteps).toBe(6);
    expect(config.maxTotalMs).toBe(15_000);
    expect(config.retryDelayMs).toBe(0);
  });
});
