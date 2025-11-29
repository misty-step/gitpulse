import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import * as llmOrchestrator from "../llmOrchestrator";
import type { PromptPayload } from "../prompts";
import { createMockPrompt } from "../../../tests/utils/factories";

const { generateWithOrchestrator, validateLLMMarkdown } = llmOrchestrator;

// Store original environment and fetch
const originalEnv = { ...process.env };
const originalFetch = global.fetch;


function makeOpenAISuccessResponse(content: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as Response);
}

function makeGeminiSuccessResponse(content: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: content }] } }],
    }),
  } as Response);
}

function makeErrorResponse(status: number, statusText: string, body: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    text: async () => body,
  } as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.GOOGLE_API_KEY = "test-google-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe("generateWithOrchestrator - provider fallback", () => {
  it("succeeds with first provider (OpenAI) for daily reports", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("openai.com")) {
        return makeOpenAISuccessResponse("## Work Completed\nBuilt feature X");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.markdown).toBe("## Work Completed\nBuilt feature X");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5.1-mini");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini when OpenAI fails", async () => {
    let callCount = 0;
    const mockFetch = jest.fn((url: string) => {
      callCount++;
      if (typeof url === "string" && url.includes("openai.com")) {
        // OpenAI fails with 500
        return makeErrorResponse(500, "Internal Server Error", "Service unavailable");
      }
      if (typeof url === "string" && url.includes("googleapis.com")) {
        // Gemini succeeds
        return makeGeminiSuccessResponse("## Work Completed\nBuilt feature Y");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.markdown).toBe("## Work Completed\nBuilt feature Y");
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(callCount).toBeGreaterThan(1); // Tried OpenAI first, then Gemini
  });

  it("throws when all providers fail", async () => {
    const mockFetch = jest.fn(() => {
      return makeErrorResponse(500, "Internal Server Error", "All services down");
    });
    global.fetch = mockFetch as any;

    await expect(
      generateWithOrchestrator("daily", createMockPrompt()),
    ).rejects.toThrow("LLM generation failed across all candidates");
  });

  it("tries multiple models within same provider before switching", async () => {
    const callLog: string[] = [];
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("openai.com")) {
        callLog.push("openai");
        return makeErrorResponse(503, "Service Unavailable", "Temporary outage");
      }
      if (typeof url === "string" && url.includes("googleapis.com")) {
        callLog.push("gemini");
        return makeGeminiSuccessResponse("## Work Completed\nSuccess");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    await generateWithOrchestrator("daily", createMockPrompt());

    // Should try OpenAI first (gpt-5.1-mini), then fall back to Gemini
    expect(callLog[0]).toBe("openai");
    expect(callLog[callLog.length - 1]).toBe("gemini");
  });
});

describe("generateWithOrchestrator - authentication errors", () => {
  it("skips provider when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("googleapis.com")) {
        return makeGeminiSuccessResponse("## Work Completed\nGemini success");
      }
      throw new Error("Should not reach here");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    // Should skip OpenAI entirely and use Gemini
    expect(result.provider).toBe("google");
  });

  it("skips provider when auth expires", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("openai.com")) {
        return makeErrorResponse(401, "Unauthorized", "invalid_api_key");
      }
      if (typeof url === "string" && url.includes("googleapis.com")) {
        return makeGeminiSuccessResponse("## Work Completed\nGemini fallback");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.provider).toBe("google");
    expect(result.markdown).toContain("Gemini fallback");
  });
});

describe("generateWithOrchestrator - different report types", () => {
  it("uses appropriate models for daily reports", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("gpt-5.1-mini")) {
        return makeOpenAISuccessResponse("Daily report");
      }
      return makeOpenAISuccessResponse("Daily report");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.model).toBe("gpt-5.1-mini");
  });

  it("uses appropriate models for weekly reports", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("gpt-5.1")) {
        return makeOpenAISuccessResponse("Weekly report");
      }
      return makeOpenAISuccessResponse("Weekly report");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("weekly", createMockPrompt());

    expect(result.model).toBe("gpt-5.1");
  });
});

