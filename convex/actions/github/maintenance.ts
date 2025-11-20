"use node";

import { internalAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { listAppInstallations } from "../../lib/githubApp";

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
  handler: async (ctx): Promise<{ fetched: number; created: number; linked: number }> => {
    console.log("[Maintenance] reconcileInstallations: fetching installations from GitHub API...");

    // Fetch all installations from GitHub API
    let githubInstallations;
    try {
      githubInstallations = await listAppInstallations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Maintenance] Failed to fetch installations from GitHub:", message);
      throw error;
    }

    console.log(`[Maintenance] Fetched ${githubInstallations.length} installations from GitHub API`);

    if (githubInstallations.length === 0) {
      return { fetched: 0, created: 0, linked: 0 };
    }

    let created = 0;
    let linked = 0;

    for (const ghInstall of githubInstallations) {
      // Check if we already have this installation locally
      const existing = await ctx.runQuery(api.installations.getByInstallationId, {
        installationId: ghInstall.id,
      });

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
        console.log(`[Maintenance] Created installation ${ghInstall.id} for ${ghInstall.account.login}`);
      }

      if (clerkUserId && (!existing || !existing.clerkUserId)) {
        linked++;
        console.log(`[Maintenance] Linked installation ${ghInstall.id} to user ${user!.ghLogin} (${clerkUserId})`);
      }
    }

    console.log(`[Maintenance] reconcileInstallations complete: fetched=${githubInstallations.length}, created=${created}, linked=${linked}`);

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
      if (install.status !== "active" || !install.clerkUserId || !install.repositories?.length) {
        return false;
      }
      
      const lastSynced = install.lastSyncedAt || 0;
      return (now - lastSynced) > staleThreshold;
    });

    console.log(`[Maintenance] Found ${staleInstallations.length} stale installations needing catch-up sync.`);

    for (const install of staleInstallations) {
      // Sync from last known sync time (minus 1 hour buffer) or default to 30 days if never synced
      const buffer = 60 * 60 * 1000;
      const since = install.lastSyncedAt 
        ? install.lastSyncedAt - buffer 
        : now - (30 * 24 * 60 * 60 * 1000);

      try {
        await ctx.runAction(internal.actions.github.startBackfill.adminStartBackfill, {
          installationId: install.installationId,
          clerkUserId: install.clerkUserId!,
          repositories: install.repositories!,
          since,
        });
        console.log(`[Maintenance] Triggered catch-up sync for installation ${install.installationId}`);
      } catch (error) {
        console.error(`[Maintenance] Failed to trigger catch-up for installation ${install.installationId}`, error);
      }
    }
  }
});

export const rotateSecrets = internalAction({
  args: {},
  handler: async () => {
    console.log("[Maintenance] rotateSecrets placeholder - implement dual-secret rotation workflow");
  },
});
