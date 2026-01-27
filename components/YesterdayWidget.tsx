"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { trackEvent } from "@/lib/analytics";
import { formatReportDate } from "@/lib/formatters";
import DOMPurify from "isomorphic-dompurify";

type YesterdayWidgetProps = {
  reports: Doc<"reports">[] | undefined;
  isLoading: boolean;
};

export function YesterdayWidget({ reports, isLoading }: YesterdayWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dailyReport = reports?.find(
    (report) => report.scheduleType === "daily",
  );
  const summaryBullets =
    dailyReport?.sections?.[0]?.bullets?.filter((bullet) => bullet?.trim()) ??
    [];
  const tldrBullets = summaryBullets.slice(0, 3);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 h-3 w-28 rounded bg-surface-muted" />
        <div className="mb-3 h-6 w-2/3 rounded bg-surface-muted" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-surface-muted" />
          <div className="h-3 w-5/6 rounded bg-surface-muted" />
          <div className="h-3 w-2/3 rounded bg-surface-muted" />
        </div>
      </div>
    );
  }

  if (!dailyReport) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold">No daily reports yet</p>
        <p className="mt-2 text-sm text-muted">
          Run your daily standup to see yesterday&apos;s summary here.
        </p>
      </div>
    );
  }

  const formattedDate = formatReportDate(
    dailyReport.startDate,
    dailyReport.endDate,
  );
  const reportTitle = dailyReport.title || "Daily Standup";

  const handleToggle = () => {
    if (!isExpanded) {
      trackEvent("yesterday_widget_expanded", { reportId: dailyReport._id });
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
              Yesterday
            </span>
            <span className="text-xs text-muted">{formattedDate}</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {reportTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="mt-4">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
          TL;DR
        </span>
        {tldrBullets.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {tldrBullets.map((bullet, index) => (
              <li
                key={`${dailyReport._id}-tldr-${index}`}
                className="flex gap-2"
              >
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Summary bullets will appear after the next run.
          </p>
        )}
      </div>

      {isExpanded && (
        <div className="mt-6 border-t border-border/70 pt-6">
          <div
            className="prose-luxury max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(dailyReport.html ?? ""),
            }}
          />
        </div>
      )}
    </div>
  );
}
