/**
 * Convex HTTP Routes
 *
 * Provides HTTP endpoints for health checks and external integrations.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Health check endpoint
 *
 * Verifies database connectivity and returns service status.
 * Used by monitoring systems (Vercel, uptime monitors, load balancers).
 *
 * Response:
 *   200 OK - { status: "ok", timestamp: 1234567890 }
 *   503 Service Unavailable - { status: "error", error: "message" }
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    try {
      // Verify database connectivity by attempting a simple query
      // This calls an internal query to check DB access
      await ctx.runQuery(internal.healthCheck.ping);

      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: Date.now(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now(),
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }
  }),
});

export default http;
