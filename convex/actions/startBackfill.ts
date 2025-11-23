"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

type BackfillReturn = {
  ok: boolean;
  jobs: Array<{
    repo: string;
    jobId: string;
    status: string;
    blockedUntil?: number;
    eventsIngested?: number;
  }>;
};

/**
 * Public wrapper for startBackfill - delegates to internal implementation
 */
export const startBackfill = action({
  args: {
    installationId: v.number(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillReturn> => {
    return await ctx.runAction(
      internal.actions.github.startBackfill.startBackfill,
      args,
    );
  },
});
