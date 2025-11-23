"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { logger } from "../lib/logger.js";

export const runCleanup = internalAction({
  handler: async (ctx): Promise<number> => {
    let totalDeleted = 0;

    // Run in a loop to clear backlog faster
    for (let i = 0; i < 5; i++) {
      const completedDeleted = await ctx.runMutation(
        internal.ingestionJobs.clearCompletedJobs,
        {},
      );
      const zombiesFixed = await ctx.runMutation(
        internal.ingestionJobs.cleanupStuckJobs,
        {},
      );
      const blockedDeleted = await ctx.runMutation(
        internal.ingestionJobs.cleanOldBlockedJobs,
        {},
      );
      const ghostsDeleted = await ctx.runMutation(
        internal.ingestionJobs.forceDelete2025Jobs,
        {},
      );

      const batchTotal =
        completedDeleted + zombiesFixed + blockedDeleted + ghostsDeleted;
      totalDeleted += batchTotal;

      if (batchTotal === 0) break;

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info({ totalDeleted }, "Manual cleanup loop completed");
    return totalDeleted;
  },
});
