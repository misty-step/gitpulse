/**
 * Health Check Query
 *
 * Provides simple database connectivity check for HTTP health endpoint.
 * Minimal resource usage - single query returning first result.
 */

import { internalQuery } from "./_generated/server";

/**
 * Ping database to verify connectivity
 *
 * Returns true if database is accessible.
 * Throws error if database is unavailable.
 *
 * Used by: convex/http.ts health endpoint
 */
export const ping = internalQuery({
  handler: async (ctx) => {
    // Simple query to verify database connectivity
    // Uses .first() to minimize resource usage
    await ctx.db.query("users").first();
    return true;
  },
});
