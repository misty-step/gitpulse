import React, { useState } from 'react';
import { Repository, FilterState } from '@/types/dashboard';

export interface RepositorySectionProps {
  /**
   * List of repositories to display
   */
  repositories: readonly Repository[];
  
  /**
   * Whether repositories are being loaded
   */
  loading: boolean;
  
  /**
   * Active filters to display
   */
  activeFilters: FilterState;
  
  /**
   * Initial visibility state of the repository list
   */
  initialShowRepoList?: boolean;
  
  /**
   * Whether the component is within a form element
   * Controls whether the section has a submit button
   */
  isWithinForm?: boolean;
  
  /**
   * Optional callback for submit action
   * Only used when isWithinForm is true
   */
  onSubmit?: () => void;
}

/**
 * Repository Section component displaying repository information and list
 */
export default function RepositorySection({
  repositories,
  loading,
  activeFilters,
  initialShowRepoList = true,
  isWithinForm = true,
  onSubmit
}: RepositorySectionProps) {
  const [showRepoList, setShowRepoList] = useState(initialShowRepoList);
  
  /**
   * Group repositories by organization
   */
  const groupRepositoriesByOrg = (): [string, Repository[]][] => {
    const reposByOrg: Record<string, Repository[]> = {};
    
    repositories.forEach(repo => {
      const orgName = repo.full_name.split('/')[0];
      if (!reposByOrg[orgName]) {
        reposByOrg[orgName] = [];
      }
      reposByOrg[orgName].push(repo);
    });
    
    // Sort organizations by repo count (descending)
    return Object.entries(reposByOrg)
      .sort(([, reposA], [, reposB]) => reposB.length - reposA.length);
  };
  
  const renderRepositorySection = () => (
    <div className="mt-4">
      {/* Hidden on mobile, shown on tablet and up */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Target Repositories
            </label>
            <button
              type="button"
              onClick={() => setShowRepoList(!showRepoList)}
              className="ml-2 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {showRepoList ? 'Hide' : 'Show'} List
            </button>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {repositories.length} repositories
          </div>
        </div>
      </div>

      {/* Mobile version - simple count display */}
      <div className="sm:hidden mb-3">
        <div className="text-center text-sm text-gray-700 dark:text-gray-300">
          Analyzing all {repositories.length} accessible repositories
        </div>
      </div>
      
      {/* Repository info container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5">
        {loading && repositories.length === 0 ? (
          <div className="flex items-center justify-center p-3 text-gray-600 dark:text-gray-400">
            <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></span>
            <span>Scanning repositories...</span>
          </div>
        ) : (
          <div>
            <div className="pb-3 mb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-center text-sm text-gray-700 dark:text-gray-300 mb-2">
                Analyzing all accessible repositories
              </div>
              
              {/* Display filter information if applied */}
              {(activeFilters.contributors.length > 0 ||
                activeFilters.organizations.length > 0 ||
                activeFilters.repositories.length > 0) && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Active Filters
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.contributors.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                        Contributors: {activeFilters.contributors.includes('me') ? 'Only Me' : activeFilters.contributors.join(', ')}
                      </span>
                    )}
                    {activeFilters.organizations.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                        Orgs: {activeFilters.organizations.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Repository stats summary */}
              {repositories.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Repos</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{repositories.length}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Orgs</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{new Set(repositories.map(repo => repo.full_name.split('/')[0])).size}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Private</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{repositories.filter(repo => repo.private).length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Repository list with organization grouping - Hidden on mobile */}
            {showRepoList && (
              <div className="hidden sm:block max-h-96 overflow-y-auto text-sm">
                {repositories.length > 0 ? (
                  groupRepositoriesByOrg().map(([org, repos]) => (
                    <div key={org} className="mb-3">
                      <div className="flex items-center px-2 py-1 mb-1 bg-gray-100 dark:bg-gray-700 rounded">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{org}</span>
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                          {repos.length}
                        </span>
                      </div>

                      <ul className="pl-3 space-y-1">
                        {repos.map((repo) => (
                          <li key={repo.id} className="text-xs flex items-center justify-between text-gray-700 dark:text-gray-300">
                            <div className="flex items-center">
                              <span className={`inline-block w-2 h-2 mr-2 rounded-full ${repo.private ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                              <span>{repo.name}</span>
                            </div>
                            <div className="flex items-center">
                              {repo.private && (
                                <span className="ml-2 text-xs px-1 rounded" style={{ 
                                  color: 'var(--crimson-red)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)'
                                }}>
                                  PRIVATE
                                </span>
                              )}
                              {repo.language && (
                                <span className="ml-2 text-xs px-1 rounded" style={{ 
                                  color: 'var(--luminous-yellow)',
                                  backgroundColor: 'rgba(245, 158, 11, 0.1)'
                                }}>
                                  {repo.language}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : repositories.length === 0 && !loading ? (
                  <div className="p-3 text-center" style={{ color: 'var(--crimson-red)' }}>
                    NO REPOSITORIES DETECTED
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      
      {isWithinForm && (
        <div className="flex justify-end pt-4">
          <button
            type={onSubmit ? "button" : "submit"}
            onClick={onSubmit}
            disabled={loading}
            title="Analyze your GitHub commits and generate activity summary with AI insights"
            className={`px-4 py-2 rounded text-sm font-medium flex items-center transition-colors ${
              loading
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? (
              <>
                <span className="mr-2 inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                Analyzing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                </svg>
                Generate Summary
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
  
  return renderRepositorySection();
}