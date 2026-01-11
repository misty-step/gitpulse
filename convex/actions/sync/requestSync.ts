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
import { internal } from "../../_generated/api";
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
      v.literal("maintenance"),
      v.literal("recovery")
    ),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    forceFullSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    return request(ctx, args);
  },
});

/**
 * Public action for manual sync requests (used by UI)
 *
 * Requires authentication and validates that the user owns the installation.
 *
 * Always performs a full 30-day sync (forceFullSync: true) to ensure
 * all historical events are captured regardless of lastSyncedAt state.
 */
export const requestManualSync = action({
  args: {
    installationId: v.number(),
    forceFullSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        started: false,
        message: "Authentication required",
      };
    }

    // Verify the user owns this installation
    const userInstallation = await ctx.runQuery(
      internal.userInstallations.getByUserAndInstallation,
      { userId: identity.subject, installationId: args.installationId }
    );

    if (!userInstallation) {
      return {
        started: false,
        message: "Installation not found or not authorized",
      };
    }

    // Default to full sync for manual requests to ensure complete data
    return request(ctx, {
      installationId: args.installationId,
      trigger: "manual",
      forceFullSync: args.forceFullSync ?? true,
    });
  },
});
