"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { request, type SyncResult } from "../lib/syncService";

/**
 * Public wrapper for manual sync requests from the UI
 *
 * Delegates to the SyncService which handles policy, job management, and status.
 * Users don't need to specify repositories or timestamps — the service calculates
 * appropriate defaults based on installation state.
 */
export const startBackfill = action({
  args: {
    installationId: v.number(),
    // Legacy args preserved for backward compatibility but ignored
    repositories: v.optional(v.array(v.string())),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        started: false,
        message: "Authentication required",
      };
    }

    // Delegate to SyncService with manual trigger
    return request(ctx, {
      installationId: args.installationId,
      trigger: "manual",
      // Pass through since/until if provided for backward compatibility
      since: args.since,
      until: args.until,
    });
  },
});
