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
        return 'MY ACTIVITY';
      case 'my-work-activity':
        return 'MY WORK ACTIVITY';
      case 'team-activity':
        return 'TEAM ACTIVITY';
      default:
        // This should never happen with the current ActivityMode type
        return 'UNKNOWN MODE';
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      {/* Header */}
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        Analysis Parameters
      </h3>
      
      {/* Parameters list */}
      <div className="space-y-2 text-sm">
        {/* Activity mode */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Mode</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">
            {getActivityModeDisplay(activityMode)}
          </span>
        </div>

        {/* Date range */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Date Range</span>
          <span className="text-gray-900 dark:text-gray-100">
            {dateRange.since} to {dateRange.until}
          </span>
        </div>

        {/* Organizations (if any) */}
        {organizations.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Organizations</span>
            <span className="text-gray-900 dark:text-gray-100">
              {organizations.length} selected
            </span>
          </div>
        )}

        {/* Help text */}
        {showHelpText && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Configure parameters above, then click Generate to analyze commits.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}