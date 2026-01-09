/**
 * Centralized analytics utility for funnel tracking.
 *
 * Uses Vercel Analytics track() with typed event names.
 * Provides `trackOnce` for deduplication of one-time events.
 */
import { track } from "@vercel/analytics";

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
  track(event, properties);
}

/**
 * Track a one-time event using localStorage deduplication.
 * Useful for "first" events that should only fire once per user.
 */
export function trackOnce(event: FunnelEvent, properties?: EventProperties) {
  if (typeof window === "undefined") return;

  const key = `gitpulse_tracked_${event}`;
  if (!localStorage.getItem(key)) {
    track(event, properties);
    localStorage.setItem(key, Date.now().toString());
  }
}
