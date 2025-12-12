"use client";

import { useState } from "react";

interface MetadataItemProps {
  label: string;
  value: string;
  detail?: string;
  status?: "excellent" | "good" | "warning" | "error";
}

function MetadataItem({ label, value, detail, status }: MetadataItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const statusColors = {
    excellent: "text-emerald-600 dark:text-emerald-400",
    good: "text-blue-600 dark:text-blue-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="space-y-2">
        <div className="text-[13px] uppercase tracking-wider font-mono text-muted">
          {label}
        </div>
        <div
          className={`text-[16px] font-semibold transition-colors ${
            status ? statusColors[status] : "text-foreground"
          }`}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {value}
        </div>
        {detail && (
          <div
            className={`text-xs text-foreground-muted transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

interface MetadataPanelProps {
  dateRange: string;
  repos?: string[];
  commitCount?: number;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  provider: string;
  model: string;
  coverage?: number;
  citationCount?: number;
  eventCount?: number;
}

export function MetadataPanel({
  dateRange,
  repos = [],
  commitCount = 0,
  filesChanged,
  additions,
  deletions,
  provider,
  model,
  coverage,
  citationCount,
  eventCount,
}: MetadataPanelProps) {
  // Format activity detail
  const activityDetail = [
    filesChanged !== undefined ? `${filesChanged} files` : null,
    additions !== undefined ? `+${additions}` : null,
    deletions !== undefined ? `-${deletions}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Determine coverage status
  const getCoverageStatus = (cov?: number) => {
    if (!cov) return undefined;
    if (cov >= 0.9) return "excellent";
    if (cov >= 0.7) return "good";
    if (cov >= 0.5) return "warning";
    return "error";
  };

  const coveragePercent = coverage ? Math.round(coverage * 100) : undefined;
  const coverageDetail =
    citationCount !== undefined && eventCount !== undefined
      ? `${citationCount}/${eventCount} events cited`
      : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface-muted/20 p-6 transition-colors hover:bg-surface-muted/30">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetadataItem label="Date Range" value={dateRange} />

        <MetadataItem
          label="Repositories"
          value={repos.length > 0 ? `${repos.length} repos` : "No repos"}
          detail={repos.length > 0 ? repos.join(", ") : undefined}
        />

        <MetadataItem
          label="Activity"
          value={commitCount > 0 ? `${commitCount} commits` : "No commits"}
          detail={activityDetail || undefined}
        />

        <MetadataItem
          label="Model"
          value={model.split("/").pop() || model}
          detail={`${provider} / ${model}`}
        />

        {coveragePercent !== undefined && (
          <MetadataItem
            label="Coverage"
            value={`${coveragePercent}%`}
            detail={coverageDetail}
            status={getCoverageStatus(coverage)}
          />
        )}
      </div>
    </div>
  );
}
