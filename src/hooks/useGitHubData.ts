/**
 * Consolidated hook for all GitHub data operations
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Repository, Installation, ActivityMode, DateRange } from '@/types/dashboard';

interface GenerateSummaryParams {
  activityMode: ActivityMode;
  dateRange: DateRange;
  selectedRepositoryIds: string[];
  contributors: string[];
  organizations: string[];
  installationIds: number[];
}

interface UseGitHubDataReturn {
  // Data
  repositories: Repository[] | readonly Repository[];
  installations: Installation[] | readonly Installation[];
  summary: any;

  // Loading states
  loading: boolean;

  // Error states
  error: string | null;
  needsInstallation: boolean;

  // Actions
  fetchRepositories: (installationId?: number) => Promise<boolean>;
  generateSummary: (params: GenerateSummaryParams) => Promise<void>;
}

/**
 * Unified hook for all GitHub data operations
 */
export function useGitHubData(): UseGitHubDataReturn {
  const { data: session } = useSession();

  // Data state
  const [repositories, setRepositories] = useState<Repository[] | readonly Repository[]>([]);
  const [installations, setInstallations] = useState<Installation[] | readonly Installation[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Loading state - single source of truth
  const [loading, setLoading] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);
  const [needsInstallation, setNeedsInstallation] = useState(false);

  /**
   * Fetch repositories from GitHub
   */
  const fetchRepositories = useCallback(async (installationId?: number): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const url = installationId
        ? `/api/repos?installation_id=${installationId}`
        : '/api/repos';

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.needsInstallation) {
          setNeedsInstallation(true);
          setError('GitHub App installation required');
          return false;
        }

        if (response.status === 401 || response.status === 403) {
          setError('Authentication required. Please sign in again.');
          return false;
        }

        throw new Error(errorData.error || 'Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.repositories);

      // Store installations if provided
      if (data.installations) {
        setInstallations(data.installations);
      }

      setNeedsInstallation(false);
      return true;
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError('Failed to fetch repositories');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Generate summary for selected repositories
   */
  const generateSummary = useCallback(async (params: GenerateSummaryParams): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setSummary(null);

      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityMode: params.activityMode,
          since: params.dateRange.since,
          until: params.dateRange.until,
          repositories: params.selectedRepositoryIds,
          contributors: params.contributors,
          organizations: params.organizations,
          installationIds: params.installationIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Data
    repositories,
    installations,
    summary,

    // Loading states
    loading,

    // Error states
    error,
    needsInstallation,

    // Actions
    fetchRepositories,
    generateSummary,
  };
}