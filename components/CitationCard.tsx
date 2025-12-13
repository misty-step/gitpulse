"use client";

import { ExternalLink } from "lucide-react";

interface CitationCardProps {
  number: number;
  url: string;
}

function formatCitationUrl(url: string): { repo: string; ref: string } | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    const match = path.match(/\/([^/]+)\/([^/]+)\/(pull|issues|commit)\/([^/]+)/);
    if (match) {
      const [, owner, repo, type, num] = match;
      const typeLabel = type === "pull" ? "PR" : type === "issues" ? "Issue" : "Commit";
      return {
        repo: `${owner}/${repo}`,
        ref: `${typeLabel} #${num.slice(0, 7)}`,
      };
    }

    return {
      repo: parsed.hostname,
      ref: path,
    };
  } catch {
    return null;
  }
}

export function CitationCard({ number, url }: CitationCardProps) {
  const formatted = formatCitationUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 p-4 rounded-lg border border-border bg-surface transition-all duration-200 hover:border-[var(--indigo)] hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Number Badge */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--indigo)] text-[var(--indigo-foreground)] flex items-center justify-center font-mono text-sm font-semibold"
      >
        {number}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {formatted ? (
          <>
            <div className="text-sm font-medium text-foreground truncate font-mono">
              {formatted.repo}
            </div>
            <div className="text-xs text-foreground-muted mt-0.5">
              {formatted.ref}
            </div>
          </>
        ) : (
          <div className="text-sm text-foreground-muted break-all">
            {url}
          </div>
        )}
      </div>

      {/* Icon */}
      <ExternalLink className="flex-shrink-0 w-4 h-4 text-muted transition-colors group-hover:text-[var(--indigo)]" />
    </a>
  );
}
