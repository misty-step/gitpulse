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
import NavBar from '@/components/dashboard/NavBar';

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

  // Combine loading states
  const loading = repoLoading || summaryLoading;

  // Combine error messages
  const activeError = repoError || summaryError;

  // Combine needsInstallation flags
  const needsInstallation = repoNeedsInstallation || installNeedsInstallation;

  // Store preferences on filter changes
  useEffect(() => {
    if (initialLoad) return;

    savePreferences({
      activityMode,
      dateRange,
      selectedRepositoryIds: filters.repositories
    });
  }, [
    activityMode,
    dateRange,
    filters.repositories,
    filters.contributors,
    filters.organizations,
    savePreferences,
    initialLoad
  ]);

  // Filter repositories based on selected IDs and advanced options
  const filteredRepositories = useMemo(() => {
    let filtered = repositories;

    // Apply repository selection filter if any are selected
    if (selectedRepoIds.length > 0) {
      filtered = filtered.filter(repo =>
        selectedRepoIds.includes(repo.id.toString())
      );
    }

    return filtered;
  }, [repositories, selectedRepoIds]);

  // Initialize preferences and repositories on mount
  useEffect(() => {
    const initDashboard = async () => {
      if (status === 'loading') return;

      if (status === 'unauthenticated') {
        router.push('/');
        return;
      }

      try {
        // Load saved preferences
        const prefs = loadPreferences();
        if (prefs) {
          if (prefs.activityMode) setActivityMode(prefs.activityMode);
          if (prefs.dateRange) setDateRange(prefs.dateRange);
          if (prefs.selectedRepositoryIds) setFilterRepositories(prefs.selectedRepositoryIds);
        }

        // Fetch repositories
        await fetchRepositories();

        setInitialLoad(false);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        setInitialLoad(false);
      }
    };

    initDashboard();
  }, [
    status,
    router,
    fetchRepositories,
    loadPreferences,
    setActivityMode,
    setDateRange,
    setFilterRepositories,
    setContributors,
    setOrganizations
  ]);

  // Auto-select repositories based on activity mode
  useEffect(() => {
    if (activityMode === 'my-activity' && repositories.length > 0) {
      // In "my" mode, we analyze all repositories by default
      setSelectedRepoIds([]);
    }
  }, [activityMode, repositories]);

  // Create progress message based on summary progress
  const progressMessage = useMemo(() => {
    if (!summaryProgress) return '';

    const { completedRepositories, totalRepositories } = summaryProgress;
    if (completedRepositories > 0 && totalRepositories > 0) {
      return `Analyzing repository ${completedRepositories} of ${totalRepositories}...`;
    }

    return 'Preparing analysis...';
  }, [summaryProgress]);

  // Pre-compute selected repository IDs for toolbar
  const selectedRepositoryIds = useMemo(() => {
    return selectedRepoIds.length > 0
      ? selectedRepoIds
      : repositories.map(r => r.id.toString());
  }, [selectedRepoIds, repositories]);

  // Function to handle date range changes
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
    savePreferences({
      activityMode,
      dateRange: newDateRange,
      selectedRepositoryIds: filters.repositories
    });
  }, [
    activityMode,
    filters.repositories,
    filters.contributors,
    filters.organizations,
    savePreferences
  ]);

  // Function to handle organization filter changes
  const handleOrganizationChange = useCallback((selectedOrgs: string[]) => {
    setOrganizations(selectedOrgs);
  }, [setOrganizations]);

  // Function to handle summary generation
  const handleGenerateSummary = useCallback(async () => {
    // Show skeleton loader immediately (optimistic UI)
    setShowSkeleton(true);

    // Save last generation params for quick re-run
    const params = {
      activityMode,
      dateRange,
      selectedRepositoryIds: filters.repositories,
      contributors: filters.contributors,
      organizations: filters.organizations,
      installationIds: installationIds as number[]
    };
    saveLastGeneration(params);
    setLastGeneration({ ...params, timestamp: Date.now() });

    try {
      await generateSummary();
    } finally {
      // Hide skeleton loader once generation is complete (success or failure)
      setShowSkeleton(false);
    }
  }, [
    activityMode,
    dateRange,
    filters.repositories,
    filters.contributors,
    filters.organizations,
    installationIds,
    generateSummary,
    saveLastGeneration
  ]);

  // Function to regenerate with last parameters
  const handleRegenerateLast = useCallback(async () => {
    if (!lastGeneration) return;

    // Apply last generation parameters
    setActivityMode(lastGeneration.activityMode);
    setDateRange(lastGeneration.dateRange);
    setFilterRepositories(lastGeneration.selectedRepositoryIds);
    setContributors(lastGeneration.contributors);
    setOrganizations(lastGeneration.organizations);

    // Wait for state updates to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate summary with optimistic UI
    setShowSkeleton(true);
    try {
      await generateSummary();
    } finally {
      setShowSkeleton(false);
    }
  }, [
    lastGeneration,
    setActivityMode,
    setDateRange,
    setFilterRepositories,
    setContributors,
    setOrganizations,
    generateSummary
  ]);

  // Show loading state during initial session loading or first data fetch
  if (status === 'loading' || initialLoad) {
    return <DashboardLoadingState />;
  }

  return (
    <>
      {/* Fixed header components */}
      <Header
        userName={session?.user?.name}
        userImage={session?.user?.image}
        signOutCallbackUrl="/"
      />

      <NavBar
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        loading={loading}
        repositories={filteredRepositories}
        onGenerate={handleGenerateSummary}
        lastGeneration={lastGeneration ? {
          timestamp: lastGeneration.timestamp,
          repoCount: lastGeneration.selectedRepositoryIds.length
        } : null}
        onRegenerateLast={handleRegenerateLast}
      />

      {/* Main grid layout: left sidebar (300px) | right content (1fr) */}
      <main>
        {/* Left column: Repository filters */}
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

        {/* Right column: Main content area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
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

          <AnalysisParameters
            activityMode={activityMode}
            dateRange={dateRange}
            organizations={filters.organizations}
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
    </>
  );
}