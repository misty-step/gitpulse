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
    <aside>
      {/* Hidden on mobile, shown on tablet and up */}
      <div>
        <div>
          <div>
            <label>
              Target Repositories
            </label>
            <button
              type="button"
              onClick={() => setShowRepoList(!showRepoList)}>
              {showRepoList ? 'Hide' : 'Show'} List
            </button>
          </div>
          <div>
            {repositories.length} repositories
          </div>
        </div>
      </div>

      {/* Mobile version - simple count display */}
      <div>
        <div>
          Analyzing all {repositories.length} accessible repositories
        </div>
      </div>
      
      {/* Repository info container */}
      <div>
        {loading && repositories.length === 0 ? (
          <div>
            <span></span>
            <span>Scanning repositories...</span>
          </div>
        ) : (
          <div>
            <div>
              <div>
                Analyzing all accessible repositories
              </div>
              
              {/* Display filter information if applied */}
              {(activeFilters.contributors.length > 0 ||
                activeFilters.organizations.length > 0 ||
                activeFilters.repositories.length > 0) && (
                <div>
                  <div>
                    Active Filters
                  </div>
                  <div>
                    {activeFilters.contributors.length > 0 && (
                      <span>
                        Contributors: {activeFilters.contributors.includes('me') ? 'Only Me' : activeFilters.contributors.join(', ')}
                      </span>
                    )}
                    {activeFilters.organizations.length > 0 && (
                      <span>
                        Orgs: {activeFilters.organizations.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Repository stats summary */}
              {repositories.length > 0 && (
                <div>
                  <div>
                    <div>Repos</div>
                    <div>{repositories.length}</div>
                  </div>
                  <div>
                    <div>Orgs</div>
                    <div>{new Set(repositories.map(repo => repo.full_name.split('/')[0])).size}</div>
                  </div>
                  <div>
                    <div>Private</div>
                    <div>{repositories.filter(repo => repo.private).length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Repository list with organization grouping - Hidden on mobile */}
            {showRepoList && (
              <div>
                {repositories.length > 0 ? (
                  groupRepositoriesByOrg().map(([org, repos]) => (
                    <div key={org>
                      <div>
                        <span>{org}</span>
                        <span>
                          {repos.length}
                        </span>
                      </div>

                      <ul>
                        {repos.map((repo) => (
                          <li key={repo.id}>
                            <div>
                            </div>
                            <div>
                              {repo.private && (
                                <span>
                                  PRIVATE
                                </span>
                              )}
                              {repo.language && (
                                <span>
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
                  <div>
                    NO REPOSITORIES DETECTED
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      
      {isWithinForm && (
        <div>
          <button
            type={onSubmit ? "button" : "submit"}
            onClick={onSubmit}
            disabled={loading}
            title="Analyze your GitHub commits and generate activity summary with AI insights"
          >
            {loading ? (
              <>
                <span></span>
                Analyzing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                </svg>
                Generate Summary
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
  
  return renderRepositorySection();
}