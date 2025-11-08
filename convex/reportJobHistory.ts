import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const logRun = internalMutation({
  args: {
    type: v.union(v.literal("daily"), v.literal("weekly")),
    hourUTC: v.number(),
    dayUTC: v.optional(v.number()),
    usersAttempted: v.number(),
    reportsGenerated: v.number(),
    errors: v.number(),
    durationMs: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reportJobHistory", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
