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

  // State management
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(selectedRepos);

  // GitHub data hook - consolidated data fetching
  const {
    repositories,
    installations,
    summary,
    isGenerating,
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
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
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

  // Simple progress message when generating
  const progressMessage = useMemo(() => {
    if (isGenerating) {
      return 'Generating...';
    }
    return '';
  }, [isGenerating]);

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
    await generateSummaryAPI({
        activityMode,
        dateRange,
        selectedRepositoryIds: filterRepositories,
        contributors,
        organizations,
        installationIds: installations.map(i => i.id)
      });
  }, [
    activityMode,
    dateRange,
    filterRepositories,
    contributors,
    organizations,
    installations,
    generateSummaryAPI
  ]);


  // Show loading state during session loading
  if (status === 'loading') {
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
        loading={isGenerating}
        repositories={filteredRepositories}
        onGenerate={handleGenerateSummary}
      />

      {/* Main grid layout: left sidebar (300px) | right content (1fr) */}
      <main>
        {/* Left column: Repository filters */}
        <RepositorySection
          repositories={filteredRepositories}
          loading={isGenerating}
        />

        {/* Right column: Main content area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
          <OperationsPanel
            error={error}
            loading={isGenerating}
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


          {/* Show summary if available, loading state is handled by components */}
          {summary && (
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
                loading={isGenerating}
              />
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