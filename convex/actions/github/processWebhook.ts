"use node";

import { v } from "convex/values";
import { internalAction, ActionCtx } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import {
  canonicalizeEvent,
  type CanonicalizeInput,
  type PullRequestWebhookEvent,
  type PullRequestReviewWebhookEvent,
  type IssuesWebhookEvent,
  type IssueCommentWebhookEvent,
} from "../../lib/canonicalizeEvent";
import { persistCanonicalEvent } from "../../lib/canonicalFactService";
import { logger } from "../../lib/logger.js";

/**
 * GitHub Installation webhook payload types
 */
interface InstallationAccount {
  id: number;
  login: string;
  type: string;
  node_id?: string;
  avatar_url?: string;
}

interface InstallationPayload {
  id: number;
  account: InstallationAccount;
  repository_selection: "all" | "selected";
  access_tokens_url?: string;
  repositories_url?: string;
  html_url?: string;
  app_id?: number;
  target_id?: number;
  target_type?: string;
  permissions?: Record<string, string>;
  events?: string[];
  created_at?: string;
  updated_at?: string;
}

interface InstallationWebhookEvent {
  action:
    | "created"
    | "deleted"
    | "suspend"
    | "unsuspend"
    | "new_permissions_accepted";
  installation: InstallationPayload;
  repositories?: Array<{
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  sender: {
    id: number;
    login: string;
    node_id?: string;
    avatar_url?: string;
    type?: string;
  };
}

interface InstallationRepositoriesWebhookEvent {
  action: "added" | "removed";
  installation: InstallationPayload;
  repository_selection: "all" | "selected";
  repositories_added?: Array<{
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  repositories_removed?: Array<{
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  sender: {
    id: number;
    login: string;
    node_id?: string;
  };
}

/**
 * Process GitHub webhook event asynchronously
 *
 * Algorithm per DESIGN.md processWebhookJob:
 * 1. Load envelope, ensure idempotency via processedDeliveries set
 * 2. Switch on event type; map to canonical payload (PR, commit, review, issue, push forced flag)
 * 3. Call CanonicalFactService.upsertFromWebhook per derived facts
 * 4. If push event w/ forced==true, mark affected repo windows dirty (re-run coverage + cache invalidation)
 * 5. Ack job, delete envelope if retention window passed
 *
 * Error handling:
 * - Malformed payload → DLQ
 * - Missing actor/repo → DLQ after upsert attempts
 * - Schema violations → DLQ
 */
export const processWebhook = internalAction({
  args: {
    webhookEventId: v.id("webhookEvents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      const webhookEvent = await ctx.runQuery(internal.webhookEvents.getById, {
        id: args.webhookEventId,
      });

      if (!webhookEvent) {
        logger.error(
          { webhookEventId: args.webhookEventId },
          "Webhook event not found",
        );
        return;
      }

      const { deliveryId, event, payload } = webhookEvent;

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "processing",
      });

      // Handle installation events separately (they create installation records, not events)
      if (event === "installation" || event === "installation_repositories") {
        const result = await handleInstallationEvent(
          ctx,
          event,
          payload,
          deliveryId,
        );
        await ctx.runMutation(internal.webhookEvents.updateStatus, {
          id: args.webhookEventId,
          status: "completed",
        });
        logger.info(
          {
            deliveryId,
            event,
            ...result,
          },
          "Installation event processed",
        );
        return;
      }

      const canonicalInputs = buildCanonicalInputs(event, payload);
      if (canonicalInputs.length === 0) {
        logger.warn({ event, deliveryId }, "Unsupported webhook event");
        await ctx.runMutation(internal.webhookEvents.updateStatus, {
          id: args.webhookEventId,
          status: "completed",
        });
        return;
      }

      const repoPayload = (payload as any)?.repository ?? null;
      const installationId = (payload as any)?.installation?.id;

      let inserted = 0;
      let duplicates = 0;

      for (const input of canonicalInputs) {
        const canonical = canonicalizeEvent(input);
        if (!canonical) {
          continue;
        }

        const result = await persistCanonicalEvent(ctx, canonical, {
          installationId,
          repoPayload,
        });

        if (result.status === "inserted") {
          inserted++;
        } else if (result.status === "duplicate") {
          duplicates++;
        }
      }

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "completed",
      });

      logger.info(
        {
          deliveryId,
          event,
          inserted,
          duplicates,
        },
        "Webhook processed",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          err: error,
          webhookEventId: args.webhookEventId,
        },
        "Webhook processing failed",
      );

      await ctx.runMutation(internal.webhookEvents.updateStatus, {
        id: args.webhookEventId,
        status: "failed",
        errorMessage,
        retryCount: 0,
      });
    } finally {
      const elapsed = Date.now() - startTime;
      logger.info(
        {
          webhookEventId: args.webhookEventId,
          elapsedMs: elapsed,
        },
        "Webhook processing finished",
      );
    }
  },
});

