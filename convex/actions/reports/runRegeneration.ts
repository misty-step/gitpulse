"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { generateReportForUser } from "../../lib/reportOrchestrator";
import { logger } from "../../lib/logger.js";

const STAGE_PROGRESS: Record<string, number> = {
  queued: 0,
  collecting: 0.2,
  generating: 0.6,
  validating: 0.85,
  saving: 0.95,
  completed: 1,
};

const STAGE_MESSAGE: Record<string, string> = {
  queued: "Queued",
  collecting: "Collecting GitHub activity",
  generating: "Generating summary",
  validating: "Validating coverage",
  saving: "Saving report",
  completed: "Report regenerated",
};

function progressFor(stage: keyof typeof STAGE_PROGRESS) {
  return STAGE_PROGRESS[stage] ?? 0;
}

export const run = internalAction({
  args: { jobId: v.id("reportRegenerations") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(
      internal.reportRegenerations.getByIdInternal,
      {
        jobId: args.jobId,
      },
    );

    if (!job) {
      logger.warn({ jobId: args.jobId }, "Regenerate job not found");
      return;
    }

    const report = await ctx.runQuery(api.reports.getById, {
      id: job.reportId,
    });
    if (!report) {
      await ctx.runMutation(internal.reportRegenerations.markFailed, {
        jobId: args.jobId,
        message: "Original report no longer exists",
      });
      return;
    }

    const primaryGhLogin = report.ghLogins[0];
    const fallbackGhLogin = report.userId.startsWith("gh:")
      ? report.userId.replace(/^gh:/, "")
      : undefined;

    let userDoc = report.userId.startsWith("gh:")
      ? null
      : await ctx.runQuery(api.users.getByClerkId, { clerkId: report.userId });

    if (!userDoc && primaryGhLogin) {
      userDoc = await ctx.runQuery(api.users.getByGhLogin, {
        ghLogin: primaryGhLogin,
      });
    }

    if (!userDoc && fallbackGhLogin) {
      userDoc = await ctx.runQuery(api.users.getByGhLogin, {
        ghLogin: fallbackGhLogin,
      });
    }

    if (!userDoc) {
      await ctx.runMutation(internal.reportRegenerations.markFailed, {
        jobId: args.jobId,
        message: "Unable to locate user for report",
      });
      return;
    }

    if (report.scheduleType !== "daily" && report.scheduleType !== "weekly") {
      await ctx.runMutation(internal.reportRegenerations.markFailed, {
        jobId: args.jobId,
        message: "Regeneration is only supported for scheduled reports",
      });
      return;
    }

    const stageUpdate = async (
      stage:
        | "collecting"
        | "generating"
        | "validating"
        | "saving"
        | "completed",
    ) => {
      if (stage === "completed") {
        return;
      }
      await ctx.runMutation(internal.reportRegenerations.updateJob, {
        jobId: args.jobId,
        status: stage,
        progress: progressFor(stage),
        message: STAGE_MESSAGE[stage],
      });
    };

    try {
      const newReportId: Id<"reports"> | null = await generateReportForUser(
        ctx,
        {
          userId: report.userId,
          user: userDoc,
          kind: report.scheduleType,
          startDate: report.startDate,
          endDate: report.endDate,
        },
        {
          forceRegenerate: true,
          onStage: stageUpdate,
        },
      );

      if (!newReportId) {
        await ctx.runMutation(internal.reportRegenerations.markFailed, {
          jobId: args.jobId,
          message: "Report generation skipped (missing GitHub username)",
        });
        return;
      }

      await ctx.runMutation(internal.reportRegenerations.markCompleted, {
        jobId: args.jobId,
        newReportId,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during regeneration";
      await ctx.runMutation(internal.reportRegenerations.markFailed, {
        jobId: args.jobId,
        message,
        stage:
          error instanceof Error && "stage" in error
            ? String((error as any).stage)
            : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.error({ err: error, jobId: args.jobId }, "Regenerate job failed");
    }
  },
});
