/**
 * Legacy API adapter for transforming between old and new API formats
 * Maintains backward compatibility while using the new effect-based architecture
 */

import type { SummaryRequest, SummaryStats } from '../../core/types/index';
import type { NextRequest } from 'next/server';
import { logger } from '../../lib/logger';

const MODULE_NAME = "services:adapters:legacy-api";

/**
 * Transform legacy query parameters to new SummaryRequest format
 */
export const transformLegacyRequestToSummaryRequest = (
  request: NextRequest,
  repositories: readonly string[]
): SummaryRequest => {
  const searchParams = request.nextUrl.searchParams;
  
  // Date range parameters (required in legacy API)
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  
  if (!since || !until) {
    throw new Error("Missing required parameters: since and until dates");
  }

  // Parse contributor filters
  const contributorsParam = searchParams.get("contributors");
  const contributors = contributorsParam ? contributorsParam.split(",") : [];

  // Convert legacy parameters to new format
  const summaryRequest: SummaryRequest = {
    repositories,
    dateRange: {
      start: new Date(since),
      end: new Date(until)
    },
    users: contributors.length > 0 ? contributors : undefined,
    includePrivate: true, // Legacy API always included private repos if accessible
    branch: undefined // Legacy API didn't support branch filtering
  };

  logger.debug(MODULE_NAME, "Transformed legacy request to SummaryRequest", {
    repositoryCount: repositories.length,
    dateRange: {
      start: summaryRequest.dateRange.start.toISOString(),
      end: summaryRequest.dateRange.end.toISOString()
    },
    userCount: contributors.length,
    hasUsers: !!summaryRequest.users
  });

  return summaryRequest;
};

/**
 * Legacy API response format for backward compatibility
 */
export interface LegacySummaryResponse {
  user?: string;
  commits: any[];
  stats: any;
  aiSummary: any;
  filterInfo: {
    contributors: string[] | null;
    organizations: string[] | null;
    repositories: string[] | null;
    dateRange: { since: string; until: string };
  };
  groupedResults: any[];
  authMethod: "github_app" | "oauth";
  installationIds: number[] | null;
  installations: any[];
  currentInstallations: any[];
}

/**
 * Transform new SummaryStats to legacy API response format
 */
export const transformSummaryStatsToLegacyResponse = (
  stats: SummaryStats,
  originalCommits: any[],
  filterInfo: LegacySummaryResponse['filterInfo'],
  userName?: string,
  authMethod: "github_app" | "oauth" = "oauth",
  installationIds: readonly number[] = [],
  installations: any[] = []
): LegacySummaryResponse => {
  logger.debug(MODULE_NAME, "Transforming SummaryStats to legacy response format", {
    totalCommits: stats.totalCommits,
    uniqueAuthors: stats.uniqueAuthors,
    repositoryCount: stats.repositories.length,
    authMethod,
    installationCount: installationIds.length
  });

  // Transform stats to legacy format
  const legacyStats = {
    totalCommits: stats.totalCommits,
    uniqueRepositories: stats.repositories.length,
    uniqueAuthors: stats.uniqueAuthors,
    totalAdditions: stats.totalAdditions,
    totalDeletions: stats.totalDeletions,
    totalChanges: stats.totalAdditions + stats.totalDeletions,
    averageCommitsPerDay: stats.averageCommitsPerDay,
    mostActiveDay: stats.mostActiveDay || null,
    mostActiveRepositories: stats.topRepositories,
    commitsByDay: stats.commitsByDay,
    commitsByAuthor: stats.commitsByAuthor,
    // Additional legacy fields
    repositories: stats.repositories,
    dates: Object.keys(stats.commitsByDay).sort(), // Add dates array for frontend compatibility
    dateRange: filterInfo.dateRange
  };

  // Create grouped results in legacy format (chronological view)
  const groupedResults = [{
    groupKey: 'all',
    groupName: 'All Commits',
    commitCount: stats.totalCommits,
    repositories: stats.repositories,
    dates: Object.keys(stats.commitsByDay).sort(),
    commits: originalCommits,
    // AI summary will be added by the route handler
  }];

  const response: LegacySummaryResponse = {
    user: userName,
    commits: originalCommits,
    stats: legacyStats,
    aiSummary: null, // Will be populated by AI service
    filterInfo,
    groupedResults,
    authMethod,
    installationIds: installationIds.length > 0 ? [...installationIds] : null,
    installations,
    currentInstallations: installationIds.length > 0 
      ? installations.filter((i: any) => installationIds.includes(i.id))
      : []
  };

  return response;
};

/**
 * Parse repository filters from legacy query parameters
 */
export const parseRepositoryFilters = (request: NextRequest): {
  organizations: string[],
  repositoryFilters: string[]
} => {
  const searchParams = request.nextUrl.searchParams;
  
  const organizationsParam = searchParams.get("organizations");
  const organizations = organizationsParam ? organizationsParam.split(",") : [];
  
  const repositoriesParam = searchParams.get("repositories");
  const repositoryFilters = repositoriesParam ? repositoriesParam.split(",") : [];

  logger.debug(MODULE_NAME, "Parsed repository filters", {
    organizationCount: organizations.length,
    repositoryFilterCount: repositoryFilters.length,
    organizations,
    repositoryFilters
  });

  return { organizations, repositoryFilters };
};

/**
 * Create filter info for legacy response format
 */
export const createLegacyFilterInfo = (
  request: NextRequest,
  repositories: readonly string[]
): LegacySummaryResponse['filterInfo'] => {
  const searchParams = request.nextUrl.searchParams;
  
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const contributorsParam = searchParams.get("contributors");
  const contributors = contributorsParam ? contributorsParam.split(",") : [];
  const { organizations } = parseRepositoryFilters(request);

  return {
    contributors: contributors.length > 0 ? contributors : null,
    organizations: organizations.length > 0 ? organizations : null,
    repositories: repositories.length > 0 ? [...repositories] : null,
    dateRange: { since: since || '', until: until || '' }
  };
};