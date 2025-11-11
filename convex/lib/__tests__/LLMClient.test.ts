import { describe, expect, it, jest } from "@jest/globals";
import { z } from "zod";
import { createLLMClient, LLMClient } from "../LLMClient";

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

describe("LLMClient deterministic generation", () => {
  const payload = { systemPrompt: "sys", userPrompt: "user" };
  const originalKey = process.env.GOOGLE_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-key";
    let counter = 0;
    (global as any).fetch = jest.fn(async (_url, init) => {
      counter += 1;
      const requestInit = (init ?? {}) as RequestInit;
      const body = JSON.parse((requestInit.body as string | undefined) ?? "{}");
      const temperature = body?.generationConfig?.temperature ?? 0.3;
      const text =
        temperature === 0
          ? "stable-output"
          : `variant-${counter}`;
      return makeGeminiResponse(text);
    });
  });

  afterAll(() => {
    process.env.GOOGLE_API_KEY = originalKey;
    (global as any).fetch = originalFetch;
  });

  it("returns identical output across repeated calls when temperature is zero", async () => {
    const client = createLLMClient("daily");
    const outputs = [
      await client.generate(payload),
      await client.generate(payload),
      await client.generate(payload),
    ];

    expect(new Set(outputs).size).toBe(1);
  });
});

describe("LLMClient structured generation", () => {
  const payload = { systemPrompt: "sys", userPrompt: "user" };
  const schema = z.object({ sections: z.array(z.string()) });
  const originalKey = process.env.GOOGLE_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-key";
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    process.env.GOOGLE_API_KEY = originalKey;
    (global as any).fetch = originalFetch;
  });

  it("validates structured responses via schema", async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValue(
      makeGeminiResponse(JSON.stringify({ sections: ["one"] }))
    );

    const client = new LLMClient({
      provider: "google",
      model: "gemini-2.5-flash",
    });

    const result = await client.generateStructured(payload, schema);
    expect(result).toEqual({ sections: ["one"] });

    const body = JSON.parse(
      ((fetchMock.mock.calls[0][1] as RequestInit).body as string) ?? "{}"
    );
    expect(body.generationConfig.response_mime_type).toBe("application/json");
    expect(body.generationConfig.response_schema).toBeDefined();
  });

  it("throws when JSON cannot be parsed", async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValue(makeGeminiResponse("not-json"));

    const client = new LLMClient({
      provider: "google",
      model: "gemini-2.5-flash",
    });

    await expect(client.generateStructured(payload, schema)).rejects.toThrow(
      "Structured response was not valid JSON"
    );
  });

  it("throws when schema validation fails", async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValue(
      makeGeminiResponse(
        JSON.stringify({ sections: [{ title: "missing string" }] })
      )
    );

    const client = new LLMClient({
      provider: "google",
      model: "gemini-2.5-flash",
    });

    await expect(client.generateStructured(payload, schema)).rejects.toThrow(
      "Structured response failed validation"
    );
  });

  it("rejects when provider is not google", async () => {
    const client = new LLMClient({
      provider: "openai",
      model: "gpt-5",
    });

    await expect(client.generateStructured(payload, schema)).rejects.toThrow(
      "Structured generation is only supported for the Google provider"
    );
  });
});

function getFetchMock() {
  return global.fetch as jest.MockedFunction<typeof fetch>;
}

function makeGeminiResponse(text: string): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
    text: async () => text,
  } as unknown as Response;
}
