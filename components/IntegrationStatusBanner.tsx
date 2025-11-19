"use client";

import { useState } from "react";
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
 */
export function IntegrationStatusBanner() {
  const activeJobs = useQuery(api.ingestionJobs.listActive);
  const { status: integrationStatus, isLoading: isIntegrationLoading } = useIntegrationStatus();

  if (activeJobs === undefined || isIntegrationLoading) {
    return null;
  }

  const hasJobs = activeJobs.length > 0;
  const showWarning = needsIntegrationAttention(integrationStatus);
  if (!showWarning && !hasJobs) {
    return null;
  }

  return (
    <div className="space-y-2">
      {showWarning && integrationStatus ? (
        <IntegrationWarningCard status={integrationStatus} />
      ) : null}
      {hasJobs
        ? activeJobs.map((job) => <JobProgressCard key={job._id} job={job} />)
        : null}
    </div>
  );
}

function JobProgressCard({ job }: { job: Doc<"ingestionJobs"> }) {
  const progress = job.progress || 0;
  const isRunning = job.status === "running";
  const isPending = job.status === "pending";

  // Calculate elapsed time
  const startedAt = job.startedAt || job.createdAt;
  const [currentTime] = useState(() => Date.now());
  const elapsedMs = currentTime - startedAt;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
  const elapsedText =
    elapsedMinutes > 0
      ? `${elapsedMinutes}m ${elapsedSeconds}s`
      : `${elapsedSeconds}s`;

  // Estimate time remaining (rough estimate based on progress)
  const remainingMs =
    progress > 0 ? (elapsedMs / progress) * (100 - progress) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingText =
    progress > 5 && remainingMinutes > 0
      ? `~${remainingMinutes}m remaining`
      : "";

  // Parse repo name for display
  const repoName = job.repoFullName.startsWith("batch:")
    ? job.repoFullName.replace("batch:", "")
    : job.repoFullName;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            ) : isPending ? (
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
            ) : null}
            <h3 className="font-medium text-gray-900">
              Ingesting repositories for {repoName}
            </h3>
          </div>

          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">{progress}%</span> complete
            {job.eventsIngested && (
              <span className="ml-3">{job.eventsIngested.toLocaleString()} events</span>
            )}
            {elapsedText && (
              <span className="ml-3">Elapsed: {elapsedText}</span>
            )}
            {remainingText && (
              <span className="ml-3 text-gray-500">{remainingText}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            // TODO: Implement dismiss functionality
            // For now, just let the query handle hiding completed jobs
          }}
          className="ml-4 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function IntegrationWarningCard({ status }: { status: IntegrationStatus }) {
  const installUrl = getGithubInstallUrl();
  const isInstallMissing = status.kind === "missing_installation";
  const actionHref = isInstallMissing ? installUrl : "/dashboard/settings/repositories";
  const actionLabel = isInstallMissing ? "Connect GitHub" : "Review ingestion settings";

  const description =
    status.kind === "stale_events"
      ? `No events since ${formatTimestamp(status.lastEventTs)}.`
      : status.kind === "missing_installation"
      ? "Install the GitHub App so GitPulse can ingest your activity."
      : "We haven’t ingested any GitHub activity yet.";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">GitHub integration needs attention</p>
          <p className="mt-1 text-amber-800">{description}</p>
        </div>
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-md bg-amber-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
