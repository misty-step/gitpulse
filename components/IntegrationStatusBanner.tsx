"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import {
  formatTimestamp,
  getGithubInstallUrl,
  needsIntegrationAttention,
} from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";
import type { UserSyncStatus } from "@/convex/sync/getStatus";

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

  if (syncStatuses === undefined || isIntegrationLoading) {
    return null;
  }

  // Filter to only active syncs (syncing or blocked)
  const activeStatuses = syncStatuses.filter(
    (s) => s.state === "syncing" || s.state === "blocked"
  );

  const hasActiveSyncs = activeStatuses.length > 0;
  const showWarning = needsIntegrationAttention(integrationStatus);

  if (!showWarning && !hasActiveSyncs) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      {showWarning && integrationStatus ? (
        <IntegrationWarningCard status={integrationStatus} />
      ) : null}
      {hasActiveSyncs ? <ActiveSyncCard statuses={activeStatuses} /> : null}
    </div>
  );
}

function ActiveSyncCard({ statuses }: { statuses: UserSyncStatus[] }) {
  // Hooks must be called unconditionally, before any early returns
  const [elapsedText, setElapsedText] = useState("0s");
  const [countdownText, setCountdownText] = useState("");

  // Show the first active sync (running/blocked takes precedence)
  const activeStatus =
    statuses.find((s) => s.state === "blocked") ??
    statuses.find((s) => s.state === "syncing") ??
    statuses[0];

  const isBlocked = activeStatus?.state === "blocked";

  useEffect(() => {
    if (!activeStatus) return; // Guard inside effect

    const updateTime = () => {
      const now = Date.now();

      // Elapsed (Duration)
      const start = activeStatus.activeJobProgress?.startedAt ?? now;
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

  const progress = activeStatus.activeJobProgress?.total ?? 0;
  const displayName =
    activeStatus.activeJobProgress?.currentRepo ??
    activeStatus.accountLogin ??
    `Installation ${activeStatus.installationId}`;

  // Count total pending across all installations
  const totalPending = statuses.reduce(
    (sum, s) => sum + (s.activeJobProgress?.pendingCount ?? 0),
    0
  );

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
            {isBlocked ? "Rate Limit Cooldown" : `Syncing ${displayName}`}
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
          style={{ width: `${progress}%` }}
        >
          {isBlocked && (
            <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:12px_12px] animate-[progress-stripes_1s_linear_infinite]" />
          )}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex items-center justify-between text-xs text-foreground-muted font-mono">
        <div className="flex gap-4">
          <span>{activeStatus.activeJobProgress?.current ?? 0} events</span>
          <span className="text-muted">Duration: {elapsedText}</span>
        </div>

        <div className="flex items-center gap-4">
          {isBlocked && activeStatus.blockedUntil && (
            <span className="text-amber-600 font-semibold">
              Resuming in {countdownText}
            </span>
          )}
          {totalPending > 0 && (
            <div className="text-muted">+ {totalPending} queued</div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationWarningCard({ status }: { status: IntegrationStatus }) {
  const installUrl = getGithubInstallUrl();
  const isInstallMissing = status.kind === "missing_installation";
  const actionHref = isInstallMissing
    ? installUrl
    : "/dashboard/settings/repositories";
  const actionLabel = isInstallMissing ? "Connect GitHub" : "Settings";

  const description =
    status.kind === "stale_events"
      ? `No events since ${formatTimestamp(status.lastEventTs)}.`
      : status.kind === "missing_installation"
        ? "Install the GitHub App to enable ingestion."
        : "No activity ingested yet.";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900 flex items-center justify-between">
      <div className="flex gap-3 items-center">
        <span className="text-amber-500 text-lg">⚠</span>
        <span>{description}</span>
      </div>
      <Link
        href={actionHref}
        className="whitespace-nowrap text-xs font-medium border border-amber-300 bg-white px-3 py-1.5 rounded hover:bg-amber-50 transition-colors"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
