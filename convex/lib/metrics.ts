import { emitMetric as emitMetricLogger } from "./logger.js";

export type MetricName =
  | "events_ingested"
  | "report_latency_ms"
  | "llm_cost_usd"
  | string;

/**
 * Emit structured metric for observability
 *
 * Delegates to Pino logger for structured JSON output.
 * Timestamp is automatically added by Pino.
 *
 * @param metric - Metric name
 * @param fields - Additional context fields
 */
export function emitMetric(
  metric: MetricName,
  fields: Record<string, unknown> = {},
) {
  emitMetricLogger(metric, fields);
}
