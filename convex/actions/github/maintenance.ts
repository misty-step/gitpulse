"use node";

import { internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { listAppInstallations } from "../../lib/githubApp";
import { logger } from "../../lib/logger.js";

/**
 * Reconcile installations from GitHub API with local database
 *
 * This maintenance job:
 * 1. Fetches all current installations from GitHub API
 * 2. Creates/updates local installation records
 * 3. Links installations to user accounts based on account login
 *
 * Run this to recover from missing webhook events or to sync state.
 */
export const reconcileInstallations = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ fetched: number; created: number; linked: number }> => {
    logger.info("Fetching installations from GitHub API");

    // Fetch all installations from GitHub API
    let githubInstallations;
    try {
      githubInstallations = await listAppInstallations();
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch installations from GitHub");
      throw error;
    }

    logger.info(
      { count: githubInstallations.length },
      "Fetched installations from GitHub API",
    );

    if (githubInstallations.length === 0) {
      return { fetched: 0, created: 0, linked: 0 };
    }

    let created = 0;
    let linked = 0;

    for (const ghInstall of githubInstallations) {
      // Check if we already have this installation locally
      const existing = await ctx.runQuery(
        api.installations.getByInstallationId,
        {
          installationId: ghInstall.id,
        },
      );

      // Try to find a user with matching GitHub login (for personal accounts)
      const user = await ctx.runQuery(api.users.getByGhLogin, {
        ghLogin: ghInstall.account.login,
      });

      const clerkUserId = user?.clerkId || undefined;

      // Determine status
      let status = "active";
      if (ghInstall.suspended_at) {
        status = "suspended";
      }

      // Create or update the installation record
      await ctx.runMutation(api.installations.upsert, {
        installationId: ghInstall.id,
        accountLogin: ghInstall.account.login,
        accountType: ghInstall.account.type,
        targetType: ghInstall.target_type,
        repositorySelection: ghInstall.repository_selection,
        clerkUserId,
        status,
      });

      if (!existing) {
        created++;
        logger.info(
          {
            installationId: ghInstall.id,
            accountLogin: ghInstall.account.login,
          },
          "Created installation",
        );
      }

      if (clerkUserId && (!existing || !existing.clerkUserId)) {
        linked++;
        logger.info(
          {
            installationId: ghInstall.id,
            ghLogin: user!.ghLogin,
            clerkUserId,
          },
          "Linked installation to user",
        );
      }
    }

    logger.info(
      {
        fetched: githubInstallations.length,
        created,
        linked,
      },
      "Reconcile installations complete",
    );

    return {
      fetched: githubInstallations.length,
      created,
      linked,
    };
  },
});

/**
 * Identify and sync stale installations.
 *
 * This acts as a safety net for missed webhooks.
 * It finds active installations that haven't synced in > 24 hours and triggers a backfill.
 */
export const runCatchUpSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const installations = await ctx.runQuery(internal.installations.listAll);

    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

    const staleInstallations = installations.filter((install) => {
      if (
        install.status !== "active" ||
        !install.clerkUserId ||
        !install.repositories?.length
      ) {
        return false;
      }

      const lastSynced = install.lastSyncedAt || 0;
      return now - lastSynced > staleThreshold;
    });

    logger.info(
      { count: staleInstallations.length },
      "Found stale installations needing catch-up sync",
    );

    for (const install of staleInstallations) {
      // Sync from last known sync time (minus 1 hour buffer) or default to 30 days if never synced
      const buffer = 60 * 60 * 1000;
      const since = install.lastSyncedAt
        ? install.lastSyncedAt - buffer
        : now - 30 * 24 * 60 * 60 * 1000;

      try {
        await ctx.runAction(
          internal.actions.github.startBackfill.adminStartBackfill,
          {
            installationId: install.installationId,
            clerkUserId: install.clerkUserId!,
            repositories: install.repositories!,
            since,
          },
        );
        logger.info(
          { installationId: install.installationId },
          "Triggered catch-up sync for installation",
        );
      } catch (error) {
        logger.error(
          { err: error, installationId: install.installationId },
          "Failed to trigger catch-up for installation",
        );
      }
    }
  },
});

export const rotateSecrets = internalAction({
  args: {},
  handler: async () => {
    logger.info(
      "rotateSecrets placeholder - implement dual-secret rotation workflow",
    );
  },
});
