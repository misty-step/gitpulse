import React, { useState, useMemo } from 'react';
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
  const [repoFilter, setRepoFilter] = useState<'all' | 'active'>('all');

  /**
   * Filter repositories based on active status
   * Active = updated within last 30 days
   */
  const filteredRepositories = useMemo(() => {
    if (repoFilter === 'all') {
      return repositories;
    }

    // Filter for active repositories (updated in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return repositories.filter(repo => {
      if (!repo.updated_at) return false;
      const updatedDate = new Date(repo.updated_at);
      return updatedDate > thirtyDaysAgo;
    });
  }, [repositories, repoFilter]);

  /**
   * Group repositories by organization
   */
  const groupRepositoriesByOrg = (): [string, Repository[]][] => {
    const reposByOrg: Record<string, Repository[]> = {};

    filteredRepositories.forEach(repo => {
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
      {/* Native HTML details/summary for expand/collapse */}
      <details open={initialShowRepoList} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: 'var(--space)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
          {filteredRepositories.length} of {repositories.length} repositories
        </summary>

        {/* Repository info container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)', paddingTop: 'var(--space)' }}>
          {loading && repositories.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>
              Scanning repositories...
            </div>
          ) : (
            <>
              {/* Repository filter dropdown */}
              <div>
                <label htmlFor="repo-filter" style={{ display: 'block', marginBottom: 'calc(var(--space) / 2)', fontSize: '14px' }}>
                  Filter repositories:
                </label>
                <select
                  id="repo-filter"
                  name="repo-filter"
                  value={repoFilter}
                  onChange={(e) => setRepoFilter(e.target.value as 'all' | 'active')}
                  style={{ width: '100%' }}
                >
                  <option value="all">All repositories</option>
                  <option value="active">Active only (updated in last 30 days)</option>
                </select>
              </div>

              <div>
                Analyzing {repoFilter === 'active' ? 'recently active' : 'all accessible'} repositories
              </div>

              {/* Display filter information if applied */}
              {(activeFilters.contributors.length > 0 ||
                activeFilters.organizations.length > 0 ||
                activeFilters.repositories.length > 0) && (
                <div style={{ background: '#f9fafb', padding: 'var(--space)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 2)' }}>
                  <div style={{ fontWeight: '500' }}>
                    Active Filters
                  </div>
                  <div style={{ fontSize: '0.9em', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 4)' }}>
                    {activeFilters.contributors.length > 0 && (
                      <div>
                        Contributors: {activeFilters.contributors.includes('me') ? 'Only Me' : activeFilters.contributors.join(', ')}
                      </div>
                    )}
                    {activeFilters.organizations.length > 0 && (
                      <div>
                        Organizations: {activeFilters.organizations.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Repository stats summary */}
              {filteredRepositories.length > 0 && (
                <div style={{ display: 'flex', gap: 'calc(var(--space) * 2)' }}>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Repos</div>
                    <div style={{ fontWeight: '500' }}>{filteredRepositories.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Orgs</div>
                    <div style={{ fontWeight: '500' }}>{new Set(filteredRepositories.map(repo => repo.full_name.split('/')[0])).size}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Private</div>
                    <div style={{ fontWeight: '500' }}>{filteredRepositories.filter(repo => repo.private).length}</div>
                  </div>
                </div>
              )}

              {/* Repository list with native HTML checkboxes */}
              {filteredRepositories.length > 0 ? (
                <fieldset style={{ border: '1px solid var(--border)', padding: 'var(--space)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: 'var(--space)' }}>
                  <legend>Select Repositories</legend>
                  {groupRepositoriesByOrg().map(([org, repos]) => (
                    <details key={org} open>
                      <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                        {org} ({repos.length})
                      </summary>
                      <div style={{ paddingLeft: 'calc(var(--space) * 2)', paddingTop: 'calc(var(--space) / 2)', display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 2)' }}>
                        {repos.map((repo) => (
                          <label key={repo.id} style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--space) / 2)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              name="repository"
                              value={repo.full_name}
                              defaultChecked
                            />
                            <span>{repo.name}</span>
                            {repo.private && (
                              <span style={{ fontSize: '0.8em', color: 'var(--muted)' }}>
                                (private)
                              </span>
                            )}
                            {repo.language && (
                              <span style={{ fontSize: '0.8em', color: 'var(--muted)' }}>
                                • {repo.language}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </fieldset>
              ) : filteredRepositories.length === 0 && !loading ? (
                <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 'calc(var(--space) * 2)' }}>
                  {repoFilter === 'active' && repositories.length > 0
                    ? 'No repositories updated in the last 30 days'
                    : 'NO REPOSITORIES DETECTED'}
                </div>
              ) : null}
            </>
          )}
        </div>
      </details>

      {/* Submit button */}
      {isWithinForm && (
        <div style={{ paddingTop: 'var(--space)' }}>
          <button
            type={onSubmit ? "button" : "submit"}
            className="generate-button"
            onClick={onSubmit}
            disabled={loading}
            title="Analyze your GitHub commits and generate activity summary with AI insights"
            style={{
              width: '100%',
              padding: 'calc(var(--space) * 1.5)',
              borderRadius: '4px',
              fontSize: '1em'
            }}
          >
            {loading ? 'Analyzing...' : 'Generate Summary'}
          </button>
        </div>
      )}
    </aside>
  );

  return renderRepositorySection();
}