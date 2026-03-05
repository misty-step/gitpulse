export type LlmAttemptLog = {
  enabled: boolean;
  modelId: string;
  status: "success" | "empty" | "error";
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
};

export function recordLlmAttempt(input: LlmAttemptLog): void {
  if (!input.enabled) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    component: "gitpulse.agent-core.llm",
    model: input.modelId,
    status: input.status,
    latencyMs: input.latencyMs,
    usage: input.usage ?? {},
    error: input.error,
  };

  console.info(`[gitpulse.llm] ${JSON.stringify(payload)}`);
}
