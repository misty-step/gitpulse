import { createRouteMatcher } from "@clerk/nextjs/server";

export const PUBLIC_ROUTES = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
] as const;

export const publicRouteMatcher = createRouteMatcher(PUBLIC_ROUTES);
