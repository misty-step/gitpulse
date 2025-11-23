"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import {
  formatTimestamp,
  getGithubInstallUrl,
  needsIntegrationAttention,
} from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";

/**
 * IntegrationStatusBanner - centralizes integration health + ingestion progress.
 * Renders at most one warning CTA per page plus any active ingestion jobs.
 *
 * "Luminous Precision" Redesign:
 * - Single Card Summary
 * - "Active" vs "Queued" distinction
 */
export function IntegrationStatusBanner() {
  const activeJobs = useQuery(api.ingestionJobs.listActive);
  const { status: integrationStatus, isLoading: isIntegrationLoading } =
    useIntegrationStatus();

  // Debugging active jobs state
  if (activeJobs) {
    console.log("[IntegrationStatusBanner] Active Jobs:", activeJobs);
  }

  if (activeJobs === undefined || isIntegrationLoading) {
    return null;
  }

  const hasJobs = activeJobs.length > 0;
  const showWarning = needsIntegrationAttention(integrationStatus);
  if (!showWarning && !hasJobs) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      {showWarning && integrationStatus ? (
        <IntegrationWarningCard status={integrationStatus} />
      ) : null}
      {hasJobs ? <ActiveIngestionCard jobs={activeJobs} /> : null}
    </div>
  );
}

function ActiveIngestionCard({ jobs }: { jobs: Doc<"ingestionJobs">[] }) {
  // Identify the "Active" job (running or blocked)
  const activeJob =
    jobs.find((j) => j.status === "running" || j.status === "blocked") ||
    jobs[0];
  const pendingCount = jobs.filter((j) => j.status === "pending").length;

  const isBlocked = activeJob.status === "blocked";
  const progress = activeJob.progress || 0;

  // Tickers
  const [elapsedText, setElapsedText] = useState("0s");
  const [countdownText, setCountdownText] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();

      // Elapsed (Duration)
      const start = activeJob.startedAt || activeJob.createdAt;
      const seconds = Math.floor((now - start) / 1000);
      if (seconds < 60) setElapsedText(`${seconds}s`);
      else setElapsedText(`${Math.floor(seconds / 60)}m ${seconds % 60}s`);

      // Countdown (if blocked)
      if (isBlocked && activeJob.blockedUntil) {
        const remaining = Math.max(
          0,
          Math.floor((activeJob.blockedUntil - now) / 1000),
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
  }, [
    activeJob.startedAt,
    activeJob.createdAt,
    activeJob.blockedUntil,
    isBlocked,
  ]);

  const repoName = activeJob.repoFullName;

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
            {isBlocked ? "Rate Limit Cooldown" : `Syncing ${repoName}`}
          </h3>
        </div>

        <div className="text-xs font-mono text-muted">
          {activeJob.status.toUpperCase()}
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
          <span>{activeJob.eventsIngested ?? 0} events</span>
          <span className="text-muted">Duration: {elapsedText}</span>
        </div>

        <div className="flex items-center gap-4">
          {isBlocked && activeJob.blockedUntil && (
            <span className="text-amber-600 font-semibold">
              Resuming in {countdownText}
            </span>
          )}
          {pendingCount > 0 && (
            <div className="text-muted">+ {pendingCount} queued</div>
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
