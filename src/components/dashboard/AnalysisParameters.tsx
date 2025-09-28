'use client';

import { ActivityMode, DateRange } from '@/types/dashboard';

export interface AnalysisParametersProps {
  /**
   * The currently selected activity mode
   */
  activityMode: ActivityMode;

  /**
   * The currently selected date range
   */
  dateRange: DateRange;

  /**
   * The organizations currently selected in filters
   */
  organizations?: readonly string[];

  /**
   * Whether to show the help text at the bottom of the component
   */
  showHelpText?: boolean;
}

/**
 * Displays the current analysis parameters in a styled card
 */
export default function AnalysisParameters({
  activityMode,
  dateRange,
  organizations = [],
  showHelpText = true
}: AnalysisParametersProps) {
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