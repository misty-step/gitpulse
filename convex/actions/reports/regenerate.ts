"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { generateReportForUser } from "../../lib/reportOrchestrator";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface RegenerateResult {
  reportId: Id<"reports"> | null;
  ghLogin: string;
  clerkId: string | null;
  startDate: number;
  endDate: number;
  kind: "daily" | "weekly";
}

export const regenerate = action({
  args: {
    clerkId: v.optional(v.string()),
    ghLogin: v.optional(v.string()),
    kind: v.union(v.literal("daily"), v.literal("weekly")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RegenerateResult> => {
    if (!args.clerkId && !args.ghLogin) {
      throw new Error("Provide either clerkId or ghLogin");
    }

    const identifier = args.clerkId
      ? ({ type: "clerkId", value: args.clerkId } as const)
      : ({ type: "ghLogin", value: args.ghLogin! } as const);

    const user: Doc<"users"> | null =
      identifier.type === "clerkId"
        ? await ctx.runQuery(api.users.getByClerkId, {
            clerkId: identifier.value,
          })
        : await ctx.runQuery(api.users.getByGhLogin, {
            ghLogin: identifier.value,
          });

    if (!user) {
      throw new Error(
        `User not found for ${identifier.type}=${identifier.value}`
      );
    }

    if (!user.githubUsername) {
      throw new Error(
        `User ${user.ghLogin} is missing githubUsername linkage; cannot generate reports`
      );
    }

    const endDate = args.endDate ?? Date.now();
    const expectedWindow = args.kind === "daily" ? DAY_IN_MS : DAY_IN_MS * 7;
    const startDate = args.startDate ?? endDate - expectedWindow;

    if (startDate >= endDate) {
      throw new Error("startDate must be earlier than endDate");
    }

    const reportId = await generateReportForUser(
      ctx,
      {
        userId: user.clerkId ?? `gh:${user.ghLogin}`,
        user,
        kind: args.kind,
        startDate,
        endDate,
      },
      { forceRegenerate: true }
    );

    return {
      reportId,
      ghLogin: user.ghLogin,
      clerkId: user.clerkId ?? null,
      startDate,
      endDate,
      kind: args.kind,
    };
  },
});
