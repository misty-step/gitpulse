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

export function computeCoverageSummary(
  candidates: CoverageCandidate[]
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
    breakdown: Array.from(totals.values()).sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
  };
}
