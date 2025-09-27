import React from 'react';
import { Repository, ActivityMode } from '@/types/dashboard';

export interface FixedActionBarProps {
  /**
   * List of repositories being analyzed
   */
  repositories: readonly Repository[];

  /**
   * Whether the summary is being generated
   */
  loading: boolean;

  /**
   * Activity mode for context
   */
  activityMode: ActivityMode;

  /**
   * Current user's name for display
   */
  userName?: string | null;

  /**
   * List of selected contributors for team mode
   */
  contributors?: readonly string[];

  /**
   * Callback to generate the summary
   */
  onGenerateSummary: () => void;

  /**
   * Optional progress message to display while loading
   */
  progressMessage?: string;
}

/**
 * Fixed action bar that stays at the top of the viewport
 * Provides quick access to the Generate Summary action
 */
export default function FixedActionBar({
  repositories,
  loading,
  activityMode,
  userName,
  contributors = [],
  onGenerateSummary,
  progressMessage
}: FixedActionBarProps) {
  // Determine the button text based on activity mode and repository count
  const getButtonText = () => {
    if (loading) {
      return progressMessage || 'Analyzing...';
    }

    const repoCount = repositories.length;

    // No repositories selected
    if (repoCount === 0) {
      return 'Select repositories to generate';
    }

    switch (activityMode) {
      case 'my-activity': {
        // For individual activity, show the username if available
        const displayName = userName || 'your activity';
        return `Generate summary for ${displayName} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      }
      case 'team-activity': {
        // For team activity, show the number of team members
        const memberCount = contributors.length;
        if (memberCount === 0) {
          return `Generate team summary (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
        }
        return `Generate summary for ${memberCount} ${memberCount === 1 ? 'member' : 'members'} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      }
      case 'my-work-activity': {
        // For work activity across orgs
        const orgCount = new Set(repositories.map(r => r.full_name.split('/')[0])).size;
        const displayName = userName || 'your work';
        return `Generate ${displayName} across ${orgCount} ${orgCount === 1 ? 'org' : 'orgs'} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      }
      default:
        return `Generate summary (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
    }
  };

  return (
    <div className="fixed top-2 right-2 z-50">
      <button
        type="button"
        onClick={onGenerateSummary}
        disabled={loading || repositories.length === 0}
        title={loading
          ? getButtonText()
          : repositories.length === 0
            ? "No repositories available for analysis"
            : "Analyze your GitHub commits and generate activity summary with AI insights"}
        className={`px-3 py-1.5 rounded text-sm font-medium flex items-center transition-all shadow-lg ${
          loading
            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : repositories.length === 0
            ? 'bg-gray-400 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed opacity-75'
            : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl transform hover:scale-105'
        }`}
      >
        {loading ? (
          <>
            <span className="mr-2 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {getButtonText()}
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
            </svg>
            {getButtonText()}
          </>
        )}
      </button>
    </div>
  );
}
