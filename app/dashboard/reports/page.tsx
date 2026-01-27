"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { handleConvexError, showSuccess } from "@/lib/errors";
import { formatReportDate } from "@/lib/formatters";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { YesterdayWidget } from "@/components/YesterdayWidget";
import { getGithubInstallUrl, formatTimestamp } from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";
import { trackEvent, trackFunnel } from "@/lib/analytics";
import { toast } from "sonner";

export default function ReportsPage() {
  const {
    clerkUser,
    convexUser,
    isLoading: isAuthLoading,
  } = useAuthenticatedConvexUser();
  const [loadMoreCount, setLoadMoreCount] = useState(1);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { status: integrationStatus } = useIntegrationStatus();

  // Sync state
  const syncStatuses = useQuery(api.sync.getStatus.getStatusForUser);
  const requestSync = useAction(api.actions.sync.requestSync.requestManualSync);
  const backfillReports = useAction(
    api.actions.reports.backfill.backfillLastWeek,
  );
  const regenerateReports = useAction(
    api.actions.reports.regenerateLastWeek.regenerateLastWeek,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

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
        trackEvent("report_deleted", {
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

  const handleSyncClick = async () => {
    if (!syncStatuses?.length) {
      toast.error("No installations found");
      return;
    }
    try {
      setIsSyncing(true);
      // Sync ALL installations, not just the first one
      let startedCount = 0;
      for (const installation of syncStatuses) {
        const result = await requestSync({
          installationId: installation.installationId,
        });
        if (result.started) {
          startedCount++;
        }
      }
      if (startedCount > 0) {
        toast.success(
          `Sync started for ${startedCount} installation${startedCount > 1 ? "s" : ""}`,
        );
      } else {
        toast.info("All installations are up to date");
      }
    } catch (error) {
      toast.error("Failed to start sync");
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBackfillClick = async () => {
    try {
      setIsBackfilling(true);
      toast.info("Starting backfill...");
      const result = await backfillReports({});
      if (result.success) {
        const { reportsGenerated, daysSkipped, daysWithoutEvents } = result;
        if (reportsGenerated > 0) {
          trackFunnel("report_generated", {
            reportKind: "daily",
            count: reportsGenerated,
          });
          toast.success(
            `Generated ${reportsGenerated} report${reportsGenerated > 1 ? "s" : ""}`,
          );
        } else if (daysSkipped === 7) {
          toast.info("All days already have reports");
        } else if (daysWithoutEvents === 7 - daysSkipped) {
          toast.info("No activity found in the past 7 days");
        } else {
          toast.info("Backfill complete - no new reports generated");
        }
      } else {
        toast.error(result.error || "Backfill failed");
      }
    } catch (error) {
      toast.error("Failed to backfill reports");
      console.error(error);
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleRegenerateClick = async () => {
    try {
      setIsRegenerating(true);
      toast.info("Deleting and regenerating reports...");

      const result = await regenerateReports({});

      if (result.success) {
        const { reportsGenerated, reportsDeleted } = result;
        if (reportsGenerated > 0) {
          trackFunnel("report_generated", {
            reportKind: "daily",
            count: reportsGenerated,
          });
        }
        toast.success(
          `Regenerated ${reportsGenerated} report${reportsGenerated !== 1 ? "s" : ""} (deleted ${reportsDeleted})`,
        );
      } else {
        toast.error(result.error || "Regeneration failed");
      }
    } catch (error) {
      toast.error("Failed to regenerate reports");
      console.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Show loading state while auth or reports are loading
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  // Compute sync state for button
  const hasInstallation = syncStatuses && syncStatuses.length > 0;
  const isActivelySyncing = syncStatuses?.some(
    (s) =>
      s.state === "syncing" ||
      s.state === "blocked" ||
      s.state === "recovering",
  );
  const lastSyncedAt = syncStatuses?.[0]?.lastSyncedAt;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <IntegrationStatusBanner />
      <YesterdayWidget reports={reports} isLoading={reports === undefined} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex items-center gap-4">
          {lastSyncedAt && (
            <span className="text-xs text-muted">
              Last sync: {formatTimestamp(lastSyncedAt)}
            </span>
          )}
          {hasInstallation && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing || isActivelySyncing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing || isActivelySyncing ? "Syncing..." : "Sync Now"}
            </button>
          )}
          {hasInstallation && (
            <button
              onClick={handleBackfillClick}
              disabled={isBackfilling || isSyncing || isActivelySyncing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isBackfilling ? "Backfilling..." : "Backfill 7 Days"}
            </button>
          )}
          {hasInstallation && process.env.NODE_ENV !== "production" && (
            <button
              onClick={handleRegenerateClick}
              disabled={
                isRegenerating ||
                isSyncing ||
                isActivelySyncing ||
                isBackfilling
              }
              className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate 7 Days"}
            </button>
          )}
        </div>
      </div>

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
        // Report Cards
        <>
          <div className="space-y-4">
            {reports.map((report) => {
              const isWeekly = report.scheduleType === "weekly";
              const citationCount = report.citations?.length ?? 0;
              const diagnostic = getReportDiagnostic(report);

              return (
                <div
                  key={report._id}
                  className="group rounded-xl border border-border bg-surface p-6 hover:bg-surface-muted/30 transition-colors"
                >
                  <Link
                    href={`/dashboard/reports/${report._id}`}
                    prefetch={true}
                    className="block"
                  >
                    {/* Badge + Date */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
                          isWeekly
                            ? "bg-foreground/10 text-foreground"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {isWeekly ? "Weekly" : "Daily"}
                      </span>
                      <span className="text-xs text-muted">
                        {formatReportDate(report.startDate, report.endDate)}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2">
                      {report.title}
                    </h2>

                    {/* Description */}
                    {report.description && (
                      <p className="text-sm text-foreground-muted line-clamp-2 leading-relaxed mb-4">
                        {report.description}
                      </p>
                    )}

                    {/* Footer: Citations + Diagnostic */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-semibold tracking-tight">
                          {citationCount}
                        </span>
                        <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
                          Citations
                        </span>
                      </div>

                      {diagnostic && (
                        <span
                          className={`text-xs font-medium ${diagnostic.className}`}
                        >
                          {diagnostic.label}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(report._id);
                    }}
                    disabled={deletingId === report._id}
                    className="mt-4 text-xs font-medium text-muted hover:text-rose-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === report._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
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

type ReportDiagnostic = {
  label: string;
  className: string;
};

function getReportDiagnostic(report: {
  eventCount?: number;
  citationCount?: number;
  expectedCitations?: number;
  citations?: string[] | null;
  [key: string]: unknown;
}): ReportDiagnostic | null {
  const eventCount = report.eventCount ?? 0;
  const citationCount = report.citationCount ?? report.citations?.length ?? 0;
  const expectedCitations = report.expectedCitations ?? 0;

  // No events = legitimate quiet period
  if (eventCount === 0) {
    return { label: "No activity", className: "text-muted/70" };
  }

  // Events exist but no citations extracted
  if (eventCount > 0 && citationCount === 0 && expectedCitations > 0) {
    return {
      label: "Review needed",
      className: "text-amber-600 dark:text-amber-400",
    };
  }

  // Events exist but none have URLs
  if (eventCount > 0 && expectedCitations === 0) {
    return {
      label: "Data issue",
      className: "text-rose-600 dark:text-rose-400",
    };
  }

  return null;
}

// ============================================================================
// Empty State
// ============================================================================

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
      Reports are generated automatically at midnight your local time.
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
          We haven&apos;t ingested any GitHub activity yet. Add repositories in{" "}
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
