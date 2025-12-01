"use node";

/**
 * Sync Request Action — Public entrypoint for sync requests
 *
 * This action wraps the SyncService.request() function to make it
 * callable from other actions, crons, and mutations.
 *
 * All callers should use this action instead of calling startBackfill directly.
 */

import { v } from "convex/values";
import { internalAction, action } from "../../_generated/server";
import { request, type SyncResult } from "../../lib/syncService";

/**
 * Internal action for requesting a sync (used by crons, webhooks, maintenance)
 */
export const requestSync = internalAction({
  args: {
    installationId: v.number(),
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("maintenance")
    ),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    return request(ctx, {
      installationId: args.installationId,
      trigger: args.trigger,
      since: args.since,
      until: args.until,
    });
  },
});

/**
 * Public action for manual sync requests (used by UI)
 *
 * Requires authentication and validates that the user owns the installation.
 */
export const requestManualSync = action({
  args: {
    installationId: v.number(),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        started: false,
        message: "Authentication required",
      };
    }

    // The syncService will verify the user owns this installation
    return request(ctx, {
      installationId: args.installationId,
      trigger: "manual",
    });
  },
});
