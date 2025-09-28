'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getDefaultDateRange } from '@/lib/dashboard-utils';
import { DateRange } from '@/types/dashboard';

// Custom hooks
import { useRepositories } from '@/hooks/dashboard/useRepositories';
import { useInstallations } from '@/hooks/dashboard/useInstallations';
import { useFilters } from '@/hooks/dashboard/useFilters';
import { useSummary } from '@/hooks/dashboard/useSummary';
import { useLocalStoragePreferences } from '@/hooks/useLocalStoragePreferences';
import { useLastGenerationParams } from '@/hooks/useLastGenerationParams';

// Components
import Header from '@/components/dashboard/Header';
import DashboardLoadingState from '@/components/DashboardLoadingState';
import OperationsPanel from '@/components/dashboard/OperationsPanel';
import RepositorySection from '@/components/dashboard/RepositorySection';
import AnalysisParameters from '@/components/dashboard/AnalysisParameters';
import SummaryView from '@/components/dashboard/SummaryView';
import SummarySkeletonLoader from '@/components/dashboard/SummarySkeletonLoader';
import QuickActionBar from '@/components/dashboard/QuickActionBar';
import CompactToolbar from '@/components/dashboard/CompactToolbar';
import AdvancedOptions from '@/components/dashboard/AdvancedOptions';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { loadPreferences, savePreferences } = useLocalStoragePreferences();
  const { loadLastGeneration, saveLastGeneration } = useLastGenerationParams();

  // State for initial loading and date range
  const [initialLoad, setInitialLoad] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [lastGeneration, setLastGeneration] = useState(() => loadLastGeneration());

  // Advanced options state
  const [excludeForks, setExcludeForks] = useState(false);
  const [filterByLanguage, setFilterByLanguage] = useState('');
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);

  // Optimistic UI state - show skeleton immediately when generating
  const [showSkeleton, setShowSkeleton] = useState(false);
  
  // Custom hooks for repositories, installations, filters, and summary
  const { 
    repositories,
    loading: repoLoading,
    error: repoError,
    needsInstallation: repoNeedsInstallation,
    fetchRepositories
  } = useRepositories();
  
  const {
    installations,
    currentInstallations,
    installationIds,
    needsInstallation: installNeedsInstallation,
    switchInstallations,
    setInstallations,
    addCurrentInstallation,
    setNeedsInstallation
  } = useInstallations({ fetchRepositories });
  
  const {
    filters,
    activityMode,
    setContributors,
    setOrganizations,
    setRepositories: setFilterRepositories,
    setActivityMode
  } = useFilters({
    initialFilters: {
      contributors: ['me'],
      organizations: [],
      repositories: []
    }
  });
  
  const {
    loading: summaryLoading,
    error: summaryError,
    summary,
    generateSummary,
    authMethod,
    currentInstallations: summaryInstallations,
    progress: summaryProgress
  } = useSummary({
    dateRange,
    activityMode,
    organizations: filters.organizations,
    repositories: filters.repositories,
    contributors: filters.contributors,
    installationIds: installationIds as readonly number[]
  });
  
  // Apply advanced filters to repositories
  const filteredRepositories = useMemo(() => {
    let filtered = [...repositories];

    // Apply language filter
    if (filterByLanguage) {
      filtered = filtered.filter(repo => repo.language === filterByLanguage);
    }

    // Apply private only filter
    if (showPrivateOnly) {
      filtered = filtered.filter(repo => repo.private);
    }

    // Note: Fork filtering would require additional API data
    // For now, we'll keep this as a placeholder

    return filtered;
  }, [repositories, filterByLanguage, showPrivateOnly]);

  // Determine the active error message to display (prioritize repository errors)
  const activeError = repoError || summaryError;
  const needsInstallation = repoNeedsInstallation || installNeedsInstallation;
  const loading = repoLoading || summaryLoading;
  const progressMessage = summaryLoading ? summaryProgress.message : undefined;
  const selectedRepositoryIds = filters.repositories;
  
  // Handle date range changes
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
  }, []);
  
  // Handle organization selection changes
  const handleOrganizationChange = useCallback((selectedOrgs: string[]) => {
    setOrganizations(selectedOrgs);
  }, [setOrganizations]);
  
  // Handle filter changes (legacy support)
  // Start fetching repositories immediately on mount (parallel with auth check)
  // This saves ~500ms by not waiting for session to be available
  const repositoryFetchStarted = useRef(false);

  useEffect(() => {
    // Only fetch once on mount
    if (repositoryFetchStarted.current) {
      return;
    }
    repositoryFetchStarted.current = true;

    // Check for GitHub installation cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const installCookie = getCookie('github_installation_id');

    if (installCookie) {
      console.log('Found GitHub installation cookie:', installCookie);
      // Parse the installation ID from cookie and use it
      const installId = parseInt(installCookie, 10);
      if (!isNaN(installId)) {
        fetchRepositories(installId).then(success => {
          if (success) {
            localStorage.setItem('lastRepositoryRefresh', Date.now().toString());
          }
        });
        // Clear the cookie after using it
        document.cookie = 'github_installation_id=; path=/; max-age=0; samesite=lax';
        return;
      }
    }

    // Start prefetching repositories immediately (don't wait for session)
    // The fetchRepositories hook will handle auth when session becomes available
    console.log('Prefetching repositories on page load...');
    fetchRepositories().then(success => {
      if (success) {
        localStorage.setItem('lastRepositoryRefresh', Date.now().toString());
      }
    });
  }, [fetchRepositories]);

  // Smart repository pre-selection: Auto-select repos with recent activity
  useEffect(() => {
    // Only run when repositories are first loaded and no repositories are selected
    if (repositories.length > 0 && filters.repositories.length === 0) {
      // Check if we've already done auto-selection for this session
      const autoSelectKey = `gitpulse_auto_selected_${session?.user?.email || 'user'}`;
      const hasAutoSelected = sessionStorage.getItem(autoSelectKey);

      if (!hasAutoSelected) {
        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Filter repositories that have been updated in the last 30 days
        const recentRepos = repositories.filter(repo => {
          if (repo.updated_at) {
            const updatedDate = new Date(repo.updated_at);
            return updatedDate > thirtyDaysAgo;
          }
          return false;
        });

        // If we found recent repositories, pre-select them
        if (recentRepos.length > 0) {
          const repoNames = recentRepos.map(repo => repo.full_name);
          setFilterRepositories(repoNames);
          console.log(`Auto-selected ${recentRepos.length} recently active repositories`);

          // Mark that we've done auto-selection for this session
          sessionStorage.setItem(autoSelectKey, 'true');
        } else {
          // If no recent repos, select all repositories as fallback
          const allRepoNames = repositories.map(repo => repo.full_name);
          setFilterRepositories(allRepoNames);
          console.log('No recently active repositories found, selected all repositories');
          sessionStorage.setItem(autoSelectKey, 'true');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories, filters.repositories.length, session]);

  // Function to check whether repositories need to be refreshed
  const shouldRefreshRepositories = useCallback(() => {
    // Don't refresh if we have no session
    if (!session?.accessToken) return false;
    
    // Check if we have repositories and a last refresh time
    if (repositories.length > 0) {
      const lastRefreshTime = localStorage.getItem('lastRepositoryRefresh');
      if (lastRefreshTime) {
        // Use longer TTL - 1 hour for repository data
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshTime, 10);
        return timeSinceLastRefresh > oneHour;
      }
    }
    
    // No repositories or no refresh time - must refresh
    return true;
  }, [session, repositories.length]);
  
  // Function to check for installation changes when focus returns to the window
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if needed
      if (shouldRefreshRepositories()) {
        console.log('Window focused, refreshing repositories (due to cache expiration)');
        // Save current selections
        const currentOrgSelections = filters.organizations;
        // After fetching, we'll sync the filter state with current selections
        fetchRepositories().then((success) => {
          // Update the last refresh time
          if (success) {
            localStorage.setItem('lastRepositoryRefresh', Date.now().toString());
            
            // If we had organizations selected in filters, preserve those selections
            if (currentOrgSelections.length > 0) {
              setOrganizations(currentOrgSelections);
            }
          }
        });
      } else {
        console.log('Window focused, skipping repository refresh (recently fetched)');
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, fetchRepositories, filters.organizations, setOrganizations, shouldRefreshRepositories]);
  
  // Update initialLoad status after first fetch completes
  useEffect(() => {
    if (!repoLoading && repositories.length > 0 && initialLoad) {
      setInitialLoad(false);
    }
  }, [repoLoading, repositories, initialLoad]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const preferences = loadPreferences();
    if (preferences) {
      // Apply saved date range
      if (preferences.dateRange) {
        setDateRange(preferences.dateRange);
      }

      // Apply saved activity mode
      if (preferences.activityMode) {
        setActivityMode(preferences.activityMode);
      }

      // Apply saved repository selections
      if (preferences.selectedRepositoryIds && preferences.selectedRepositoryIds.length > 0) {
        setSelectedRepoIds([...preferences.selectedRepositoryIds]);
        setFilterRepositories([...preferences.selectedRepositoryIds]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount - dependencies intentionally excluded

  // Save preferences to localStorage when they change
  useEffect(() => {
    // Don't save on initial load
    if (!initialLoad) {
      savePreferences({
        activityMode,
        dateRange,
        selectedRepositoryIds: filters.repositories
      });
    }
  }, [activityMode, dateRange, filters.repositories, initialLoad, savePreferences]);
  
  // Wrap generateSummary to save last generation parameters and show skeleton
  const handleGenerateSummary = useCallback(async () => {
    // Save the current parameters as last generation
    const params = {
      activityMode,
      dateRange,
      selectedRepositoryIds: filters.repositories,
      organizations: filters.organizations,
      contributors: filters.contributors
    };

    saveLastGeneration(params);
    setLastGeneration({ ...params, timestamp: Date.now() });

    // Show skeleton immediately (optimistic UI)
    setShowSkeleton(true);

    // Call the original generateSummary and hide skeleton when done
    try {
      await generateSummary();
    } finally {
      // Hide skeleton after generation completes (success or error)
      setShowSkeleton(false);
    }
  }, [
    activityMode,
    dateRange,
    filters.repositories,
    filters.organizations,
    filters.contributors,
    generateSummary,
    saveLastGeneration
  ]);

  // Regenerate with last parameters
  const handleRegenerateLast = useCallback(async () => {
    if (!lastGeneration) return;

    // Apply the last generation parameters
    setDateRange(lastGeneration.dateRange);
    setActivityMode(lastGeneration.activityMode);
    setFilterRepositories([...lastGeneration.selectedRepositoryIds]);
    setOrganizations([...lastGeneration.organizations]);
    setContributors([...lastGeneration.contributors]);

    // Show skeleton immediately (optimistic UI)
    setShowSkeleton(true);

    // Small delay to ensure state updates are applied
    setTimeout(async () => {
      try {
        await generateSummary();
      } finally {
        setShowSkeleton(false);
      }
    }, 100);
  }, [
    lastGeneration,
    setDateRange,
    setActivityMode,
    setFilterRepositories,
    setOrganizations,
    setContributors,
    generateSummary
  ]);

  // Show loading state during initial session loading or first data fetch
  if (status === 'loading' || initialLoad) {
    return <DashboardLoadingState />;
  }

  return (
    <div>
      {/* Quick Action Bar */}
      <QuickActionBar
        lastGeneration={lastGeneration}
        loading={loading}
        onRegenerateLast={handleRegenerateLast}
      />

      <CompactToolbar
        activityMode={activityMode}
        onModeChange={setActivityMode}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        loading={loading}
        progressMessage={progressMessage}
        repositories={filteredRepositories}
        selectedRepositoryIds={selectedRepositoryIds}
        contributors={filters.contributors}
        userName={session?.user?.name}
        onGenerate={handleGenerateSummary}
      />

      {/* Advanced Options Section - Hidden on mobile for simplicity */}
      <div>
        <AdvancedOptions
          repositories={repositories}
          selectedRepositoryIds={selectedRepositoryIds}
          onRepositorySelectionChange={setFilterRepositories}
          excludeForks={excludeForks}
          onExcludeForksChange={setExcludeForks}
          filterByLanguage={filterByLanguage}
          onLanguageFilterChange={setFilterByLanguage}
          showPrivateOnly={showPrivateOnly}
          onPrivateOnlyChange={setShowPrivateOnly}
          disabled={loading}
        />
      </div>

      {/* Header Component */}
      <Header
        userName={session?.user?.name}
        userImage={session?.user?.image}
        signOutCallbackUrl="/"
      />

      <main>
        <div>
          {/* Operations Panel Component */}
          <OperationsPanel
            error={activeError}
            loading={loading}
            needsInstallation={needsInstallation}
            authMethod={authMethod}
            installations={installations}
            currentInstallations={currentInstallations}
            activityMode={activityMode}
            activeFilters={{
              contributors: [...filters.contributors],
              organizations: [...filters.organizations],
              repositories: [...filters.repositories]
            }}
            userName={session?.user?.name}
            onOrganizationChange={handleOrganizationChange}
            onSwitchInstallations={switchInstallations}
            onSignOut={signOut}
          />
          
          <div>
            <AnalysisParameters
              activityMode={activityMode}
              dateRange={dateRange}
              organizations={filters.organizations}
            />
          </div>

          {/* Repository Section Component */}
          <RepositorySection
            repositories={filteredRepositories}
            loading={loading}
            activeFilters={{
              contributors: [...filters.contributors],
              organizations: [...filters.organizations],
              repositories: [...filters.repositories]
            }}
            isWithinForm={false}
          />

          {/* Show skeleton loader when generating, otherwise show summary if available */}
          {showSkeleton ? (
            <SummarySkeletonLoader />
          ) : (
            summary && (
              <SummaryView
                summary={summary}
                activityMode={activityMode}
                dateRange={dateRange}
                activeFilters={{
                  contributors: [...filters.contributors],
                  organizations: [...filters.organizations],
                  repositories: [...filters.repositories]
                }}
                installationIds={installationIds as readonly number[]}
                loading={loading}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
