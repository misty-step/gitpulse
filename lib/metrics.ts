export type ClientMetricName = "ui_action" | "latency_ms" | string;

export function logClientMetric(
  metric: ClientMetricName,
  data: Record<string, unknown> = {},
) {
  const payload = {
    metric,
    timestamp: new Date().toISOString(),
    ...data,
  };

  if (process.env.NODE_ENV !== "production") {
    console.debug("[metric]", payload);
  }
}
