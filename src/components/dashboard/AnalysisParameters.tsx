'use client';

import { ActivityMode } from '@/types/dashboard';
import { useURLState } from '@/hooks/useURLState';

/**
 * Displays the current analysis parameters by reading directly from URL
 * No props needed - everything comes from the URL state
 */
export default function AnalysisParameters() {
  // Read state directly from URL
  const { activityMode, dateRange, selectedOrgs } = useURLState();
  const organizations = selectedOrgs;
  const showHelpText = true;
  // Map activity mode to display text
  const getActivityModeDisplay = (mode: ActivityMode): string => {
    switch (mode) {
      case 'my-activity':
        return 'My Activity';
      case 'my-work-activity':
        return 'My Work';
      case 'team-activity':
        return 'Team';
      default:
        // This should never happen with the current ActivityMode type
        return 'Unknown';
    }
  };

  return (
    <section>
      {/* Header */}
      <h3>
        Analysis Parameters
      </h3>
      
      {/* Parameters list */}
      <div>
        {/* Activity mode */}
        <div>
          <span>Mode</span>
          <span>
            {getActivityModeDisplay(activityMode)}
          </span>
        </div>

        {/* Date range */}
        <div>
          <span>Date Range</span>
          <span>
            {dateRange.since} to {dateRange.until}
          </span>
        </div>

        {/* Organizations (if any) */}
        {organizations.length > 0 && (
          <div>
            <span>Organizations</span>
            <span>
              {organizations.length} selected
            </span>
          </div>
        )}

        {/* Help text */}
        {showHelpText && (
          <div>
            <div>
              Configure parameters above, then click Generate to analyze commits.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}