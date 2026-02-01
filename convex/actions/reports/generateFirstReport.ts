"use node";

/**
 * First Report Generation
 *
 * Auto-runs after onboarding to avoid a 24h wait.
 * Updates user.firstReportStatus for UI feedback.
 */

import { v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger";
import {
  ActionResult,
  success,
  failure,
  createError,
  ErrorCode,
} from "../../lib/types";

/**
 * Generates the user's first report immediately after onboarding completion.
 *
 * Sets status to "generating", invokes the daily report generator, then
 * updates status to "completed" or "failed" based on result. This avoids
 * making new users wait 24 hours for their first automated report.
 *
 * @param ctx - Convex action context
 * @param args.userId - Clerk user ID for the user
 * @returns ActionResult<null> indicating success or failure with error details
 */
export const generateFirstReport = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<ActionResult<null>> => {
    try {
      await ctx.runMutation(internal.users.setFirstReportStatus, {
        clerkId: args.userId,
        status: "generating",
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: args.userId,
        },
        "Failed to set first report status to generating",
      );
      return failure(
        createError(ErrorCode.UNKNOWN, "Failed to start report generation"),
      );
    }

    try {
      const result = await ctx.runAction(
        internal.actions.reports.generate.generateTodayDaily,
        { userId: args.userId },
      );

      if (result.success) {
        await ctx.runMutation(internal.users.setFirstReportStatus, {
          clerkId: args.userId,
          status: "completed",
        });
        return success(null);
      }

      const errorDetails = result.error as
        | { message?: string }
        | string
        | undefined;
      const errorMessage =
        typeof errorDetails === "string" ? errorDetails : errorDetails?.message;

      // Consolidate failure path by throwing - catch block handles status update
      throw new Error(errorMessage || "Report generation failed");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: args.userId,
        },
        "First report generation failed",
      );
      try {
        await ctx.runMutation(internal.users.setFirstReportStatus, {
          clerkId: args.userId,
          status: "failed",
        });
      } catch (statusError) {
        logger.error(
          {
            error:
              statusError instanceof Error
                ? statusError.message
                : String(statusError),
            userId: args.userId,
          },
          "Failed to update first report status to failed",
        );
      }

      return failure(
        createError(
          ErrorCode.UNKNOWN,
          error instanceof Error ? error.message : "Report generation failed",
        ),
      );
    }
  },
});

/**
 * Public action to manually trigger first report generation.
 *
 * Allows authenticated users to retry first report generation if it failed
 * or was not triggered during onboarding. Validates authentication before
 * delegating to the internal generateFirstReport action.
 *
 * @param ctx - Convex action context with auth
 * @returns ActionResult<null> indicating success or failure with error details
 */
export const generateFirstReportManual = action({
  args: {},
  handler: async (ctx): Promise<ActionResult<null>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return failure(
        createError(ErrorCode.NOT_AUTHENTICATED, "Authentication required"),
      );
    }

    const result = await ctx.runAction(
      internal.actions.reports.generateFirstReport.generateFirstReport,
      { userId: identity.subject },
    );
    if (result.success) {
      return success(null);
    }

    return failure(
      createError(
        ErrorCode.UNKNOWN,
        result.error?.message || "Report generation failed",
      ),
    );
  },
});
