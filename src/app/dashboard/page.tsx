'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getDefaultDateRange } from '@/lib/dashboard-utils';
import { ActivityMode, DateRange } from '@/types/dashboard';
import { useURLState } from '@/hooks/useURLState';
import { useGitHubData } from '@/hooks/useGitHubData';

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

  // GitHub data hook - consolidated data fetching
  const {
    repositories,
    installations,
    summary,
    loading,
    error,
    needsInstallation,
    fetchRepositories,
    generateSummary: generateSummaryAPI
  } = useGitHubData();

  // Filter state - simple React state instead of custom hook
  const [contributors, setContributors] = useState<string[]>(['me']);
  const [organizations, setOrganizations] = useState<string[]>(selectedOrgs);
  const [filterRepositories, setFilterRepositories] = useState<string[]>(selectedRepos);
  const [localActivityMode, setLocalActivityMode] = useState<ActivityMode>(activityMode);


  // Sync URL state with component state
  useEffect(() => {
    setSelectedRepoIds(selectedRepos);
  }, [selectedRepos]);

  useEffect(() => {
    setOrganizations(selectedOrgs);
  }, [selectedOrgs, setOrganizations]);

  // Filter repositories based on selected IDs
  const filteredRepositories = useMemo(() => {
    if (filterRepositories.length === 0) return repositories;
    return repositories.filter(repo => filterRepositories.includes(repo.id.toString()));
  }, [repositories, filterRepositories]);

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
    fetchRepositories
  ]);

  // Auto-select repositories based on activity mode
  useEffect(() => {
    if (activityMode === 'my-activity' && repositories.length > 0) {
      // In "my" mode, we analyze all repositories by default
      setSelectedRepoIds([]);
    }
  }, [activityMode, repositories]);

  // Simple progress message when loading
  const progressMessage = useMemo(() => {
    if (loading && summary === null) {
      return 'Generating summary...';
    }
    return '';
  }, [loading, summary]);

  // Compute selected repository IDs
  const selectedRepositoryIds = useMemo(() => {
    return filterRepositories.length > 0
      ? filterRepositories
      : repositories.map(r => r.id.toString());
  }, [filterRepositories, repositories]);

  // Function to handle date range changes - updates URL
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRangeURL(newDateRange);
  }, [setDateRangeURL]);

  // Function to handle organization filter changes - updates URL
  const handleOrganizationChange = useCallback((orgs: string[]) => {
    setSelectedOrgs(orgs);
    setOrganizations(orgs);
  }, [setSelectedOrgs]);

  // Function to handle summary generation
  const handleGenerateSummary = useCallback(async () => {
    // Show skeleton loader immediately (optimistic UI)
    setShowSkeleton(true);

    try {
      await generateSummaryAPI({
        activityMode,
        dateRange,
        selectedRepositoryIds: filterRepositories,
        contributors,
        organizations,
        installationIds: installations.map(i => i.id)
      });
    } finally {
      // Hide skeleton loader once generation is complete (success or failure)
      setShowSkeleton(false);
    }
  }, [
    activityMode,
    dateRange,
    filterRepositories,
    contributors,
    organizations,
    installations,
    generateSummaryAPI
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
            error={error}
            loading={loading}
            needsInstallation={needsInstallation}
            authMethod="github-app"
            installations={installations}
            currentInstallations={installations}
            activityMode={activityMode}
            activeFilters={{
              contributors,
              organizations,
              repositories: filterRepositories
            }}
            userName={session?.user?.name}
            onOrganizationChange={handleOrganizationChange}
            onSwitchInstallations={(ids) => fetchRepositories(ids[0])}
            onSignOut={signOut}
          />

          <AnalysisParameters
            activityMode={activityMode}
            dateRange={dateRange}
            organizations={organizations}
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
                  contributors,
                  organizations,
                  repositories: filterRepositories
                }}
                installationIds={installations.map(i => i.id)}
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