import { Doc, Id } from "../_generated/dataModel";
import { normalizeUrl } from "./url";

type EventDoc = Doc<"events">;
type RepoDoc = Doc<"repos">;

export interface ContextEvent {
  id: string;
  type: string;
  repo: string;
  repoUrl?: string;
  timestamp: string;
  title: string;
  summary: string;
  url?: string;
  canonicalText?: string;
  metrics?: {
    additions?: number;
    deletions?: number;
    filesChanged?: number;
  };
}

export interface RepoSummary {
  repo: string;
  repoUrl?: string;
  eventCount: number;
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
}

export interface ReportContext {
  timeframe: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    eventCount: number;
    repoCount: number;
    byType: Record<string, number>;
  };
  repos: RepoSummary[];
  timeline: ContextEvent[];
}

interface BuildContextParams {
  events: EventDoc[];
  reposById: Map<Id<"repos">, RepoDoc | null>;
  startDate: number;
  endDate: number;
}

export function buildReportContext({
  events,
  reposById,
  startDate,
  endDate,
}: BuildContextParams): {
  context: ReportContext;
  timeline: ContextEvent[];
  allowedUrls: string[];
} {
  const sorted = [...events].sort((a, b) => b.ts - a.ts);
  const timeline = sorted.map((event) =>
    normalizeEvent(event, reposById.get(event.repoId) ?? null),
  );

  const byType = sorted.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  const repoStats = new Map<Id<"repos"> | string, RepoSummary>();
  for (const event of sorted) {
    const repoDoc = reposById.get(event.repoId) ?? null;
    const key = event.repoId;
    const existing = repoStats.get(key) ?? {
      repo: repoDoc?.fullName ?? `repo:${event.repoId}`,
      repoUrl: repoDoc?.url,
      eventCount: 0,
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
    };

    existing.eventCount += 1;
    if (event.type.startsWith("pr_")) {
      existing.pullRequests += 1;
    } else if (event.type === "commit") {
      existing.commits += 1;
    } else if (event.type === "review") {
      existing.reviews += 1;
    } else if (event.type.startsWith("issue")) {
      existing.issues += 1;
    }

    repoStats.set(key, existing);
  }

  const context: ReportContext = {
    timeframe: {
      start: new Date(startDate).toISOString(),
      end: new Date(endDate).toISOString(),
      days: Math.max(
        1,
        Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      ),
    },
    totals: {
      eventCount: events.length,
      repoCount: repoStats.size,
      byType,
    },
    repos: [...repoStats.values()].sort((a, b) => b.eventCount - a.eventCount),
    timeline,
  };

  const allowedUrls = Array.from(
    new Set(
      timeline
        .map((event) => event.url)
        .filter((url): url is string => Boolean(url)),
    ),
  );

  return { context, timeline, allowedUrls };
}

function normalizeEvent(event: EventDoc, repo: RepoDoc | null): ContextEvent {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const repoName = repo?.fullName ?? `repo:${event.repoId}`;

  const { title, summary } = deriveDescriptions(event.type, metadata);
  const canonicalText = event.canonicalText ?? undefined;

  const metrics =
    event.metrics ??
    (metadata.additions !== undefined ||
    metadata.deletions !== undefined ||
    metadata.changedFiles !== undefined
      ? {
          additions: safeNumber(metadata.additions),
          deletions: safeNumber(metadata.deletions),
          filesChanged: safeNumber(metadata.changedFiles),
        }
      : undefined);

  const resolvedUrl = normalizeUrl(
    event.sourceUrl ?? resolveMetadataUrl(metadata),
  );

  return {
    id: event._id,
    type: event.type,
    repo: repoName,
    repoUrl: repo?.url ?? undefined,
    timestamp: new Date(event.ts).toISOString(),
    title,
    summary,
    url: resolvedUrl,
    canonicalText,
    metrics,
  };
}

function deriveDescriptions(
  type: string,
  metadata: Record<string, unknown>,
): {
  title: string;
  summary: string;
} {
  if (type === "commit") {
    const message = getString(metadata, "message")?.trim() ?? "";
    if (message) {
      const [firstLine, ...rest] = message.split("\n");
      return {
        title: firstLine,
        summary: rest.join("\n").trim().slice(0, 400),
      };
    }
    return {
      title: "Commit",
      summary: "Commit recorded with no message details provided.",
    };
  }

  if (type.startsWith("pr_")) {
    const title = getString(metadata, "title") ?? "Pull request";
    const stateValue = getString(metadata, "state");
    const state = stateValue ? `State: ${stateValue}` : "";
    const prNumber = getNumber(metadata, "prNumber");
    const number = prNumber !== undefined ? `PR #${prNumber}` : "";
    const changes =
      metadata.additions !== undefined || metadata.deletions !== undefined
        ? `Diff: +${safeNumber(metadata.additions) ?? 0}/-${
            safeNumber(metadata.deletions) ?? 0
          }`
        : "";

    const body = getString(metadata, "body");

    const summaryParts = [number, state, changes, body?.slice(0, 400)]
      .filter(Boolean)
      .join(" · ");

    return {
      title,
      summary: summaryParts || "Pull request activity",
    };
  }

  if (type === "review") {
    const body = getString(metadata, "body")?.trim() ?? "";
    const stateValue = getString(metadata, "state");
    const header = stateValue
      ? `Review ${stateValue.toLowerCase()}`
      : "Pull request review";
    return {
      title:
        getNumber(metadata, "prNumber") !== undefined
          ? `${header} on PR #${getNumber(metadata, "prNumber")}`
          : header,
      summary: body ? body.slice(0, 400) : header,
    };
  }

  if (type.startsWith("issue")) {
    const action = getString(metadata, "action") ?? "updated";
    const issueNumber =
      getNumber(metadata, "issueNumber") !== undefined
        ? `#${getNumber(metadata, "issueNumber")}`
        : "";
    const title = getString(metadata, "title") ?? "Issue activity";
    const summaryParts = [
      action ? `Action: ${action}` : "",
      issueNumber,
      getString(metadata, "body")?.slice(0, 400) ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      title,
      summary: summaryParts || "Issue activity",
    };
  }

  return {
    title: type,
    summary: JSON.stringify(metadata).slice(0, 400),
  };
}

function resolveMetadataUrl(
  metadata: Record<string, unknown>,
): string | undefined {
  if (typeof metadata.url === "string") {
    return metadata.url;
  }
  if (typeof metadata.html_url === "string") {
    return metadata.html_url;
  }
  return undefined;
}

function getString(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = metadata[key];
  return typeof value === "number" ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}
