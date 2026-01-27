/**
 * Centralized analytics utility for funnel tracking.
 *
 * Uses PostHog capture() with typed event names.
 * Provides `trackOnce` for deduplication of one-time events.
 */
import posthog from "posthog-js";

export type FunnelEvent =
  | "signup_started"
  | "signup_completed"
  | "github_install_started"
  | "github_install_completed"
  | "first_sync_completed"
  | "first_report_viewed"
  | "report_generated";

type EventProperties = Record<string, string | number | boolean | null>;

/**
 * Track a funnel event with optional properties.
 */
export function trackFunnel(event: FunnelEvent, properties?: EventProperties) {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

/**
 * Track a one-time event using localStorage deduplication.
 * Useful for "first" events that should only fire once per user.
 */
export function trackOnce(event: FunnelEvent, properties?: EventProperties) {
  if (typeof window === "undefined") return;

  const key = `gitpulse_tracked_${event}`;
  if (!localStorage.getItem(key)) {
    posthog.capture(event, properties);
    localStorage.setItem(key, Date.now().toString());
  }
}

/**
 * Track a general event outside the funnel taxonomy.
 */
export function trackEvent(event: string, properties?: EventProperties) {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}
