/**
 * Shared Sentry utilities.
 *
 * Centralizes PII scrubbing logic used across client, server, and edge configs.
 */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * List of sensitive field names to scrub from event extras.
 */
const SENSITIVE_EXTRA_FIELDS = [
  "password",
  "accessToken",
  "refreshToken",
  "token",
] as const;

/**
 * Scrub PII from Sentry events to comply with privacy requirements.
 *
 * Removes:
 * - user.email and user.ip_address
 * - Sensitive tokens from event extras
 */
export function scrubPii(
  event: ErrorEvent,
  _hint?: EventHint,
): ErrorEvent | null {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  if (event.extra) {
    for (const field of SENSITIVE_EXTRA_FIELDS) {
      delete event.extra[field];
    }
  }

  return event;
}

/**
 * Get the current environment for Sentry.
 */
export function getSentryEnvironment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}
