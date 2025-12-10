"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import {
  formatTimestamp,
  getGithubInstallUrl,
  needsIntegrationAttention,
} from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";
import type { UserSyncStatus } from "@/convex/sync/getStatus";
import { toast } from "sonner";

/**
 * IntegrationStatusBanner - centralizes integration health + sync progress.
 * Renders at most one warning CTA per page plus any active sync operations.
 *
 * Uses sync/getStatusForUser view-model for sync state (Phase 6 refactor).
 */
export function IntegrationStatusBanner() {
  const syncStatuses = useQuery(api.sync.getStatus.getStatusForUser);
  const { status: integrationStatus, isLoading: isIntegrationLoading } =
    useIntegrationStatus();
  const requestSync = useAction(api.actions.sync.requestSync.requestManualSync);
  const [isSyncRequesting, setIsSyncRequesting] = useState(false);

  if (syncStatuses === undefined || isIntegrationLoading) {
    return null;
  }

  // Filter to only active syncs (syncing, blocked, recovering, or finishing)
  const activeStatuses = syncStatuses.filter(
    (s) =>
      s.state === "syncing" ||
      s.state === "blocked" ||
      s.state === "recovering" ||
      s.state === "finishing"
  );

  const hasActiveSyncs = activeStatuses.length > 0;
  const showWarning = needsIntegrationAttention(integrationStatus);
  const primarySyncStatus = syncStatuses?.[0];

  // Check for recently completed sync (for completion summary)
  const recentCompletion = primarySyncStatus?.lastCompletedSync;

  const handleSyncClick = async () => {
    // Get the first installation ID from sync statuses
    // (typically users have one installation, but array supports multiple)
    const firstInstallation = syncStatuses?.[0];
    if (!firstInstallation) {
      toast.error("No installation found");
      return;
    }
    
    try {
      setIsSyncRequesting(true);
      const result = await requestSync({ 
        installationId: firstInstallation.installationId 
      });
      
      if (result.started) {
        toast.success("Sync started");
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      toast.error("Failed to start sync");
      console.error(error);
    } finally {
      setIsSyncRequesting(false);
    }
  };

  // Show completion banner briefly after sync completes
  const showCompletionBanner = !hasActiveSyncs && recentCompletion;

  // Don't render anything if everything is healthy and quiet
  if (!showWarning && !hasActiveSyncs && !showCompletionBanner) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      {showWarning && integrationStatus ? (
        <IntegrationWarningCard
          status={integrationStatus}
          onSyncClick={handleSyncClick}
          syncState={primarySyncStatus?.state}
          isSyncing={isSyncRequesting || hasActiveSyncs}
        />
      ) : null}
      {hasActiveSyncs ? <ActiveSyncCard statuses={activeStatuses} /> : null}
      {showCompletionBanner ? (
        <SyncCompletionBanner
          totalRepos={recentCompletion.totalRepos}
          eventsIngested={recentCompletion.eventsIngested}
        />
      ) : null}
    </div>
  );
}

