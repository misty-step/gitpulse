'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DateRange, ActivityMode } from '@/types/dashboard';

interface URLState {
  mode: ActivityMode;
  since: string;
  until: string;
  repos: string[];
  orgs: string[];
}

/**
 * Custom hook to manage application state via URL search params
 * Makes the app shareable, bookmarkable, and work with browser navigation
 */
export function useURLState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);

  // Parse current URL state
  const getURLState = useCallback((): URLState => {
    const mode = (searchParams.get('mode') as ActivityMode) || 'my-activity';
    const since = searchParams.get('since') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = searchParams.get('until') || new Date().toISOString().split('T')[0];
    const repos = searchParams.get('repos')?.split(',').filter(Boolean) || [];
    const orgs = searchParams.get('orgs')?.split(',').filter(Boolean) || [];

    return { mode, since, until, repos, orgs };
  }, [searchParams]);

  // Update URL with new state
  const setURLState = useCallback((updates: Partial<URLState>) => {
    const current = getURLState();
    const newState = { ...current, ...updates };

    // Build new URL params
    const params = new URLSearchParams();
    params.set('mode', newState.mode);
    params.set('since', newState.since);
    params.set('until', newState.until);
    if (newState.repos.length > 0) {
      params.set('repos', newState.repos.join(','));
    }
    if (newState.orgs.length > 0) {
      params.set('orgs', newState.orgs.join(','));
    }

    // Update URL without page reload
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, getURLState]);

  // Helper functions for specific state updates
  const setActivityMode = useCallback((mode: ActivityMode) => {
    setURLState({ mode });
  }, [setURLState]);

  const setDateRange = useCallback((dateRange: DateRange) => {
    setURLState({ since: dateRange.since, until: dateRange.until });
  }, [setURLState]);

  const setSelectedRepos = useCallback((repos: string[]) => {
    setURLState({ repos });
  }, [setURLState]);

  const setSelectedOrgs = useCallback((orgs: string[]) => {
    setURLState({ orgs });
  }, [setURLState]);

  // Initialize URL with defaults if empty
  useEffect(() => {
    if (!isInitialized && searchParams.toString() === '') {
      const defaultState = getURLState();
      const params = new URLSearchParams();
      params.set('mode', defaultState.mode);
      params.set('since', defaultState.since);
      params.set('until', defaultState.until);

      router.replace(`?${params.toString()}`, { scroll: false });
      setIsInitialized(true);
    }
  }, [searchParams, router, getURLState, isInitialized]);

  const state = getURLState();

  return {
    // Current state from URL
    activityMode: state.mode,
    dateRange: { since: state.since, until: state.until },
    selectedRepos: state.repos,
    selectedOrgs: state.orgs,

    // Setters
    setActivityMode,
    setDateRange,
    setSelectedRepos,
    setSelectedOrgs,
    setURLState,

    // Direct URL state for components that need it
    urlState: state
  };
}