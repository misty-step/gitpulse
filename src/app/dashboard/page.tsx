'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getDefaultDateRange } from '@/lib/dashboard-utils';
import { FilterState, DateRange } from '@/types/dashboard';

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
import DateRangePicker from '@/components/DateRangePicker';
import AnalysisParameters from '@/components/dashboard/AnalysisParameters';
import SummaryView from '@/components/dashboard/SummaryView';
import FixedActionBar from '@/components/dashboard/FixedActionBar';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State for initial loading and date range
  const [initialLoad, setInitialLoad] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  
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
    setAllFilters,
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
    currentInstallations: summaryInstallations
  } = useSummary({
    dateRange,
    activityMode,
    organizations: filters.organizations,
    repositories: filters.repositories,
    contributors: filters.contributors,
    installationIds: installationIds as readonly number[]
  });
  
  // Determine the active error message to display (prioritize repository errors)
  const activeError = repoError || summaryError;
  const needsInstallation = repoNeedsInstallation || installNeedsInstallation;
  const loading = repoLoading || summaryLoading;
  
  // Handle date range changes
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
  }, []);
  
  // Handle organization selection changes
  const handleOrganizationChange = useCallback((selectedOrgs: string[]) => {
    setOrganizations(selectedOrgs);
  }, [setOrganizations]);
  
  // Handle filter changes (legacy support)
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setAllFilters(newFilters);
  }, [setAllFilters]);
  
  // Fetch repositories when session is available and check for installation cookie
  useEffect(() => {
    if (session) {
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
      
      // No installation cookie found, proceed with normal fetch
      fetchRepositories().then(success => {
        if (success) {
          localStorage.setItem('lastRepositoryRefresh', Date.now().toString());
        }
      });
    }
  }, [session, fetchRepositories]);
  
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
  
  // Show loading state during initial session loading or first data fetch
  if (status === 'loading' || initialLoad) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed Action Bar */}
      <FixedActionBar
        repositories={repositories}
        loading={loading}
        activityMode={activityMode}
        onGenerateSummary={generateSummary}
      />

      {/* Header Component */}
      <Header
        userName={session?.user?.name}
        userImage={session?.user?.image}
        signOutCallbackUrl="/"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
            onModeChange={setActivityMode}
            onOrganizationChange={handleOrganizationChange}
            onFilterChange={handleFilterChange}
            onSwitchInstallations={switchInstallations}
            onSignOut={signOut}
          />
          
          {/* Simplified Filters Container */}
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Analysis Filters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column will be handled by OperationsPanel */}

              {/* Right column - Date and Analysis Info */}
              <div className="space-y-4">
                <DateRangePicker
                  dateRange={dateRange}
                  onChange={handleDateRangeChange}
                  disabled={loading}
                />

                <AnalysisParameters
                  activityMode={activityMode}
                  dateRange={dateRange}
                  organizations={filters.organizations}
                />
              </div>
            </div>
          </div>

          {/* Repository Section Component */}
          <RepositorySection
            repositories={repositories}
            loading={loading}
            activeFilters={{
              contributors: [...filters.contributors],
              organizations: [...filters.organizations],
              repositories: [...filters.repositories]
            }}
            isWithinForm={false}
          />

          {/* Summary View Component (conditionally shown) */}
          {summary && (
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
          )}
        </div>
      </main>
    </div>
  );
}