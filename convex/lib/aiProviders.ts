/**
 * AI Provider Abstraction
 *
 * Unified interface for Google Gemini and OpenRouter (150+ models).
 * Routes based on AI_PROVIDER env var or explicit selection.
 *
 * @example
 * ```ts
 * // Google Gemini (default)
 * const { model } = initializeGoogleProvider('gemini-2.5-flash', { logger });
 *
 * // OpenRouter (anthropic/claude-3.5-sonnet, meta-llama/llama-3.1-70b, etc.)
 * const { model } = initializeOpenRouterProvider('anthropic/claude-3.5-sonnet', { logger });
 *
 * // Auto-select based on AI_PROVIDER env var
 * const { model } = initializeProvider('gemini-2.5-flash', { logger });
 * ```
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { Logger } from "pino";

export type AIProvider = "google" | "openrouter";

interface SecretDiagnostics {
  present: boolean;
  prefix: string;
  length: number;
}

function getSecretDiagnostics(key: string | undefined): SecretDiagnostics {
  if (!key) {
    return { present: false, prefix: "", length: 0 };
  }
  return {
    present: true,
    prefix: key.slice(0, 4) + "...",
    length: key.length,
  };
}

type MinimalLogger = {
  info?: (context: Record<string, unknown>, message?: string) => void;
  error?: (context: Record<string, unknown>, message?: string) => void;
};

type ProviderLogger = Pick<Logger, "info" | "error"> | MinimalLogger;

export interface ProviderClient {
  model: LanguageModel;
  provider: AIProvider;
  modelId: string;
  diagnostics: SecretDiagnostics;
}

export interface InitializeProviderOptions {
  logger?: ProviderLogger;
  logContext?: Record<string, unknown>;
  deployment?: string;
}

/**
 * Initialize Google Gemini provider.
 *
 * Models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
 * Requires: GOOGLE_API_KEY env var
 */
export function initializeGoogleProvider(
  modelName: string,
  options: InitializeProviderOptions = {}
): ProviderClient {
  const apiKey = process.env.GOOGLE_API_KEY;
  const diagnostics = getSecretDiagnostics(apiKey);
  const logFields = {
    ...(options.logContext ?? {}),
    provider: "google",
    model: modelName,
    keyDiagnostics: diagnostics,
    deployment: options.deployment ?? process.env.CONVEX_CLOUD_URL ?? "unknown",
  };

  options.logger?.info?.(logFields, "Using Google AI provider");

  if (!apiKey?.trim()) {
    const errorMessage = "GOOGLE_API_KEY not configured in Convex environment";
    options.logger?.error?.(logFields, errorMessage);
    throw new Error(errorMessage);
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google(modelName) as unknown as LanguageModel;

  return { model, provider: "google", modelId: modelName, diagnostics };
}

/**
 * Initialize OpenRouter provider for multi-model access.
 *
 * Supports 150+ models via single API:
 * - anthropic/claude-3.5-sonnet
 * - meta-llama/llama-3.1-70b
 * - openai/gpt-4o
 * - google/gemini-2.5-pro
 * - mistralai/mixtral-8x22b
 *
 * Requires: OPENROUTER_API_KEY env var
 */
export function initializeOpenRouterProvider(
  modelId: string,
  options: InitializeProviderOptions = {}
): ProviderClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const diagnostics = getSecretDiagnostics(apiKey);
  const logFields = {
    ...(options.logContext ?? {}),
    provider: "openrouter",
    model: modelId,
    keyDiagnostics: diagnostics,
    deployment: options.deployment ?? process.env.CONVEX_CLOUD_URL ?? "unknown",
  };

  options.logger?.info?.(logFields, "Using OpenRouter provider");

  if (!apiKey?.trim()) {
    const errorMessage =
      "OPENROUTER_API_KEY not configured in Convex environment";
    options.logger?.error?.(logFields, errorMessage);
    throw new Error(errorMessage);
  }

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter(modelId) as unknown as LanguageModel;

  return { model, provider: "openrouter", modelId, diagnostics };
}

/**
 * Initialize AI provider based on AI_PROVIDER env var.
 *
 * Routes to Google (default) or OpenRouter based on configuration.
 * Allows switching providers without code changes.
 *
 * @param modelId - Model identifier
 *   - For Google: 'gemini-2.5-flash', 'gemini-2.5-pro'
 *   - For OpenRouter: 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o', etc.
 */
export function initializeProvider(
  modelId: string,
  options: InitializeProviderOptions = {}
): ProviderClient {
  const provider = (process.env.AI_PROVIDER || "google") as AIProvider;

  if (provider === "openrouter") {
    return initializeOpenRouterProvider(modelId, options);
  }

  return initializeGoogleProvider(modelId, options);
}

/**
 * Check which providers are configured.
 */
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (process.env.GOOGLE_API_KEY) providers.push("google");
  if (process.env.OPENROUTER_API_KEY) providers.push("openrouter");
  return providers;
}

/**
 * Model tier recommendations for GitPulse.
 */
export const MODEL_TIERS = {
  // Fast, cheap - daily standups
  fast: {
    google: "gemini-2.5-flash",
    openrouter: "meta-llama/llama-3.1-70b",
  },
  // Balanced - weekly retros
  balanced: {
    google: "gemini-2.5-pro",
    openrouter: "anthropic/claude-3.5-sonnet",
  },
  // Powerful - complex analysis
  powerful: {
    google: "gemini-2.5-pro",
    openrouter: "openai/gpt-4o",
  },
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;

/**
 * Get recommended model for task tier and provider.
 */
export function getModelForTier(
  tier: ModelTier,
  provider: AIProvider = "google"
): string {
  return MODEL_TIERS[tier][provider];
}
