import React from 'react';
import { CommitSummary } from '@/types/dashboard';

export interface SummaryStatsProps {
  /**
   * The commit summary data to display statistics for
   */
  summary: CommitSummary;
  
  /**
   * Additional CSS class to apply to the container
   */
  className?: string;
}

/**
 * Displays a dashboard of commit activity statistics
 */
const SummaryStats: React.FC<SummaryStatsProps> = ({ 
  summary,
  className = ''
}) => {
  return (
    <section>
      <h3>
        METRICS OVERVIEW
      </h3>
      <div>
        <div>
          <div></div>
          <p>COMMIT COUNT</p>
          <p>
            {summary?.stats?.totalCommits || 0}
          </p>
        </div>
        <div>
          <div></div>
          <p>REPOSITORIES</p>
          <p>
            {summary?.stats?.repositories?.length || 0}
          </p>
        </div>
        <div>
          <div></div>
          <p>ACTIVE DAYS</p>
          <p>
            {summary?.stats?.dates?.length || 0}
          </p>
        </div>
      </div>
    </section>
  );
};

export default SummaryStats;