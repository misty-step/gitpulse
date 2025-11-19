"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { CoverageMeter } from "@/components/CoverageMeter";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { CitationDrawer } from "@/components/CitationDrawer";
import { handleConvexError, showSuccess } from "@/lib/errors";
import { needsIntegrationAttention, formatTimestamp } from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as Id<"reports">;
  const { clerkUser } = useAuthenticatedConvexUser();
  const createRegeneration = useMutation(api.reportRegenerations.createRequest);
  const [isRequestingRegeneration, setIsRequestingRegeneration] = useState(false);

  const report = useQuery(api.reports.getById, { id: reportId });
  const { status: integrationStatus } = useIntegrationStatus();

  // Fetch reports list to find adjacent reports
  const allReports = useQuery(
    api.reports.listByUser,
    clerkUser?.id ? { userId: clerkUser.id, limit: 100 } : "skip"
  );

  const latestJob = useQuery(
    api.reportRegenerations.latestByReport,
    report ? { reportId: report._id } : "skip"
  );

  const reportVersions = useQuery(
    api.reports.listByWindow,
    report && report.scheduleType
      ? {
          userId: report.userId,
          startDate: report.startDate,
          endDate: report.endDate,
          scheduleType: report.scheduleType,
          limit: 10,
        }
      : "skip"
  );

  // Find previous and next report IDs
  const { prevReportId, nextReportId } = useMemo(() => {
    if (!allReports) return { prevReportId: null, nextReportId: null };
    const idx = allReports.findIndex((r) => r._id === reportId);
    if (idx === -1) return { prevReportId: null, nextReportId: null };

    // Newer report is at lower index (desc order), older at higher index
    return {
      nextReportId: idx > 0 ? allReports[idx - 1]._id : null,
      prevReportId: idx < allReports.length - 1 ? allReports[idx + 1]._id : null,
    };
  }, [allReports, reportId]);

  const jobInFlight = Boolean(
    latestJob && ["queued", "collecting", "generating", "validating", "saving"].includes(latestJob.status)
  );
  const jobFailed = latestJob?.status === "failed";
  const jobProgress = Math.round((latestJob?.progress ?? 0) * 100);
  const versionList = reportVersions ?? undefined;
  const latestVersionId = versionList && versionList.length > 0 ? versionList[0]!._id : null;
  const isLatestVersion =
    report && versionList && versionList.length > 0 ? versionList[0]!._id === report._id : true;
  const hasNewerVersion = Boolean(latestVersionId && report && latestVersionId !== report._id);
  const regenerateLabel = jobInFlight
    ? "Regenerating..."
    : jobFailed
    ? "Retry regeneration"
    : "Regenerate report";
  const disableRegenerate = !report || jobInFlight || isRequestingRegeneration;

  const handleRegenerate = async () => {
    if (!report) return;
    setIsRequestingRegeneration(true);
    try {
      await createRegeneration({ reportId: report._id });
      showSuccess("Regeneration started", "We\'ll refresh this page when it\'s ready.");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to start regeneration");
      handleConvexError(err, {
        operation: "regenerate report",
        retry: () => handleRegenerate(),
      });
    } finally {
      setIsRequestingRegeneration(false);
    }
  };

  const handleViewLatest = () => {
    if (latestVersionId && latestVersionId !== reportId) {
      router.replace(`/dashboard/reports/${latestVersionId}`);
    }
  };

  // Keyboard shortcuts: Escape, ←, →
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          router.push("/dashboard/reports");
          break;
        case "ArrowLeft":
          if (prevReportId) router.push(`/dashboard/reports/${prevReportId}`);
          break;
        case "ArrowRight":
          if (nextReportId) router.push(`/dashboard/reports/${nextReportId}`);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, prevReportId, nextReportId]);

  useEffect(() => {
    if (!latestJob || latestJob.status !== "completed" || !latestJob.newReportId) {
      return;
    }

    if (latestJob.newReportId !== reportId) {
      router.replace(`/dashboard/reports/${latestJob.newReportId}`);
    }
  }, [latestJob, reportId, router]);

  if (report === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-slate-300">Loading report...</p>
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-gray-500 dark:text-slate-300">Report not found</p>
        <Link
          href="/dashboard/reports"
          className="font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Reports
        </Link>
      </div>
    );
  }

  const handleDownloadMarkdown = () => {
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showIntegrationAlert =
    report.coverageScore === 0 && needsIntegrationAttention(integrationStatus);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <IntegrationStatusBanner />
      {/* Header */}
      <div className="space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-100"
          >
            ← Back to Reports
          </Link>

          {/* Report Navigation */}
          <div className="flex items-center gap-2">
            {prevReportId ? (
              <Link
                href={`/dashboard/reports/${prevReportId}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-200 dark:hover:bg-neutral-800"
                title="Older report (←)"
              >
                ← Older
              </Link>
            ) : (
              <div className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 dark:border-neutral-800 dark:text-slate-500">
                ← Older
              </div>
            )}
            {nextReportId ? (
              <Link
                href={`/dashboard/reports/${nextReportId}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-200 dark:hover:bg-neutral-800"
                title="Newer report (→)"
              >
                Newer →
              </Link>
            ) : (
              <div className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 dark:border-neutral-800 dark:text-slate-500">
                Newer →
              </div>
            )}
          </div>
        </div>

        {/* Title and Metadata */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
              {report.title}
            </h1>
            {report.description && (
              <p className="mt-2 text-gray-600 dark:text-slate-300">{report.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
              <span>
                Generated: {new Date(report.generatedAt).toLocaleDateString()}
              </span>
              <span>•</span>
              <span>{report.citations.length} citations</span>
              <span>•</span>
              <span>
                {report.ghLogins.length}{" "}
                {report.ghLogins.length === 1 ? "user" : "users"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              onClick={handleDownloadMarkdown}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-200 dark:hover:bg-neutral-800"
            >
              Download Markdown
            </button>
            <button
              onClick={handleRegenerate}
              disabled={disableRegenerate}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                disableRegenerate
                  ? "bg-blue-400/50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {regenerateLabel}
            </button>
          </div>
        </div>
      </div>

      {showIntegrationAlert && integrationStatus ? (
        <IntegrationContextNote status={integrationStatus} />
      ) : null}

      {jobInFlight && latestJob && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
          <div className="flex items-center justify-between font-medium">
            <span>Regenerating report</span>
            <span>{jobProgress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-blue-100 dark:bg-blue-500/30">
            <div
              className="h-2 rounded-full bg-blue-600 transition-[width] dark:bg-blue-400"
              style={{ width: `${jobProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-900/80 dark:text-blue-100/80">
            {latestJob.message ?? "Working through the latest activity..."}
          </p>
        </div>
      )}

      {jobFailed && latestJob && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-center justify-between font-medium">
            <span>Regeneration failed</span>
            <button
              onClick={handleRegenerate}
              className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 dark:border-red-400 dark:text-red-100 dark:hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
          <p className="mt-2 text-xs">
            {latestJob.error?.message ?? latestJob.message ?? "Something went wrong."}
          </p>
        </div>
      )}

      {hasNewerVersion && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>A newer version of this report is available.</span>
            <button
              onClick={handleViewLatest}
              className="inline-flex items-center justify-center rounded border border-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-300/50 dark:text-amber-100 dark:hover:bg-amber-400/20"
            >
              View latest
            </button>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
          <span className="font-medium">Users:</span>
          <div className="flex flex-wrap gap-1">
            {report.ghLogins.map((login) => (
              <span
                key={login}
                className="rounded border border-gray-200 bg-white px-2 py-0.5 text-gray-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-200"
              >
                {login}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
          <span className="font-medium">Date Range:</span>
          <span className="text-gray-600 dark:text-slate-300">
            {new Date(report.startDate).toLocaleDateString()} -{" "}
            {new Date(report.endDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
          <span className="font-medium">Model:</span>
          <span className="text-gray-600 dark:text-slate-300">
            {report.provider}/{report.model}
          </span>
        </div>
      </div>

      {/* Coverage */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Coverage
        </h2>
        <CoverageMeter score={report.coverageScore} />
        {report.coverageBreakdown && report.coverageBreakdown.length > 0 && (
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            {report.coverageBreakdown.map((entry) => (
              <div key={entry.scopeKey} className="flex justify-between">
                <span className="truncate pr-2">{entry.scopeKey}</span>
                <span className="tabular-nums text-gray-500">
                  {entry.used}/{entry.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {report.scheduleType && versionList && versionList.length > 0 && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Report Versions</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {versionList.length} version{versionList.length === 1 ? "" : "s"} available for this time range
              </p>
            </div>
            {!isLatestVersion && (
              <button
                onClick={handleViewLatest}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-200 dark:hover:bg-neutral-800"
              >
                Jump to latest
              </button>
            )}
          </div>
          <div className="space-y-2">
            {versionList.map((version) => {
              const isCurrent = version._id === report._id;
              return (
                <button
                  key={version._id}
                  onClick={() => {
                    if (!isCurrent) router.push(`/dashboard/reports/${version._id}`);
                  }}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    isCurrent
                      ? "border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                      : "border-gray-200 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-medium text-gray-900 dark:text-slate-100">
                    <span>{new Date(version.generatedAt).toLocaleString()}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      {isCurrent ? "Current" : "View"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Coverage {(version.coverageScore ?? 0).toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Content (HTML) */}
      <div className="prose prose-slate max-w-none rounded-lg border border-gray-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900 dark:prose-invert">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: report.html }}
        />
      </div>

      <CitationDrawer citations={report.citations} />
    </div>
  );
}

function IntegrationContextNote({ status }: { status: IntegrationStatus }) {
  let message = "GitHub integration needs attention.";

  if (status.kind === "missing_installation") {
    message = "Install the GitHub App to collect GitHub activity for this report window.";
  } else if (status.kind === "no_events") {
    message = "No GitHub events are available for this timeframe yet.";
  } else if (status.kind === "stale_events") {
    message = `We haven’t ingested any GitHub events since ${formatTimestamp(status.lastEventTs)}.`;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
      <p className="font-semibold">This report is missing GitHub data</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
