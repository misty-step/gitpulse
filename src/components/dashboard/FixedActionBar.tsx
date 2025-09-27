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
   * Callback to generate the summary
   */
  onGenerateSummary: () => void;
}

/**
 * Fixed action bar that stays at the top of the viewport
 * Provides quick access to the Generate Summary action
 */
export default function FixedActionBar({
  repositories,
  loading,
  activityMode,
  onGenerateSummary
}: FixedActionBarProps) {
  // Determine the button text based on activity mode and repository count
  const getButtonText = () => {
    if (loading) return 'Analyzing...';

    const repoCount = repositories.length;

    switch (activityMode) {
      case 'my-activity':
        return `Generate (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      case 'team-activity':
        return `Generate team summary (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      case 'my-work-activity':
        const orgCount = new Set(repositories.map(r => r.full_name.split('/')[0])).size;
        return `Generate for ${orgCount} ${orgCount === 1 ? 'org' : 'orgs'} (${repoCount} repos)`;
      default:
        return `Generate (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
    }
  };

  return (
    <div className="fixed top-2 right-2 z-50">
      <button
        type="button"
        onClick={onGenerateSummary}
        disabled={loading || repositories.length === 0}
        title={repositories.length === 0
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