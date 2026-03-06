const DEFAULT_PRIMARY_MODEL = "anthropic/claude-sonnet-4.6";
const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-5-mini",
  "google/gemini-2.5-pro",
  "openai/gpt-4.1-mini",
];

export type LlmRuntimeConfig = {
  primaryModel: string;
  fallbackModels: string[];
  maxSteps: number;
  maxTotalMs: number;
  retryDelayMs: number;
  telemetryEnabled: boolean;
  appName: string;
  referer: string;
  promptVersion: string;
};

export function readLlmRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): LlmRuntimeConfig {
  const primaryModel = cleanModelId(
    env.GITPULSE_MODEL_PRIMARY ?? env.GITPULSE_MODEL
  ) ?? DEFAULT_PRIMARY_MODEL;

  const fallbackModels = cleanModelList(
    env.GITPULSE_MODEL_FALLBACKS,
    DEFAULT_FALLBACK_MODELS
  ).filter((modelId) => modelId !== primaryModel);

  return {
    primaryModel,
    fallbackModels,
    maxSteps: parsePositiveInt(env.GITPULSE_LLM_MAX_STEPS, 6),
    maxTotalMs: parsePositiveInt(env.GITPULSE_LLM_MAX_TOTAL_MS, 15_000),
    retryDelayMs: parseNonNegativeInt(env.GITPULSE_LLM_RETRY_DELAY_MS, 750),
    telemetryEnabled: parseBoolean(env.GITPULSE_LLM_TELEMETRY, false),
    appName: env.GITPULSE_OPENROUTER_APP_NAME ?? "GitPulse",
    referer: env.GITPULSE_OPENROUTER_REFERER ?? "https://gitpulse.local",
    promptVersion: env.GITPULSE_PROMPT_VERSION ?? "2026-03-05.v1",
  };
}

export function buildModelChain(input: {
  config: LlmRuntimeConfig;
  overrideModel?: string;
}): string[] {
  const override = cleanModelId(input.overrideModel);
  const chain = override
    ? [override, input.config.primaryModel, ...input.config.fallbackModels]
    : [input.config.primaryModel, ...input.config.fallbackModels];
  return dedupe(chain);
}

function cleanModelList(
  value: string | undefined,
  defaults: string[]
): string[] {
  if (!value) {
    return [...defaults];
  }

  const cleaned = value
    .split(",")
    .map((part) => cleanModelId(part))
    .filter((part): part is string => Boolean(part));

  return cleaned.length > 0 ? cleaned : [...defaults];
}

function cleanModelId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}
