import pino from "pino";

/**
 * PII-sensitive field paths to redact from logs
 *
 * Prevents leaking sensitive data to log aggregators (Datadog, CloudWatch, etc.)
 * Redaction applies to nested object paths using dot notation.
 */
const REDACT_PATHS = [
  // User PII
  "email",
  "githubEmail",
  "clerkId",
  "userId",
  "oldUserId",
  "newUserId",
  "ghLogin",
  "githubUsername",

  // OAuth tokens
  "accessToken",
  "githubAccessToken",
  "refreshToken",
  "githubRefreshToken",
  "token",

  // HTTP headers with auth credentials
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",

  // API keys
  "apiKey",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "VOYAGE_API_KEY",
  "CLERK_SECRET_KEY",
];

/**
 * Structured JSON logger for GitPulse
 *
 * Features:
 * - Structured JSON output for log aggregation
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Error object serialization
 * - Service context tagging
 * - PII redaction for sensitive fields (email, tokens, auth headers)
 *
 * Usage:
 *   logger.info({ userId, eventCount }, 'Processing events')
 *   logger.error({ err: error }, 'Failed to generate report')
 *
 * Redaction:
 *   logger.info({ email: 'user@example.com' }, 'User logged in')
 *   // Output: { email: '[REDACTED]', msg: 'User logged in' }
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "gitpulse" },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
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
