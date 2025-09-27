import React from 'react';
import ActivityFeed from '@/components/ActivityFeed';
import SummaryStats from '@/components/dashboard/SummaryStats';
import SummaryDetails from '@/components/dashboard/SummaryDetails';
import { createActivityFetcher } from '@/lib/activity';
import { ActivityMode, CommitSummary, DateRange, FilterState } from '@/types/dashboard';

export interface SummaryViewProps {
  /**
   * The commit summary data to display
   */
  summary: CommitSummary | null;
  
  /**
   * The current activity mode
   */
  activityMode: ActivityMode;
  
  /**
   * The selected date range
   */
  dateRange: DateRange;
  
  /**
   * Active filters applied to the data
   */
  activeFilters: FilterState;
  
  /**
   * Installation IDs for GitHub App
   */
  installationIds: readonly number[];
  
  /**
   * Whether the component is in a loading state
   */
  loading?: boolean;
}

/**
 * Displays a comprehensive summary view of GitHub activity
 */
const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  activityMode,
  dateRange,
  activeFilters,
  installationIds,
  loading = false
}) => {
  if (!summary) return null;

  return (
    <div className="mt-8 border rounded-lg p-2" style={{ 
      backgroundColor: 'rgba(27, 43, 52, 0.7)',
      backdropFilter: 'blur(5px)',
      borderColor: 'var(--electric-blue)',
      boxShadow: '0 0 20px rgba(59, 142, 234, 0.15)'
    }}>
      {/* Terminal-like header */}
      <div className="flex items-center justify-between mb-6 border-b pb-3" style={{ borderColor: 'var(--electric-blue)' }}>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--electric-blue)' }}>
            COMMIT ANALYSIS: {summary.user?.toUpperCase()}
          </h2>
        </div>
        <div className="px-2 py-1 text-xs rounded flex items-center" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.3)', 
          border: '1px solid var(--neon-green)',
          color: 'var(--neon-green)'
        }}>
          <span className="inline-block w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: 'var(--neon-green)' }}></span>
          <span>ANALYSIS COMPLETE</span>
        </div>
      </div>

      {/* Activity Feed with Progressive Loading */}
      {summary.commits && (
        <div className="mb-8">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
            <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
              COMMIT ACTIVITY
            </h3>
          </div>
          
          <ActivityFeed
            loadCommits={async (cursor, limit) => {
              // Build appropriate parameters based on current mode
              const params: Record<string, string> = {
                since: dateRange.since,
                until: dateRange.until
              };
              
              // Add organization filter if applicable
              if (activeFilters.organizations.length > 0) {
                params.organizations = activeFilters.organizations.join(',');
              }
              
              // If installation IDs available, include them
              if (installationIds.length > 0) {
                params.installation_ids = installationIds.join(',');
              }
              
              // Determine which API endpoint to use based on the current mode
              let apiEndpoint = '/api/my-activity';
              
              if (activityMode === 'my-work-activity') {
                apiEndpoint = '/api/my-org-activity';
              } else if (activityMode === 'team-activity') {
                apiEndpoint = '/api/team-activity';
              }
              
              // Create the fetcher and use it directly - errors will propagate to useProgressiveLoading
              // which has robust error handling already implemented
              const fetcher = createActivityFetcher(apiEndpoint, params);
              return fetcher(cursor, limit);
            }}
            useInfiniteScroll={true}
            initialLimit={30}
            additionalItemsPerPage={20}
            showRepository={true}
            showContributor={activityMode === 'team-activity'}
            emptyMessage={`No ${activityMode.replace('-', ' ')} data found for the selected filters.`}
          />
        </div>
      )}

      {/* Stats dashboard with cyber styling */}
      <SummaryStats summary={summary} className="mb-8" />

      {summary.aiSummary && (
        <SummaryDetails aiSummary={summary.aiSummary} />
      )}
    </div>
  );
};

export default SummaryView;