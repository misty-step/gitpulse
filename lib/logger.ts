import pino from "pino";

/**
 * PII-sensitive field paths to redact from logs
 *
 * Prevents leaking sensitive data to log aggregators.
 * Mirrors the Convex logger redaction config.
 */
const REDACT_PATHS = [
  // User PII
  "email",
  "githubEmail",
  "clerkId",
  "userId",
  "ghLogin",
  "githubUsername",

  // OAuth tokens
  "accessToken",
  "githubAccessToken",
  "refreshToken",
  "githubRefreshToken",
  "token",
  "code",
  "access_token",
  "refresh_token",

  // HTTP headers with auth credentials
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",

  // API keys
  "apiKey",
  "clientSecret",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
];

/**
 * Structured JSON logger for Next.js routes
 *
 * Features:
 * - Structured JSON output for log aggregation (Vercel captures stdout)
 * - PII redaction for sensitive fields
 * - Error object serialization
 * - Service context tagging
 *
 * Usage:
 *   logger.info({ deliveryId, event }, 'Webhook received')
 *   logger.error({ err: error }, 'OAuth callback failed')
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "gitpulse-nextjs" },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
  },
});