function ActiveSyncCard({ statuses }: { statuses: UserSyncStatus[] }) {
  // Hooks must be called unconditionally, before any early returns
  const [elapsedText, setElapsedText] = useState("0s");
  const [countdownText, setCountdownText] = useState("");

  // Show the first active sync (blocked takes precedence, then syncing, then finishing)
  const activeStatus =
    statuses.find((s) => s.state === "blocked") ??
    statuses.find((s) => s.state === "syncing") ??
    statuses.find((s) => s.state === "finishing") ??
    statuses[0];

  const isBlocked = activeStatus?.state === "blocked";
  const isFinishing = activeStatus?.state === "finishing";

  useEffect(() => {
    if (!activeStatus) return; // Guard inside effect

    const updateTime = () => {
      const now = Date.now();

      // Elapsed (Duration)
      const start = activeStatus.batchProgress?.startedAt ?? now;
      const seconds = Math.floor((now - start) / 1000);
      if (seconds < 60) setElapsedText(`${seconds}s`);
      else setElapsedText(`${Math.floor(seconds / 60)}m ${seconds % 60}s`);

      // Countdown (if blocked)
      if (isBlocked && activeStatus.blockedUntil) {
        const remaining = Math.max(
          0,
          Math.floor((activeStatus.blockedUntil - now) / 1000)
        );
        if (remaining > 60) {
          setCountdownText(`${Math.floor(remaining / 60)}m ${remaining % 60}s`);
        } else {
          setCountdownText(`${remaining}s`);
        }
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [activeStatus, isBlocked]);

  if (!activeStatus) return null;

  // Batch progress info
  const batch = activeStatus.batchProgress;
  const totalRepos = batch?.totalRepos ?? 0;
  const completedRepos = batch?.completedRepos ?? 0;
  const currentRepo = batch?.currentRepo;
  const eventsIngested = batch?.eventsIngested ?? 0;
  
  // Progress percentage based on repos completed
  const progress = totalRepos > 0 ? Math.round((completedRepos / totalRepos) * 100) : 0;

  const displayName =
    currentRepo ??
    activeStatus.accountLogin ??
    `Installation ${activeStatus.installationId}`;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="relative flex items-center justify-center w-4 h-4">
            {isBlocked ? (
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-sm" />
            ) : (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>

          <h3 className="font-semibold text-sm tracking-tight text-foreground">
            {isBlocked
              ? "Rate Limit Cooldown"
              : isFinishing
                ? "Finishing up..."
                : totalRepos > 1
                  ? `Syncing repo ${Math.min(completedRepos + 1, totalRepos)} of ${totalRepos}`
                  : `Syncing ${displayName}`}
          </h3>
        </div>

        <div className="text-xs font-mono text-muted">
          {activeStatus.state.toUpperCase()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-muted h-1.5 rounded-full overflow-hidden mb-3 relative">
        <div
          className={`h-full transition-all duration-500 relative overflow-hidden ${
            isBlocked ? "bg-amber-400" : "bg-foreground"
          }`}
          style={{ width: `${Math.max(progress, 5)}%` }}
        >
          {isBlocked && (
            <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:12px_12px] animate-[progress-stripes_1s_linear_infinite]" />
          )}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex items-center justify-between text-xs text-foreground-muted font-mono">
        <div className="flex gap-4">
          <span>{eventsIngested} events</span>
          {currentRepo && totalRepos > 1 && (
            <span className="text-muted truncate max-w-[200px]" title={currentRepo}>
              {currentRepo}
            </span>
          )}
          <span className="text-muted">Duration: {elapsedText}</span>
        </div>

        <div className="flex items-center gap-4">
          {isBlocked && activeStatus.blockedUntil && (
            <span className="text-amber-600 font-semibold">
              Resuming in {countdownText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationWarningCard({
  status,
  onSyncClick,
  isSyncing,
  syncState,
}: {
  status: IntegrationStatus;
  onSyncClick: () => void;
  isSyncing: boolean;
  syncState?: UserSyncStatus["state"];
}) {
  const installUrl = getGithubInstallUrl();
  const isInstallMissing = status.kind === "missing_installation";
  const actionHref = isInstallMissing
    ? installUrl
    : "/dashboard/settings/repositories";
  const actionLabel = isInstallMissing ? "Connect GitHub" : "Settings";

  let description = "";
  if (status.kind === "stale_events") {
    description = `Last activity: ${formatTimestamp(status.lastEventTs)}`;
  } else if (status.kind === "missing_installation") {
    description = "Install the GitHub App to enable ingestion.";
  } else if (status.kind === "no_events") {
    description = "No activity ingested yet.";
  } else {
    description = "Integration attention needed.";
  }

  const isRecovering = syncState === "recovering";
  const isSyncInProgress = syncState === "syncing";
  const showSyncButton =
    !isRecovering && !isSyncInProgress && !isInstallMissing;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between">
      <div className="flex gap-3 items-center">
        <span className="text-amber-500 text-lg">⚠</span>
        <span>{description}</span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Primary Action (Fix or Settings) */}
        {isInstallMissing ? (
          <Link
            href={installUrl}
            className="whitespace-nowrap text-xs font-medium border border-amber-300 bg-white dark:bg-amber-900/50 dark:border-amber-700 px-3 py-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900 transition-colors"
          >
            Connect GitHub
          </Link>
        ) : isRecovering ? (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span>Recovering data...</span>
          </div>
        ) : isSyncInProgress ? (
          <Link
            href="/dashboard/settings/repositories"
            className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            Settings
          </Link>
        ) : showSyncButton ? (
          <>
            <button
              onClick={onSyncClick}
              disabled={isSyncing}
              className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 disabled:opacity-50 transition-colors"
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
            <div className="h-4 w-px bg-amber-300 dark:bg-amber-700" />
            <Link
              href="/dashboard/settings/repositories"
              className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
            >
              Settings
            </Link>
          </>
        ) : (
          <Link
            href="/dashboard/settings/repositories"
            className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Brief completion summary shown for ~30 seconds after sync completes.
 */
function SyncCompletionBanner({
  totalRepos,
  eventsIngested,
}: {
  totalRepos: number;
  eventsIngested: number;
}) {
  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-sm">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <span className="text-emerald-500">✓</span>
        <span>
          Synced {totalRepos} {totalRepos === 1 ? "repo" : "repos"},{" "}
          {eventsIngested} new {eventsIngested === 1 ? "event" : "events"}
        </span>
      </div>
    </div>
  );
}