describe("generateWithOrchestrator - error handling", () => {
  it("handles empty content from API", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("openai.com")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ choices: [] }),
        } as Response);
      }
      if (typeof url === "string" && url.includes("googleapis.com")) {
        return makeGeminiSuccessResponse("Gemini succeeds");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    // Should fall back to Gemini after OpenAI returns empty
    expect(result.provider).toBe("google");
  });

  it("trims whitespace from markdown output", async () => {
    const mockFetch = jest.fn(() => {
      return makeOpenAISuccessResponse("  \n\n## Report\n\nContent here  \n\n  ");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.markdown).toBe("## Report\n\nContent here");
    expect(result.markdown).not.toMatch(/^\s/);
    expect(result.markdown).not.toMatch(/\s$/);
  });
});

describe("validateLLMMarkdown", () => {
  it("returns no errors for valid markdown", () => {
    const markdown = "## Work Completed\n\nThis is a valid report with enough content to meet word count requirements. It contains multiple sentences and provides detailed information about what was accomplished during this period. The team made significant progress.\n\n## Key Decisions\n\nWe decided to use approach X because it provides better performance and maintainability.";
    const prompt = createMockPrompt();

    const errors = validateLLMMarkdown(markdown, prompt);

    expect(errors).toEqual([]);
  });

  it("detects empty content", () => {
    const errors = validateLLMMarkdown("", createMockPrompt());

    expect(errors).toContain("LLM returned empty content");
  });

  it("detects content below minimum word count", () => {
    const markdown = "## Work Completed\n\nToo short\n\n## Key Decisions\n\nX";
    const prompt = { ...createMockPrompt(), minWordCount: 100 };

    const errors = validateLLMMarkdown(markdown, prompt);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("Word count"))).toBe(true);
  });

  it("trims whitespace before validation", () => {
    const markdown = "  \n\n## Work Completed\n\nThis has enough words to pass validation and includes required headings.\n\n## Key Decisions\n\nDecisions here.  \n\n  ";
    const prompt = { ...createMockPrompt(), minWordCount: 10 };

    const errors = validateLLMMarkdown(markdown, prompt);

    // Should validate trimmed content, not reject due to whitespace
    expect(errors).toEqual([]);
  });
});

describe("generateWithOrchestrator - rate limiting", () => {
  it("continues to next provider on rate limit error", async () => {
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("openai.com")) {
        return makeErrorResponse(429, "Too Many Requests", "Rate limit exceeded");
      }
      if (typeof url === "string" && url.includes("googleapis.com")) {
        return makeGeminiSuccessResponse("## Report\nGemini success after rate limit");
      }
      throw new Error("Unexpected URL");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    expect(result.provider).toBe("google");
    expect(result.markdown).toContain("Gemini success");
  });
});

describe("generateWithOrchestrator - cost optimization", () => {
  it("tries cheaper models first for daily reports", async () => {
    let callCount = 0;
    const mockFetch = jest.fn((url: string, init?: RequestInit) => {
      callCount++;

      // First call should be to OpenAI gpt-5.1-mini (cheapest daily model)
      if (callCount === 1) {
        expect(typeof url).toBe("string");
        expect(url).toContain("openai.com");
        return makeOpenAISuccessResponse("## Work Completed\nFirst model success");
      }

      return makeErrorResponse(500, "Error", "Shouldn't reach here");
    });
    global.fetch = mockFetch as any;

    const result = await generateWithOrchestrator("daily", createMockPrompt());

    // Should use first (cheapest) model
    expect(result.model).toBe("gpt-5.1-mini");
    expect(result.provider).toBe("openai");
    expect(callCount).toBe(1); // Only called once since first succeeded
  });
});
