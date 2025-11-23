"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { handleConvexError, showSuccess } from "@/lib/errors";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { CoverageMeter } from "@/components/CoverageMeter";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { getGithubInstallUrl, formatTimestamp } from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";
import { track } from "@vercel/analytics";

export default function ReportsPage() {
  const {
    clerkUser,
    convexUser,
    isLoading: isAuthLoading,
  } = useAuthenticatedConvexUser();
  const [loadMoreCount, setLoadMoreCount] = useState(1);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { status: integrationStatus } = useIntegrationStatus();

  const userId = clerkUser?.id;
  const githubUsername = convexUser?.githubUsername;

  const itemsPerPage = 20;
  const currentLimit = itemsPerPage * loadMoreCount;

  // Try to fetch reports by Clerk ID first
  const reportsByClerkId = useQuery(
    api.reports.listByUser,
    userId ? { userId, limit: currentLimit } : "skip",
  );

  // Fallback: fetch reports by GitHub login (for test data or GitHub-only users)
  const reportsByGhLogin = useQuery(
    api.reports.listByGhLogin,
    githubUsername ? { ghLogin: githubUsername, limit: currentLimit } : "skip",
  );

  // Only wait for queries that are actually running (not skipped)
  const isLoadingClerkReports = userId && reportsByClerkId === undefined;
  const isLoadingGithubReports =
    githubUsername && reportsByGhLogin === undefined;

  const isLoading =
    isAuthLoading || isLoadingClerkReports || isLoadingGithubReports;

  // Determine which reports to show:
  // 1. If Clerk ID query has results, use those (primary path)
  // 2. Otherwise, use GitHub login query (fallback for test data)
  // 3. If any relevant query is loading, show skeleton
  // 4. If all queries loaded but empty, show empty state
  const reports = useMemo(
    () =>
      isLoading
        ? undefined
        : reportsByClerkId && reportsByClerkId.length > 0
          ? reportsByClerkId
          : reportsByGhLogin || [],
    [isLoading, reportsByClerkId, reportsByGhLogin],
  );

  // Infinite scroll with intersection observer
  useEffect(() => {
    if (!loadMoreRef.current || !reports) return;

    const reportsLength = reports.length;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && reportsLength >= currentLimit) {
          setLoadMoreCount((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [reports, currentLimit]);

  const deleteReport = useMutation(api.reports.deleteReport);
  const [deletingId, setDeletingId] = useState<Id<"reports"> | null>(null);

  const handleDelete = async (reportId: Id<"reports">) => {
    if (!confirm("Are you sure you want to delete this report?")) return;

    // Find report for tracking before deletion
    const report = reports?.find((r) => r._id === reportId);

    setDeletingId(reportId);
    try {
      await deleteReport({ id: reportId });

      // Track report deletion event
      if (report) {
        track("report_deleted", {
          reportId,
          kind: report.scheduleType || "daily",
        });
      }

      showSuccess("Report deleted successfully");
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to delete report");
      handleConvexError(err, {
        operation: "delete report",
        retry: () => handleDelete(reportId),
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Show loading state while auth or reports are loading
  // Note: The SkeletonTable component below will handle the reports loading state
  // This early return is for cases where we're completely unauthenticated
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <IntegrationStatusBanner />
      {/* Loading State */}
      {reports === undefined ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-surface p-6"
            >
              <div className="mb-3 h-6 w-3/4 rounded bg-surface-muted" />
              <div className="mb-2 h-4 w-1/2 rounded bg-surface-muted" />
              <div className="h-4 w-1/4 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <ReportsEmptyState status={integrationStatus} />
      ) : (
        // Reports Feed
        <>
          <div className="flex flex-col border-t border-border">
            {reports.map((report) => {
              // Clean Editorial Badges
              const isDaily = report.scheduleType === "daily";
              const isWeekly = report.scheduleType === "weekly";

              return (
                <Link
                  key={report._id}
                  href={`/dashboard/reports/${report._id}`}
                  prefetch={true}
                  className="group flex flex-col gap-4 border-b border-border py-6 transition-colors hover:bg-surface-muted/30 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1 space-y-3">
                    {/* Metadata Line */}
                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted uppercase tracking-wider">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isDaily ? "bg-foreground" : "bg-muted"}`}
                      />
                      <span>{report.scheduleType}</span>
                      <span>•</span>
                      <span>
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-black dark:group-hover:text-white transition-colors">
                      {report.title}
                    </h2>

                    {/* Description */}
                    {report.description && (
                      <p className="text-sm text-foreground-muted line-clamp-2 leading-relaxed max-w-2xl">
                        {report.description}
                      </p>
                    )}
                  </div>

                  {/* Metrics / Actions */}
                  <div className="flex items-center gap-6 sm:flex-col sm:items-end sm:gap-2">
                    <div className="text-right">
                      <div className="text-2xl font-semibold tracking-tight">
                        {report.coverageScore ?? 0}%
                      </div>
                      <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
                        Coverage
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(report._id);
                      }}
                      disabled={deletingId === report._id}
                      className="mt-2 text-xs font-medium text-muted hover:text-rose-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === report._id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Infinite scroll trigger */}
          {reports.length >= currentLimit && (
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportsEmptyState({
  status,
}: {
  status: IntegrationStatus | undefined;
}) {
  const installUrl = getGithubInstallUrl();
  const isActionable =
    status &&
    !["healthy", "missing_user", "unauthenticated"].includes(status.kind);

  const title = isActionable ? "Connect GitHub" : "No reports yet";

  let guidance: ReactNode = (
    <p className="text-foreground-muted">
      Reports are generated automatically at 9am your local time.
    </p>
  );

  if (status) {
    if (status.kind === "missing_installation") {
      guidance = (
        <p className="text-amber-700 dark:text-amber-200">
          Install the GitHub App to begin ingesting activity.{" "}
          <a
            href={installUrl}
            className="font-medium underline hover:text-amber-900"
          >
            Open GitHub
          </a>
          .
        </p>
      );
    } else if (status.kind === "no_events") {
      guidance = (
        <p className="text-amber-700 dark:text-amber-200">
          We haven’t ingested any GitHub activity yet. Add repositories in{" "}
          <Link
            href="/dashboard/settings/repositories"
            className="font-medium underline hover:text-amber-900"
          >
            Settings
          </Link>{" "}
          to kick off your first backfill.
        </p>
      );
    } else if (status.kind === "stale_events") {
      guidance = (
        <p className="text-amber-700 dark:text-amber-200">
          No new events have arrived since {formatTimestamp(status.lastEventTs)}
          . Review your GitHub connection in{" "}
          <Link
            href="/dashboard/settings/repositories"
            className="font-medium underline hover:text-amber-900"
          >
            Settings
          </Link>{" "}
          to resume ingestion.
        </p>
      );
    }
  }

  return (
    <div
      className={`rounded-xl border p-12 text-center transition-colors ${
        isActionable
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10"
          : "border-border bg-surface border-dashed"
      }`}
    >
      <h3 className="text-xl font-semibold tracking-tight text-foreground mb-4">
        {title}
      </h3>
      <div className="max-w-md mx-auto text-sm leading-relaxed">{guidance}</div>
    </div>
  );
}
