'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getDefaultDateRange } from '@/lib/dashboard-utils';
import { DateRange } from '@/types/dashboard';
import { useURLState } from '@/hooks/useURLState';

// Custom hooks
import { useRepositories } from '@/hooks/dashboard/useRepositories';
import { useInstallations } from '@/hooks/dashboard/useInstallations';
import { useFilters } from '@/hooks/dashboard/useFilters';
import { useSummary } from '@/hooks/dashboard/useSummary';

// Components
import Header from '@/components/dashboard/Header';
import DashboardLoadingState from '@/components/DashboardLoadingState';
import OperationsPanel from '@/components/dashboard/OperationsPanel';
import RepositorySection from '@/components/dashboard/RepositorySection';
import AnalysisParameters from '@/components/dashboard/AnalysisParameters';
import SummaryView from '@/components/dashboard/SummaryView';
import NavBar from '@/components/dashboard/NavBar';

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // URL state management - single source of truth
  const {
    activityMode,
    dateRange,
    selectedRepos,
    selectedOrgs,
    setActivityMode: setActivityModeURL,
    setDateRange: setDateRangeURL,
    setSelectedRepos,
    setSelectedOrgs
  } = useURLState();

  // State for initial loading
  const [initialLoad, setInitialLoad] = useState(true);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(selectedRepos);


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
    setContributors,
    setOrganizations,
    setRepositories: setFilterRepositories,
    setActivityMode
  } = useFilters({
    initialFilters: {
      contributors: ['me'],
      organizations: selectedOrgs,
      repositories: selectedRepos
    },
    initialMode: activityMode
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

  // Sync URL state with component state
  useEffect(() => {
    setSelectedRepoIds(selectedRepos);
  }, [selectedRepos]);

  useEffect(() => {
    setOrganizations(selectedOrgs);
  }, [selectedOrgs, setOrganizations]);

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
        // URL state is now the source of truth - no need to load from localStorage
        // State is already initialized from URL params

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
    setActivityMode,
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

  // Function to handle date range changes - updates URL
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRangeURL(newDateRange);
  }, [setDateRangeURL]);

  // Function to handle organization filter changes - updates URL
  const handleOrganizationChange = useCallback((orgs: string[]) => {
    setSelectedOrgs(orgs);
    setOrganizations(orgs);
  }, [setSelectedOrgs, setOrganizations]);

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
    // URL state is now the source of truth for all parameters

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
      />

      {/* Main grid layout: left sidebar (300px) | right content (1fr) */}
      <main>
        {/* Left column: Repository filters */}
        <RepositorySection
          repositories={filteredRepositories}
          loading={loading}
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
            <div className="loading">
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--muted)' }}>Generating Summary</h2>
                <p style={{ color: 'var(--muted)' }}>Processing commits and generating insights...</p>
              </div>
            </div>
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

// Wrap in Suspense for Next.js client components with useSearchParams
export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoadingState />}>
      <DashboardContent />
    </Suspense>
  );
}