"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as Id<"reports">;
  const { clerkUser } = useAuthenticatedConvexUser();

  const report = useQuery(api.reports.getById, { id: reportId });

  // Fetch reports list to find adjacent reports
  const allReports = useQuery(
    api.reports.listByUser,
    clerkUser?.id ? { userId: clerkUser.id, limit: 100 } : "skip"
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <div className="flex items-start justify-between">
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
          <button
            onClick={handleDownloadMarkdown}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-slate-200 dark:hover:bg-neutral-800"
          >
            Download Markdown
          </button>
        </div>
      </div>

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

      {/* Report Content (HTML) */}
      <div className="prose prose-slate max-w-none rounded-lg border border-gray-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900 dark:prose-invert">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: report.html }}
        />
      </div>

      {/* Citations */}
      {report.citations.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">
            Citations ({report.citations.length})
          </h2>
          <div className="space-y-2">
            {report.citations.map((citation, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="font-mono text-sm text-gray-500 dark:text-slate-400">
                  [{idx + 1}]
                </span>
                <a
                  href={citation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {citation}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
