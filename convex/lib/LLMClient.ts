/**
 * LLM Provider Abstraction - Deep Module (October 2025)
 *
 * Simple interface hiding complex multi-provider logic.
 * Supports: Gemini 2.5 (Flash/Pro), GPT-5, with automatic fallback.
 *
 * Design Philosophy (Ousterhout):
 * - Deep module: Simple interface (`generate()`) hides provider complexity
 * - Information hiding: Caller doesn't know about API endpoints, auth, retry logic
 * - Single responsibility: All LLM access goes through this module
 *
 * Usage:
 *   const client = new LLMClient({ provider: "google", model: "gemini-2.5-flash" });
 *   const markdown = await client.generate({
 *     systemPrompt: "...",
 *     userPrompt: "...",
 *   });
 */

export type LLMProvider = "google" | "openai" | "auto";
export type LLMModel =
  | "gemini-2.5-flash"      // Google: Best price/performance, ~1M context
  | "gemini-2.5-pro"        // Google: Deep reasoning, multimodal
  | "gemini-2.5-flash-lite" // Google: Fastest, lowest cost
  | "gpt-5"                 // OpenAI: Superior reasoning, 400K context
  | "gpt-4.1"               // OpenAI: Long context (1M tokens)
  | "auto";                 // Auto-select based on task complexity

interface LLMConfig {
  provider: LLMProvider;
  model: LLMModel;
  temperature?: number;
  maxTokens?: number;
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}

export interface LLMRequestPayload {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * LLM Client - Unified interface for multiple providers
 *
 * Encapsulates:
 * - API authentication and endpoint management
 * - Request/response formatting per provider
 * - Retry logic with exponential backoff
 * - Rate limiting and error handling
 * - Model selection logic
 */
export class LLMClient {
  private config: Required<LLMConfig>;

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 2048,
    };

    // Auto-select provider if not specified
    if (this.config.provider === "auto") {
      this.config.provider = this.selectProvider();
    }

    // Auto-select model if not specified
    if (this.config.model === "auto") {
      this.config.model = this.selectModel();
    }
  }

  /**
   * Generate text from prompt
   *
   * @param prompt - Input prompt text
   * @param options - Override config options
   * @returns Generated markdown text
   */
  async generate(
    payload: LLMRequestPayload,
    options?: GenerateOptions
  ): Promise<string> {
    const temperature = options?.temperature ?? this.config.temperature;
    const maxTokens = options?.maxTokens ?? this.config.maxTokens;
    const retries = options?.retries ?? 3;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (this.config.provider === "google") {
          return await this.generateGoogle(payload, temperature, maxTokens);
        } else if (this.config.provider === "openai") {
          return await this.generateOpenAI(payload, temperature, maxTokens);
        } else {
          throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
      } catch (error) {
        lastError = error as Error;
        console.error(
          `LLM generation attempt ${attempt + 1}/${retries} failed:`,
          error
        );

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < retries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `LLM generation failed after ${retries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate using Google Gemini API
   */
  private async generateGoogle(
    payload: LLMRequestPayload,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    // Map model names to API identifiers
    const modelMap: Record<string, string> = {
      "gemini-2.5-flash": "gemini-2.5-flash",
      "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    };

    const modelId = modelMap[this.config.model] || "gemini-2.5-flash";

    // Use stable v1 endpoint, not v1beta
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent`;

    const response = await fetch(`${url}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          role: "system",
          parts: [{ text: payload.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: payload.userPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topK: 40,
          topP: 0.95,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Google Gemini");
    }

    const candidate = data.candidates[0];
    const finishReason = candidate?.finishReason ?? "unknown";
    const contentPart = candidate?.content?.parts?.find(
      (part: { text?: string }) => typeof part.text === "string"
    );

    if (!contentPart || !contentPart.text) {
      throw new Error(
        `Empty response from Google Gemini (finishReason: ${finishReason})`
      );
    }

    return contentPart.text;
  }

  /**
   * Generate using OpenAI API
   */
  private async generateOpenAI(
    payload: LLMRequestPayload,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Map model names to API identifiers
    const modelMap: Record<string, string> = {
      "gpt-5": "gpt-5",
      "gpt-4.1": "gpt-4.1",
    };

    const modelId = modelMap[this.config.model] || "gpt-5";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: payload.systemPrompt,
          },
          {
            role: "user",
            content: payload.userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI");
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return content;
  }

  /**
   * Select provider based on availability
   *
   * Preference order: Google (cheaper) > OpenAI (fallback)
   */
  private selectProvider(): "google" | "openai" {
    if (process.env.GOOGLE_API_KEY) {
      return "google";
    }
    if (process.env.OPENAI_API_KEY) {
      return "openai";
    }
    throw new Error("No LLM provider API keys configured");
  }

  /**
   * Select model based on provider
   *
   * Defaults:
   * - Google: gemini-2.5-flash (best price/performance)
   * - OpenAI: gpt-5 (best reasoning)
   */
  private selectModel(): LLMModel {
    if (this.config.provider === "google") {
      return "gemini-2.5-flash";
    }
    if (this.config.provider === "openai") {
      return "gpt-5";
    }
    return "gemini-2.5-flash"; // Safe default
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function for task-specific model selection
 *
 * Recommended models by task:
 * - Daily standups: gemini-2.5-flash (fast, cheap, sufficient)
 * - Weekly retros: gemini-2.5-pro (deeper analysis)
 * - Complex reports: gpt-5 (superior reasoning)
 */
export function createLLMClient(taskType: "daily" | "weekly" | "complex"): LLMClient {
  switch (taskType) {
    case "daily":
      return new LLMClient({
        provider: "google",
        model: "gemini-2.5-flash",
        temperature: 0.3,
        maxTokens: 1024,
      });

    case "weekly":
      return new LLMClient({
        provider: "google",
        model: "gemini-2.5-pro",
        temperature: 0.4,
        maxTokens: 2048,
      });

    case "complex":
      return new LLMClient({
        provider: "openai",
        model: "gpt-5",
        temperature: 0.3,
        maxTokens: 4096,
      });

    default:
      return new LLMClient({
        provider: "auto",
        model: "auto",
      });
  }
}