function buildCanonicalInputs(
  event: string,
  payload: unknown,
): CanonicalizeInput[] {
  switch (event) {
    case "pull_request":
      return [
        {
          kind: "pull_request",
          payload: payload as PullRequestWebhookEvent,
        },
      ];
    case "pull_request_review":
      return [
        {
          kind: "pull_request_review",
          payload: payload as PullRequestReviewWebhookEvent,
        },
      ];
    case "issues":
      return [
        {
          kind: "issues",
          payload: payload as IssuesWebhookEvent,
        },
      ];
    case "issue_comment":
      return [
        {
          kind: "issue_comment",
          payload: payload as IssueCommentWebhookEvent,
        },
      ];
    default:
      return [];
  }
}

/**
 * Handle GitHub App installation events
 *
 * Creates/updates installation records and links them to users.
 * The key is matching the webhook sender (who installed the app) to our user records.
 */
async function handleInstallationEvent(
  ctx: ActionCtx,
  event: string,
  payload: unknown,
  deliveryId: string,
): Promise<{ action: string; installationId: number; linkedToUser: boolean }> {
  if (event === "installation") {
    const installationPayload = payload as InstallationWebhookEvent;
    const { action, installation, sender, repositories } = installationPayload;

    // Try to find the user who performed this action by their GitHub ID
    const user = await ctx.runQuery(api.users.getByGhId, { ghId: sender.id });

    const clerkUserId = user?.clerkId || undefined;

    if (action === "created") {
      // Create the installation record
      const repoNames = repositories?.map((r) => r.full_name) || [];

      await ctx.runMutation(api.installations.upsert, {
        installationId: installation.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type,
        repositorySelection: installation.repository_selection,
        repositories: repoNames,
        clerkUserId,
        status: "active",
      });

      logger.info(
        {
          installationId: installation.id,
          account: installation.account.login,
          sender: sender.login,
          clerkUserId,
          repoCount: repoNames.length,
        },
        "Installation created",
      );

      // Automatically start backfill if we identified the user
      if (clerkUserId && repoNames.length > 0) {
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        await ctx.runAction(
          internal.actions.github.startBackfill.adminStartBackfill,
          {
            installationId: installation.id,
            clerkUserId,
            repositories: repoNames,
            since: ninetyDaysAgo,
          },
        );
        logger.info(
          { installationId: installation.id },
          "Auto-triggered backfill for new installation",
        );
      }

      return {
        action,
        installationId: installation.id,
        linkedToUser: !!clerkUserId,
      };
    }

    if (action === "deleted") {
      // Mark installation as deleted (or remove it)
      await ctx.runMutation(api.installations.upsert, {
        installationId: installation.id,
        accountLogin: installation.account.login,
        status: "deleted",
      });

      logger.info(
        {
          installationId: installation.id,
          account: installation.account.login,
        },
        "Installation deleted",
      );

      return {
        action,
        installationId: installation.id,
        linkedToUser: false,
      };
    }

    // Handle suspend/unsuspend
    if (action === "suspend" || action === "unsuspend") {
      await ctx.runMutation(api.installations.upsert, {
        installationId: installation.id,
        accountLogin: installation.account.login,
        status: action === "suspend" ? "suspended" : "active",
      });

      return {
        action,
        installationId: installation.id,
        linkedToUser: false,
      };
    }

    // Other actions (new_permissions_accepted) - just acknowledge
    return {
      action,
      installationId: installation.id,
      linkedToUser: false,
    };
  }

  if (event === "installation_repositories") {
    const reposPayload = payload as InstallationRepositoriesWebhookEvent;
    const { action, installation, repositories_added, repositories_removed } =
      reposPayload;

    // Get current installation to update its repository list
    const existing = await ctx.runQuery(api.installations.getByInstallationId, {
      installationId: installation.id,
    });

    let updatedRepos = existing?.repositories || [];

    if (action === "added" && repositories_added) {
      const addedNames = repositories_added.map((r) => r.full_name);
      updatedRepos = [...new Set([...updatedRepos, ...addedNames])];
    }

    if (action === "removed" && repositories_removed) {
      const removedNames = new Set(
        repositories_removed.map((r) => r.full_name),
      );
      updatedRepos = updatedRepos.filter(
        (name: string) => !removedNames.has(name),
      );
    }

    await ctx.runMutation(api.installations.upsert, {
      installationId: installation.id,
      accountLogin: installation.account.login,
      repositorySelection: reposPayload.repository_selection,
      repositories: updatedRepos,
    });

    logger.info(
      {
        installationId: installation.id,
        action,
        added: repositories_added?.length || 0,
        removed: repositories_removed?.length || 0,
        total: updatedRepos.length,
      },
      "Installation repositories updated",
    );

    return {
      action,
      installationId: installation.id,
      linkedToUser: false,
    };
  }

  // Unknown installation event type
  logger.warn({ event, deliveryId }, "Unknown installation event type");
  return {
    action: "unknown",
    installationId: 0,
    linkedToUser: false,
  };
}
