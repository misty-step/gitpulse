'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DateRange, ActivityMode } from '@/types/dashboard';

interface DashboardURLSyncProps {
  activityMode: ActivityMode;
  dateRange: DateRange;
  selectedRepos: string[];
  selectedOrgs: string[];
  onActivityModeChange: (mode: ActivityMode) => void;
  onDateRangeChange: (range: DateRange) => void;
  onReposChange: (repos: string[]) => void;
  onOrgsChange: (orgs: string[]) => void;
}

/**
 * Component that syncs dashboard state with URL search params
 * Enables shareable URLs, browser navigation, and bookmarking
 */
export default function DashboardURLSync({
  activityMode,
  dateRange,
  selectedRepos,
  selectedOrgs,
  onActivityModeChange,
  onDateRangeChange,
  onReposChange,
  onOrgsChange
}: DashboardURLSyncProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read state from URL on mount
  useEffect(() => {
    const mode = searchParams.get('mode') as ActivityMode;
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const repos = searchParams.get('repos');
    const orgs = searchParams.get('orgs');

    // Update state from URL params if they exist
    if (mode && mode !== activityMode) {
      onActivityModeChange(mode);
    }

    if (since && until && (since !== dateRange.since || until !== dateRange.until)) {
      onDateRangeChange({ since, until });
    }

    if (repos) {
      const repoList = repos.split(',').filter(Boolean);
      if (JSON.stringify(repoList) !== JSON.stringify(selectedRepos)) {
        onReposChange(repoList);
      }
    }

    if (orgs) {
      const orgList = orgs.split(',').filter(Boolean);
      if (JSON.stringify(orgList) !== JSON.stringify(selectedOrgs)) {
        onOrgsChange(orgList);
      }
    }
  }, [searchParams]); // Only run when URL changes

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();

    // Add all state to URL params
    params.set('mode', activityMode);
    params.set('since', dateRange.since);
    params.set('until', dateRange.until);

    if (selectedRepos.length > 0) {
      params.set('repos', selectedRepos.join(','));
    }

    if (selectedOrgs.length > 0) {
      params.set('orgs', selectedOrgs.join(','));
    }

    // Only update URL if it's different from current
    const newURL = `?${params.toString()}`;
    const currentURL = `?${searchParams.toString()}`;

    if (newURL !== currentURL) {
      router.push(newURL, { scroll: false });
    }
  }, [activityMode, dateRange, selectedRepos, selectedOrgs, router]);

  // This component only handles URL sync, no UI
  return null;
}