"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
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

  const report = useQuery(api.reports.getById, { id: reportId });
  const { status: integrationStatus } = useIntegrationStatus();

  // Fetch reports list to find adjacent reports
  const allReports = useQuery(
    api.reports.listByUser,
    clerkUser?.id ? { userId: clerkUser.id, limit: 100 } : "skip",
  );

  // Find previous and next report IDs
  const { prevReportId, nextReportId } = useMemo(() => {
    if (!allReports) return { prevReportId: null, nextReportId: null };
    const idx = allReports.findIndex((r) => r._id === reportId);
    if (idx === -1) return { prevReportId: null, nextReportId: null };

    return {
      nextReportId: idx > 0 ? allReports[idx - 1]._id : null,
      prevReportId:
        idx < allReports.length - 1 ? allReports[idx + 1]._id : null,
    };
  }, [allReports, reportId]);

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

  if (report === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Loading report...</p>
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted">Report not found</p>
        <Link
          href="/dashboard/reports"
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          ← Back to Reports
        </Link>
      </div>
    );
  }

  const showIntegrationAlert =
    report.citations?.length === 0 && needsIntegrationAttention(integrationStatus);
  const diagnostic = getDiagnosticStatus(report);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <IntegrationStatusBanner />

      {/* Navigation */}
      <nav className="flex items-center justify-between">
        <Link
          href="/dashboard/reports"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Back to Reports
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {prevReportId && (
            <Link
              href={`/dashboard/reports/${prevReportId}`}
              className="text-muted hover:text-foreground transition-colors"
              title="Older report (←)"
            >
              ← Older
            </Link>
          )}
          {prevReportId && nextReportId && <span className="text-muted">·</span>}
          {nextReportId && (
            <Link
              href={`/dashboard/reports/${nextReportId}`}
              className="text-muted hover:text-foreground transition-colors"
              title="Newer report (→)"
            >
              Newer →
            </Link>
          )}
        </div>
      </nav>

      {/* Report Card */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-6 bg-surface-muted/30">
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
                report.scheduleType === "weekly"
                  ? "bg-foreground/10 text-foreground"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {report.scheduleType === "weekly" ? "Weekly" : "Daily"}
            </span>
            <span className="text-xs text-muted">
              {formatDateRange(report.startDate, report.endDate)}
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {report.title}
          </h1>

          {report.description && (
            <p className="mt-2 text-foreground-muted">
              {report.description}
            </p>
          )}

          {/* Metadata */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted">
            <span>Provider: {report.provider}</span>
            <span>·</span>
            <span>Model: {report.model}</span>
          </div>
        </div>

        {/* Diagnostic Alert */}
        {diagnostic && (
          <DiagnosticAlert status={diagnostic} />
        )}

        {showIntegrationAlert && integrationStatus && !diagnostic ? (
          <IntegrationContextNote status={integrationStatus} />
        ) : null}

        {/* Content */}
        <div className="p-6">
          <div
            className="prose prose-zinc dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-foreground-muted prose-p:leading-relaxed
              prose-a:text-foreground prose-a:underline prose-a:decoration-muted/50
              prose-a:underline-offset-4 hover:prose-a:decoration-foreground
              prose-strong:font-semibold prose-strong:text-foreground
              prose-code:text-sm prose-code:font-mono prose-code:bg-surface-muted
              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-ul:my-4 prose-li:my-1
              prose-blockquote:border-l-2 prose-blockquote:border-muted prose-blockquote:pl-4
              prose-blockquote:italic prose-blockquote:text-foreground-muted"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.html) }}
          />
        </div>

        {/* Citations */}
        {report.citations && report.citations.length > 0 && (
          <div className="border-t border-border p-6 bg-surface-muted/30">
            <h2 className="text-sm font-semibold tracking-tight mb-4">
              Sources ({report.citations.length})
            </h2>
            <ol className="space-y-2">
              {report.citations.map((url, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-muted hover:text-foreground transition-colors break-all"
                  >
                    <span className="text-muted font-mono">[{i + 1}]</span>{" "}
                    {formatCitationUrl(url)}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Keyboard Hint */}
      <div className="text-center text-xs text-muted/50">
        Press <kbd className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-mono">Esc</kbd> to close
        {(prevReportId || nextReportId) && (
          <>
            {" · "}
            <kbd className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-mono">→</kbd> to navigate
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateRange(startDate: number, endDate: number): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return end.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatCitationUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    const match = path.match(/\/([^/]+)\/([^/]+)\/(pull|issues|commit)\/([^/]+)/);
    if (match) {
      const [, owner, repo, type, num] = match;
      const typeLabel = type === "pull" ? "PR" : type === "issues" ? "Issue" : "Commit";
      return `${owner}/${repo} ${typeLabel} #${num.slice(0, 7)}`;
    }

    return parsed.hostname + path;
  } catch {
    return url;
  }
}

// ============================================================================
// Diagnostic Status
// ============================================================================

type DiagnosticStatus =
  | { kind: "no_events"; message: string }
  | { kind: "citation_failure"; message: string }
  | { kind: "ingestion_issue"; message: string };

function getDiagnosticStatus(report: {
  eventCount?: number;
  citationCount?: number;
  expectedCitations?: number;
  citations?: string[];
}): DiagnosticStatus | null {
  const eventCount = report.eventCount ?? 0;
  const citationCount = report.citationCount ?? report.citations?.length ?? 0;
  const expectedCitations = report.expectedCitations ?? 0;

  if (eventCount === 0) {
    return {
      kind: "no_events",
      message: "No GitHub activity was recorded for this time period.",
    };
  }

  if (eventCount > 0 && citationCount === 0 && expectedCitations > 0) {
    return {
      kind: "citation_failure",
      message: `${eventCount} events available but no citations extracted. The LLM may not have included GitHub URLs properly.`,
    };
  }

  if (eventCount > 0 && expectedCitations === 0) {
    return {
      kind: "ingestion_issue",
      message: `${eventCount} events recorded but none have source URLs. This may indicate an ingestion issue.`,
    };
  }

  return null;
}

function DiagnosticAlert({ status }: { status: DiagnosticStatus }) {
  const styles = {
    no_events: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
    citation_failure: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    ingestion_issue: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
  };

  const labels = {
    no_events: "No Activity",
    citation_failure: "Review Needed",
    ingestion_issue: "Data Issue",
  };

  return (
    <div className={`border-b p-4 ${styles[status.kind]}`}>
      <p className="text-xs uppercase tracking-wide font-medium mb-1">
        {labels[status.kind]}
      </p>
      <p className="text-sm">{status.message}</p>
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
    message = `We haven't ingested any GitHub events since ${formatTimestamp(status.lastEventTs)}.`;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
      <p className="text-xs uppercase tracking-wide font-medium mb-1">Missing Data</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
