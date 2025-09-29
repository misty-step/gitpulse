'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
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

  // Filter repositories based on selected IDs from URL
  const filteredRepositories = useMemo(() => {
    if (selectedRepos.length === 0) return repositories;
    return repositories.filter(repo => selectedRepos.includes(repo.id.toString()));
  }, [repositories, selectedRepos]);

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


  // Function to handle date range changes - updates URL
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRangeURL(newDateRange);
  }, [setDateRangeURL]);

  // Function to handle organization filter changes - updates URL only
  const handleOrganizationChange = useCallback((orgs: string[]) => {
    setSelectedOrgs(orgs);
  }, [setSelectedOrgs]);

  // Function to handle summary generation
  const handleGenerateSummary = useCallback(async () => {
    const repoIds = selectedRepos.length > 0
      ? selectedRepos
      : repositories.map(r => r.full_name);

    await generateSummaryAPI({
        activityMode,
        dateRange,
        selectedRepositoryIds: repoIds,
        contributors: activityMode === 'my-activity' ? ['me'] : [],
        organizations: selectedOrgs,
        installationIds: installations.map(i => i.id)
      });
  }, [
    activityMode,
    dateRange,
    selectedRepos,
    selectedOrgs,
    repositories,
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
              contributors: activityMode === 'my-activity' ? ['me'] : [],
              organizations: selectedOrgs,
              repositories: selectedRepos
            }}
            userName={session?.user?.name}
            onOrganizationChange={handleOrganizationChange}
            onSwitchInstallations={(ids) => fetchRepositories(ids[0])}
            onSignOut={signOut}
          />

          <AnalysisParameters />


          {/* Show summary if available, loading state is handled by components */}
          {summary && (
              <SummaryView
                summary={summary}
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