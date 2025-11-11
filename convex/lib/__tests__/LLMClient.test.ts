import { describe, expect, it } from "@jest/globals";
import { createLLMClient } from "../LLMClient";

describe("LLMClient deterministic config", () => {
  it("forces temperature=0 for daily reports", () => {
    const client = createLLMClient("daily");
    expect(getInternalConfig(client).temperature).toBe(0);
  });

  it("forces temperature=0 for weekly reports", () => {
    const client = createLLMClient("weekly");
    expect(getInternalConfig(client).temperature).toBe(0);
  });

  it("leaves complex tasks at the configured temperature", () => {
    const client = createLLMClient("complex");
    expect(getInternalConfig(client).temperature).toBe(0.3);
  });
});

function getInternalConfig(client: unknown) {
  return (client as { config: { temperature: number } }).config;
}
