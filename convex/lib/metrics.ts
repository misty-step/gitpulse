export type MetricName =
  | "events_ingested"
  | "report_latency_ms"
  | "llm_cost_usd"
  | string;

interface MetricPayload {
  metric: MetricName;
  timestamp: string;
  [key: string]: unknown;
}

export function emitMetric(metric: MetricName, fields: Record<string, unknown> = {}) {
  const payload: MetricPayload = {
    metric,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  // Structured log for ingestion into third-party tooling (e.g., DataDog, CloudWatch)
  console.log(JSON.stringify(payload));
}
