import React from 'react';
import ActivityFeed from '@/components/ActivityFeed';
import SummaryStats from '@/components/dashboard/SummaryStats';
import SummaryDetails from '@/components/dashboard/SummaryDetails';
import { createActivityFetcher } from '@/lib/activity';
import { CommitSummary } from '@/types/dashboard';
import { useURLState } from '@/hooks/useURLState';

export interface SummaryViewProps {
  /**
   * The commit summary data to display
   */
  summary: CommitSummary | null;

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
 * Reads activity mode, date range, and filters directly from URL
 */
const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  installationIds,
  loading = false
}) => {
  // Read state directly from URL instead of props
  const { activityMode, dateRange, selectedRepos, selectedOrgs } = useURLState();
  const activeFilters = {
    repositories: selectedRepos,
    organizations: selectedOrgs,
    contributors: activityMode === 'my-activity' ? ['me'] : []
  };
  if (!summary) return null;

  return (
    <article>
      {/* Terminal-like header */}
      <div>
        <div>
          <div></div>
          <h2>
            COMMIT ANALYSIS: {summary.user?.toUpperCase()}
          </h2>
        </div>
        <div>
          <span></span>
          <span>ANALYSIS COMPLETE</span>
        </div>
      </div>

      {/* Activity Feed with Progressive Loading */}
      {summary.commits && (
        <div>
          <div>
            <div></div>
            <h3>
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
      <SummaryStats summary={summary} />

      {summary.aiSummary && (
        <SummaryDetails aiSummary={summary.aiSummary} />
      )}
    </article>
  );
};

export default SummaryView;