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
import {
  needsIntegrationAttention,
  formatTimestamp,
} from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";
import DOMPurify from "isomorphic-dompurify";

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as Id<"reports">;
  const { clerkUser } = useAuthenticatedConvexUser();
  const createRegeneration = useMutation(api.reportRegenerations.createRequest);
  const [isRequestingRegeneration, setIsRequestingRegeneration] =
    useState(false);

  const report = useQuery(api.reports.getById, { id: reportId });
  const { status: integrationStatus } = useIntegrationStatus();

  // Fetch reports list to find adjacent reports
  const allReports = useQuery(
    api.reports.listByUser,
    clerkUser?.id ? { userId: clerkUser.id, limit: 100 } : "skip",
  );

  const latestJob = useQuery(
    api.reportRegenerations.latestByReport,
    report ? { reportId: report._id } : "skip",
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
      : "skip",
  );

  // Find previous and next report IDs
  const { prevReportId, nextReportId } = useMemo(() => {
    if (!allReports) return { prevReportId: null, nextReportId: null };
    const idx = allReports.findIndex((r) => r._id === reportId);
    if (idx === -1) return { prevReportId: null, nextReportId: null };

    // Newer report is at lower index (desc order), older at higher index
    return {
      nextReportId: idx > 0 ? allReports[idx - 1]._id : null,
      prevReportId:
        idx < allReports.length - 1 ? allReports[idx + 1]._id : null,
    };
  }, [allReports, reportId]);

  const jobInFlight = Boolean(
    latestJob &&
      ["queued", "collecting", "generating", "validating", "saving"].includes(
        latestJob.status,
      ),
  );
  const jobFailed = latestJob?.status === "failed";
  const jobProgress = Math.round((latestJob?.progress ?? 0) * 100);
  const versionList = reportVersions ?? undefined;
  const latestVersionId =
    versionList && versionList.length > 0 ? versionList[0]!._id : null;
  const isLatestVersion =
    report && versionList && versionList.length > 0
      ? versionList[0]!._id === report._id
      : true;
  const hasNewerVersion = Boolean(
    latestVersionId && report && latestVersionId !== report._id,
  );
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
      showSuccess(
        "Regeneration started",
        "We\'ll refresh this page when it\'s ready.",
      );
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error("Failed to start regeneration");
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
    if (
      !latestJob ||
      latestJob.status !== "completed" ||
      !latestJob.newReportId
    ) {
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
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <IntegrationStatusBanner />

      {/* Header Section */}
      <header className="space-y-6 border-b border-border pb-8">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/reports"
            className="text-xs font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors"
          >
            ← Index
          </Link>

          <div className="flex items-center gap-4">
            {/* Versions Dropdown / List could go here, keeping it simple for now */}
            <span className="text-xs font-mono text-muted">
              ID: {report._id.slice(-8)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {report.title}
          </h1>

          {/* Spec Sheet Metadata */}
          <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 border-t border-border pt-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                Generated
              </div>
              <div className="text-sm font-mono">
                {new Date(report.generatedAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                Range
              </div>
              <div className="text-sm font-mono">
                {new Date(report.startDate).toLocaleDateString()} —{" "}
                {new Date(report.endDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                Model
              </div>
              <div className="text-sm font-mono">
                {report.provider}/{report.model}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                Coverage
              </div>
              <div className="text-sm font-mono">
                {report.coverageScore ?? 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-surface-muted"
          >
            Download MD
          </button>
          <button
            onClick={handleRegenerate}
            disabled={disableRegenerate}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {regenerateLabel}
          </button>
        </div>
      </header>

      {showIntegrationAlert && integrationStatus ? (
        <IntegrationContextNote status={integrationStatus} />
      ) : null}

      {jobInFlight && latestJob && (
        <div className="flex items-center gap-4 border-l-2 border-black pl-4 py-2 bg-surface-muted/30">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <div>
            <div className="text-sm font-medium">
              Regenerating... {jobProgress}%
            </div>
            <div className="text-xs text-muted">{latestJob.message}</div>
          </div>
        </div>
      )}

      {/* Report Content */}
      <article className="prose prose-zinc max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground-muted prose-a:text-foreground prose-code:text-xs prose-code:font-mono prose-code:bg-surface-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.html) }}
        />
      </article>

      {/* Footer / Versions */}
      {report.scheduleType && versionList && versionList.length > 0 && (
        <div className="border-t border-border pt-12 mt-12">
          <h3 className="text-sm font-semibold mb-6">History</h3>
          <div className="space-y-0">
            {versionList.map((version) => {
              const isCurrent = version._id === report._id;
              return (
                <Link
                  key={version._id}
                  href={`/dashboard/reports/${version._id}`}
                  className={`flex items-center justify-between py-3 border-b border-border text-sm hover:bg-surface-muted/50 transition-colors ${isCurrent ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                >
                  <div className="font-mono">
                    {new Date(version.generatedAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-muted">
                      Score: {version.coverageScore}%
                    </span>
                    {isCurrent && (
                      <span className="h-1.5 w-1.5 rounded-full bg-black" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <CitationDrawer citations={report.citations} />
    </div>
  );
}

function IntegrationContextNote({ status }: { status: IntegrationStatus }) {
  let message = "GitHub integration needs attention.";

  if (status.kind === "missing_installation") {
    message =
      "Install the GitHub App to collect GitHub activity for this report window.";
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
