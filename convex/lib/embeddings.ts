/**
 * Embedding Generation for Convex Actions
 *
 * Adapted from packages/ai/src/embeddings.ts for Convex environment.
 * Deep module: Simple embedText interface hiding provider complexity.
 * Strategy pattern: Voyage primary, OpenAI fallback.
 */

import { logger } from "./logger.js";

/**
 * Embedding options
 */
export interface EmbedOptions {
  /** Force specific provider (bypasses fallback) */
  provider?: "voyage" | "openai";
  /** Custom model override */
  model?: string;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** Vector embedding (normalized array of numbers) */
  vector: number[];
  /** Provider used to generate embedding */
  provider: "voyage" | "openai";
  /** Model used */
  model: string;
  /** Dimension count */
  dimensions: number;
}

/**
 * Generate embedding using Voyage AI
 *
 * @param text - Text to embed (max 32K tokens for voyage-3-large)
 * @param apiKey - Voyage API key
 * @param model - Model name (default: 'voyage-3-large')
 * @returns Embedding vector (1024-dim for voyage-3-large)
 */
async function embedWithVoyage(
  text: string,
  apiKey: string,
  model: string = "voyage-3-large",
): Promise<EmbeddingResult> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  if (!data.data || data.data.length === 0) {
    throw new Error("Voyage API returned no embeddings");
  }

  const embedding = data.data[0];
  if (!embedding || !embedding.embedding) {
    throw new Error("Invalid embedding data from Voyage API");
  }

  return {
    vector: embedding.embedding,
    provider: "voyage",
    model,
    dimensions: embedding.embedding.length,
  };
}

/**
 * Generate embedding using OpenAI
 *
 * @param text - Text to embed (max 8K tokens for text-embedding-3-small)
 * @param apiKey - OpenAI API key
 * @param model - Model name (default: 'text-embedding-3-small')
 * @returns Embedding vector (1536-dim for text-embedding-3-small)
 */
async function embedWithOpenAI(
  text: string,
  apiKey: string,
  model: string = "text-embedding-3-small",
): Promise<EmbeddingResult> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  if (!data.data || data.data.length === 0) {
    throw new Error("OpenAI API returned no embeddings");
  }

  const embedding = data.data[0];
  if (!embedding || !embedding.embedding) {
    throw new Error("Invalid embedding data from OpenAI API");
  }

  return {
    vector: embedding.embedding,
    provider: "openai",
    model,
    dimensions: embedding.embedding.length,
  };
}

/**
 * Generate text embedding with automatic fallback
 *
 * Deep module design:
 * - Simple interface: Pass text and API keys, get vector
 * - Hides complexity: Provider selection, API calls, fallback logic
 * - Type-safe: Returns normalized result
 * - Resilient: Auto-fallback to OpenAI if Voyage fails
 *
 * Primary: Voyage-3-large (1024-dim, $0.10/1M tokens)
 * Fallback: OpenAI text-embedding-3-small (1536-dim, $0.02/1M tokens)
 *
 * @param text - Text to embed (single string)
 * @param voyageApiKey - Voyage API key (optional)
 * @param openaiApiKey - OpenAI API key (optional)
 * @param options - Optional provider/model override
 * @returns Embedding result with vector and metadata
 *
 * @example
 * const result = await embedText(
 *   "Fix authentication bug in login flow",
 *   process.env.VOYAGE_API_KEY,
 *   process.env.OPENAI_API_KEY
 * );
 * console.log(result.vector.length); // 1024 for Voyage
 * console.log(result.provider); // 'voyage' or 'openai'
 */
export async function embedText(
  text: string,
  voyageApiKey: string | undefined,
  openaiApiKey: string | undefined,
  options: EmbedOptions = {},
): Promise<EmbeddingResult> {
  // If provider explicitly specified, use only that provider
  if (options.provider === "openai") {
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }
    return embedWithOpenAI(text, openaiApiKey, options.model);
  }

  if (options.provider === "voyage") {
    if (!voyageApiKey) {
      throw new Error("Voyage API key not configured");
    }
    return embedWithVoyage(text, voyageApiKey, options.model);
  }

  // Auto-fallback logic: Try Voyage first, fall back to OpenAI
  try {
    if (voyageApiKey) {
      return await embedWithVoyage(text, voyageApiKey, options.model);
    }
  } catch (error) {
    logger.warn(
      { err: error },
      "Voyage embedding failed, falling back to OpenAI",
    );
  }

  // Fallback to OpenAI
  if (!openaiApiKey) {
    throw new Error("Both Voyage and OpenAI embedding failed");
  }

  return embedWithOpenAI(text, openaiApiKey, options.model);
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * Deep module design:
 * - Simple interface: Pass array of texts, get array of vectors
 * - Hides complexity: Parallel API calls, error handling
 * - Efficient: Parallel requests for better throughput
 *
 * @param texts - Array of texts to embed
 * @param voyageApiKey - Voyage API key (optional)
 * @param openaiApiKey - OpenAI API key (optional)
 * @param options - Optional provider/model override
 * @returns Array of embedding results
 *
 * @example
 * const results = await embedBatch(
 *   ["PR #123: Fix login bug", "PR #124: Add dark mode"],
 *   process.env.VOYAGE_API_KEY,
 *   process.env.OPENAI_API_KEY
 * );
 * console.log(results.length); // 2
 */
export async function embedBatch(
  texts: string[],
  voyageApiKey: string | undefined,
  openaiApiKey: string | undefined,
  options: EmbedOptions = {},
): Promise<EmbeddingResult[]> {
  // Execute embeddings in parallel
  return await Promise.all(
    texts.map((text) => embedText(text, voyageApiKey, openaiApiKey, options)),
  );
}
