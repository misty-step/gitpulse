/**
 * User-Installation mapping queries and mutations
 *
 * The userInstallations table stores N:M mapping between Clerk users
 * and GitHub App installations.
 */

import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Check if a user has access to an installation.
 * Returns the userInstallation record if found, null otherwise.
 */
export const getByUserAndInstallation = internalQuery({
  args: {
    userId: v.string(),
    installationId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userInstallations")
      .withIndex("by_user_and_installation", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .unique();
  },
});
