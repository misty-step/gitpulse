"use node";

import type { PromptPayload } from "./prompts";
import { markdownToHtml } from "./markdown";

type Provider = "google" | "openai";

type CandidateModel = {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
};

type GenerateResult = {
  markdown: string;
  provider: Provider;
  model: string;
};

const TASK_CANDIDATES: Record<"daily" | "weekly", CandidateModel[]> = {
  // cost-first ordering, all within approved list
  // temperature=0 for deterministic caching (cache key depends on prompt content, not randomness)
  daily: [
    {
      provider: "openai",
      model: "gpt-5.1-mini",
      temperature: 0,
      maxTokens: 1200,
    },
    {
      provider: "google",
      model: "gemini-2.5-flash",
      temperature: 0,
      maxTokens: 1200,
    },
    { provider: "openai", model: "gpt-5.1", temperature: 0, maxTokens: 1400 },
    {
      provider: "google",
      model: "gemini-3-pro-preview",
      temperature: 0,
      maxTokens: 1400,
    },
    {
      provider: "google",
      model: "gemini-2.5-pro",
      temperature: 0,
      maxTokens: 1400,
    },
  ],
  weekly: [
    { provider: "openai", model: "gpt-5.1", temperature: 0, maxTokens: 2400 },
    {
      provider: "google",
      model: "gemini-3-pro-preview",
      temperature: 0,
      maxTokens: 2400,
    },
    {
      provider: "google",
      model: "gemini-2.5-pro",
      temperature: 0,
      maxTokens: 2400,
    },
    {
      provider: "openai",
      model: "gpt-5.1-mini",
      temperature: 0,
      maxTokens: 1600,
    },
    {
      provider: "google",
      model: "gemini-2.5-flash",
      temperature: 0,
      maxTokens: 1600,
    },
  ],
};

type ProviderErrorCategory =
  | "missing_key"
  | "auth_expired"
  | "quota"
  | "invalid_param"
  | "other";

function categorizeOpenAIError(message: string): ProviderErrorCategory {
  if (
    message.includes("No API key") ||
    message.includes("OPENAI_API_KEY not configured")
  ) {
    return "missing_key";
  }
  if (
    message.includes("invalid_api_key") ||
    message.includes("api_key") ||
    message.includes("Unauthorized")
  ) {
    return "auth_expired";
  }
  if (
    message.includes("unsupported") ||
    message.includes("Unsupported value") ||
    message.includes("Unsupported parameter")
  ) {
    return "invalid_param";
  }
  return "other";
}

function categorizeGeminiError(message: string): ProviderErrorCategory {
  if (
    message.includes("API key expired") ||
    message.includes("API_KEY_INVALID")
  ) {
    return "auth_expired";
  }
  if (
    message.includes("API key not valid") ||
    message.includes("Missing or invalid credential")
  ) {
    return "missing_key";
  }
  if (message.includes("Quota") || message.includes("rate limit")) {
    return "quota";
  }
  return "other";
}

async function callOpenAI(
  payload: PromptPayload,
  candidate: CandidateModel,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const body: Record<string, any> = {
    model: candidate.model,
    messages: [
      { role: "system", content: payload.systemPrompt },
      { role: "user", content: payload.userPrompt },
    ],
    max_completion_tokens: candidate.maxTokens,
  };

  // Always set temperature explicitly (we use 0 for deterministic caching)
  body.temperature = candidate.temperature;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }
  return content as string;
}

async function callGemini(
  payload: PromptPayload,
  candidate: CandidateModel,
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const body: Record<string, any> = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${payload.systemPrompt}\n\n${payload.userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: candidate.temperature,
      maxOutputTokens: candidate.maxTokens,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Gemini API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty content");
  }
  return text as string;
}

export async function generateWithOrchestrator(
  kind: "daily" | "weekly",
  prompt: PromptPayload,
): Promise<GenerateResult> {
  const candidates = TASK_CANDIDATES[kind];
  const seenErrors: string[] = [];

  for (const candidate of candidates) {
    try {
      let markdown: string;
      if (candidate.provider === "openai") {
        markdown = await callOpenAI(prompt, candidate);
      } else {
        markdown = await callGemini(prompt, candidate);
      }
      return {
        markdown: markdown.trim(),
        provider: candidate.provider,
        model: candidate.model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      seenErrors.push(`${candidate.provider}/${candidate.model}: ${message}`);

      // If the error is clearly auth-related, skip other models of same provider
      const category =
        candidate.provider === "openai"
          ? categorizeOpenAIError(message)
          : categorizeGeminiError(message);

      if (category === "missing_key" || category === "auth_expired") {
        // Skip remaining candidates of this provider
        continue;
      }
      // Otherwise, try next candidate
    }
  }

  throw new Error(
    `LLM generation failed across all candidates for ${kind}. Errors: ${seenErrors.join(
      " | ",
    )}`,
  );
}

export function validateLLMMarkdown(
  markdown: string,
  prompt: PromptPayload,
): string[] {
  const errors: string[] = [];
  const trimmed = markdown.trim();

  if (!trimmed) {
    errors.push("LLM returned empty content");
    return errors;
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < prompt.minWordCount) {
    errors.push(`Word count ${wordCount} below minimum ${prompt.minWordCount}`);
  }

  for (const heading of prompt.requiredHeadings) {
    if (!trimmed.includes(heading)) {
      errors.push(`Missing required section heading: ${heading}`);
    }
  }

  return errors;
}

export function filterCitations(
  citations: string[],
  allowedUrls: string[],
): string[] {
  if (allowedUrls.length === 0) {
    return [];
  }

  const allowed = new Set(allowedUrls);
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const url of citations) {
    if (allowed.has(url) && !seen.has(url)) {
      unique.push(url);
      seen.add(url);
    }
  }

  return unique;
}

export function buildGeneratedReport(markdown: string, allowedUrls: string[]) {
  const citations = filterCitations(
    Array.from(markdown.matchAll(/\((https?:\/\/[^\s)]+)\)/g)).map((m) => m[1]),
    allowedUrls,
  );

  return {
    markdown,
    html: markdownToHtml(markdown),
    citations,
  };
}
