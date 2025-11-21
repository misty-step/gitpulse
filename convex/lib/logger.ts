import pino from "pino";

/**
 * Structured JSON logger for GitPulse
 *
 * Features:
 * - Structured JSON output for log aggregation
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Error object serialization
 * - Service context tagging
 *
 * Usage:
 *   logger.info({ userId, eventCount }, 'Processing events')
 *   logger.error({ err: error }, 'Failed to generate report')
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "gitpulse" },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
  },
});

/**
 * Emit structured metric for observability
 *
 * Replaces console.log-based metrics with structured logging.
 * Metrics are logged at info level with 'metric' field for filtering.
 *
 * @param metric - Metric name (e.g., 'events_ingested', 'report_latency_ms')
 * @param fields - Additional context fields
 */
export function emitMetric(
  metric: string,
  fields: Record<string, unknown> = {},
) {
  logger.info({ metric, ...fields }, `metric:${metric}`);
}
