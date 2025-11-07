"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

/**
 * IngestionBanner - Shows progress of active ingestion jobs
 *
 * Uses reactive Convex queries to display real-time progress updates.
 * Non-blocking - user can navigate away while jobs run.
 *
 * Graceful handling:
 * - undefined: Query still loading (auth initializing) - don't render
 * - []: No active jobs (or not authenticated yet) - don't render
 * - [...]: Active jobs found - render progress cards
 */
export function IngestionBanner() {
  const activeJobs = useQuery(api.ingestionJobs.listActive);

  // undefined = still loading (auth initializing, query pending)
  // Don't render anything - avoid flash of empty state
  if (activeJobs === undefined) {
    return null;
  }

  // [] = no active jobs (or not authenticated yet)
  // This is a valid state - just don't show banner
  if (activeJobs.length === 0) {
    return null;
  }

  // We have active jobs - render them!
  return (
    <div className="space-y-2">
      {activeJobs.map((job) => (
        <JobProgressCard key={job._id} job={job} />
      ))}
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
