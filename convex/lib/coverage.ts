import type { Doc } from "../_generated/dataModel";
import { normalizeUrl } from "./url";

export interface CoverageCandidate {
  scopeKey: string;
  used: boolean;
}

export interface CoverageBreakdownEntry {
  scopeKey: string;
  used: number;
  total: number;
}

export interface CoverageSummary {
  coverageScore: number;
  breakdown: CoverageBreakdownEntry[];
}

export interface CoverageValidationResult extends CoverageSummary {
  pass: boolean;
}

export interface CoverageReportPayload {
  markdown: string;
  citations?: string[];
}

export function computeCoverageSummary(
  candidates: CoverageCandidate[],
): CoverageSummary {
  if (candidates.length === 0) {
    return { coverageScore: 0, breakdown: [] };
  }

  const totals = new Map<string, CoverageBreakdownEntry>();

  for (const candidate of candidates) {
    const existing = totals.get(candidate.scopeKey) ?? {
      scopeKey: candidate.scopeKey,
      used: 0,
      total: 0,
    };

    existing.total += 1;
    if (candidate.used) {
      existing.used += 1;
    }

    totals.set(candidate.scopeKey, existing);
  }

  const totalFacts = candidates.length;
  const usedFacts = candidates.filter((c) => c.used).length;
  const coverageScore = totalFacts === 0 ? 0 : usedFacts / totalFacts;

  return {
    coverageScore,
    breakdown: Array.from(totals.values()).sort((a, b) =>
      a.scopeKey.localeCompare(b.scopeKey),
    ),
  };
}

export class CoverageValidationError extends Error {
  constructor(
    public readonly summary: CoverageSummary,
    public readonly threshold: number,
  ) {
    super(
      `Coverage ${formatPercent(summary.coverageScore)} below threshold ${formatPercent(
        threshold,
      )}`,
    );
    this.name = "CoverageValidationError";
  }
}

export function validateCoverage(
  events: Doc<"events">[],
  report: CoverageReportPayload,
  threshold = 0.95,
): CoverageValidationResult {
  if (events.length === 0) {
    return { pass: true, coverageScore: 1, breakdown: [] };
  }

  const citations = collectCitations(report);
  const normalizedCitations = new Set(
    citations
      .map((url) => normalizeUrl(url))
      .filter((url): url is string => Boolean(url)),
  );

  const candidates: CoverageCandidate[] = events.map((event) => ({
    scopeKey: `repo:${event.repoId}`,
    used: isEventCited(event, normalizedCitations),
  }));

  const summary = computeCoverageSummary(candidates);

  if (summary.coverageScore < threshold) {
    throw new CoverageValidationError(summary, threshold);
  }

  return { pass: true, ...summary };
}

export function isEventCited(
  event: Doc<"events">,
  citationSet: Set<string>,
): boolean {
  if (!citationSet.size) {
    return false;
  }

  const eventUrl = extractEventUrl(event);
  if (!eventUrl) {
    return false;
  }

  return citationSet.has(eventUrl);
}

export function extractEventUrl(event: Doc<"events">): string | undefined {
  const metadata = (event.metadata ?? {}) as Record<string, any>;
  const candidates = [
    event.sourceUrl,
    metadata?.url,
    metadata?.html_url,
    metadata?.htmlUrl,
    metadata?.sourceUrl,
    metadata?.commit?.html_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeUrl(candidate);
    }
  }

  return undefined;
}

function collectCitations(report: CoverageReportPayload): string[] {
  if (report.citations && report.citations.length > 0) {
    return report.citations;
  }

  return Array.from(
    report.markdown.matchAll(/\[[^\]]+\]\((https?:[^)\s]+)\)/g),
  ).map((match) => match[1]);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
