import { createRouteMatcher } from "@clerk/nextjs/server";

// Immutable source of truth for public paths (keep data readonly to avoid drift).
export const PUBLIC_ROUTES = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
  "/preview(.*)",
] as const;

/**
 * Clerk's createRouteMatcher expects a mutable array; wrap to avoid leaking that
 * requirement to callers and keep PUBLIC_ROUTES readonly.
 */
export function createPublicRouteMatcher() {
  return createRouteMatcher([...PUBLIC_ROUTES]);
}

export const publicRouteMatcher = createPublicRouteMatcher();
