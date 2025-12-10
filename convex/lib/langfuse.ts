/**
 * Langfuse Observability Singleton
 *
 * Tracing, spans, and generations for LLM observability in Convex serverless.
 * CRITICAL: Must call flushLangfuse() at the end of every action.
 *
 * @example
 * ```ts
 * const trace = getLangfuse().trace({ name: 'report-generation', userId });
 * const span = trace.span({ name: 'llm-call' });
 * const gen = span.generation({
 *   name: 'generate-daily-report',
 *   model: 'gemini-2.5-flash',
 *   input: { system: systemPrompt, user: userPrompt }
 * });
 * // ... LLM call ...
 * gen.end({ output, usage: { promptTokens, completionTokens } });
 * span.end();
 * await flushLangfuse(); // CRITICAL
 * ```
 */
import { Langfuse } from "langfuse";

let langfuseInstance: Langfuse | null = null;

/**
 * Get or create Langfuse singleton.
 *
 * Requires env vars: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY
 * Optional: LANGFUSE_HOST (defaults to US cloud)
 */
export function getLangfuse(): Langfuse {
  if (!langfuseInstance) {
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

    if (!secretKey || !publicKey) {
      throw new Error(
        "Langfuse not configured: LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY required"
      );
    }

    langfuseInstance = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: process.env.LANGFUSE_HOST ?? "https://us.cloud.langfuse.com",
      flushAt: 1, // Immediate flush - batching unreliable in serverless
    });
  }

  return langfuseInstance;
}

/**
 * Flush pending events to Langfuse.
 * MUST call at the end of every Convex action that uses tracing.
 *
 * In serverless, runtime may terminate before batched events are sent.
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuseInstance) {
    await langfuseInstance.flushAsync();
  }
}

/**
 * Check if Langfuse is configured (env vars present).
 * Use for conditional tracing - skip if not configured.
 */
export function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY
  );
}

/**
 * Model pricing for cost calculation (USD per 1M tokens)
 * Updated Dec 2025
 */
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  // Google Gemini
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "gemini-2.5-flash-lite": { input: 0.02, output: 0.1 },
  // OpenAI
  "gpt-5": { input: 10.0, output: 30.0 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  // OpenRouter models (via proxy)
  "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
  "meta-llama/llama-3.1-70b": { input: 0.35, output: 0.4 },
  // Voyage embeddings
  "voyage-3-large": { input: 0.1, output: 0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

/**
 * Calculate cost for a request given model and token counts.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 0, output: 0 };
  return (
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  );
}
