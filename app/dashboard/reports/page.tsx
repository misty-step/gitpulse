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

export default function ReportsPage() {
  const { clerkUser, convexUser, isLoading: isAuthLoading } = useAuthenticatedConvexUser();
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
    userId ? { userId, limit: currentLimit } : "skip"
  );

  // Fallback: fetch reports by GitHub login (for test data or GitHub-only users)
  const reportsByGhLogin = useQuery(
    api.reports.listByGhLogin,
    githubUsername ? { ghLogin: githubUsername, limit: currentLimit } : "skip"
  );

  // Only wait for queries that are actually running (not skipped)
  const isLoadingClerkReports = userId && reportsByClerkId === undefined;
  const isLoadingGithubReports = githubUsername && reportsByGhLogin === undefined;

  const isLoading = isAuthLoading || isLoadingClerkReports || isLoadingGithubReports;

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
    [isLoading, reportsByClerkId, reportsByGhLogin]
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
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [reports, currentLimit]);

  const deleteReport = useMutation(api.reports.deleteReport);
  const [deletingId, setDeletingId] = useState<Id<"reports"> | null>(null);

  const handleDelete = async (reportId: Id<"reports">) => {
    if (!confirm("Are you sure you want to delete this report?")) return;

    setDeletingId(reportId);
    try {
      await deleteReport({ id: reportId });
      showSuccess("Report deleted successfully");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to delete report");
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
              className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-3 h-6 w-3/4 rounded bg-gray-200 dark:bg-neutral-700" />
              <div className="mb-2 h-4 w-1/2 rounded bg-gray-200 dark:bg-neutral-700" />
              <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <ReportsEmptyState status={integrationStatus} />
      ) : (
        // Reports Feed
        <>
          <div className="space-y-4">
            {reports.map((report) => {
              const badgeConfig = {
                daily: {
                  label: "Daily Standup",
                  colors:
                    "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100",
                },
                weekly: {
                  label: "Weekly Retro",
                  colors:
                    "bg-purple-100 text-purple-800 dark:bg-violet-500/20 dark:text-violet-100",
                },
                manual: {
                  label: "Manual",
                  colors:
                    "bg-gray-100 text-gray-700 dark:bg-neutral-700/40 dark:text-slate-200",
                },
              };
              const badge = badgeConfig[report.scheduleType as keyof typeof badgeConfig] || badgeConfig.manual;

              return (
                <Link
                  key={report._id}
                  href={`/dashboard/reports/${report._id}`}
                  prefetch={true}
                  className="block min-h-[60px] cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
                >
                  {/* Header with type badge */}
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="flex-1 pr-4 text-base font-semibold text-gray-900 dark:text-slate-100">
                      {report.title}
                    </h2>
                    <span className={`px-2 py-1 text-xs font-medium rounded shrink-0 ${badge.colors}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Description */}
                  {report.description && (
                    <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">{report.description}</p>
                  )}

                  {/* Metadata - stacked on mobile, horizontal on desktop */}
                  <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                    <span>
                      {new Date(report.startDate).toLocaleDateString()} -{" "}
                      {new Date(report.endDate).toLocaleDateString()}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{report.citations.length} citations</span>
                  </div>

                  {/* Coverage */}
                  <div className="mt-3">
                    <CoverageMeter score={report.coverageScore} />
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(report._id);
                    }}
                    disabled={deletingId === report._id}
                    className="mt-4 min-h-[44px] text-sm font-medium text-red-600 transition-colors hover:text-red-500 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300 sm:min-h-0"
                  >
                    {deletingId === report._id ? "Deleting..." : "Delete"}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Infinite scroll trigger */}
          {reports.length >= currentLimit && (
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportsEmptyState({ status }: { status: IntegrationStatus | undefined }) {
  const installUrl = getGithubInstallUrl();
  const isActionable =
    status && !["healthy", "missing_user", "unauthenticated"].includes(status.kind);

  const title = isActionable
    ? "Connect GitHub to start generating reports"
    : "No reports yet";

  let guidance: ReactNode = (
    <p className="text-sm text-gray-400 dark:text-slate-400">
      Reports are generated automatically at 9am your local time.
    </p>
  );

  if (status) {
    if (status.kind === "missing_installation") {
      guidance = (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          Install the GitHub App to begin ingesting activity.{" "}
          <a href={installUrl} className="font-medium underline">
            Open GitHub
          </a>
          .
        </p>
      );
    } else if (status.kind === "no_events") {
      guidance = (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          We haven’t ingested any GitHub activity yet. Add repositories in{" "}
          <Link href="/dashboard/settings/repositories" className="font-medium underline">
            Settings
          </Link>{" "}
          to kick off your first backfill.
        </p>
      );
    } else if (status.kind === "stale_events") {
      guidance = (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          No new events have arrived since {formatTimestamp(status.lastEventTs)}. Review your GitHub
          connection in{" "}
          <Link href="/dashboard/settings/repositories" className="font-medium underline">
            Settings
          </Link>{" "}
          to resume ingestion.
        </p>
      );
    }
  }

  return (
    <div
      className={`rounded-lg border p-12 text-center ${
        isActionable
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
          : "border-gray-200 bg-white text-gray-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-300"
      }`}
    >
      <p className="mb-3 text-base font-semibold">{title}</p>
      {guidance}
    </div>
  );
}
