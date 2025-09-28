import React from 'react';
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
      {/* Native HTML details/summary for expand/collapse */}
      <details open={initialShowRepoList} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: 'var(--space)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
          {repositories.length} repositories
        </summary>

        {/* Repository info container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space)', paddingTop: 'var(--space)' }}>
          {loading && repositories.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>
              Scanning repositories...
            </div>
          ) : (
            <>
              <div>
                Analyzing all accessible repositories
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
              {repositories.length > 0 && (
                <div style={{ display: 'flex', gap: 'calc(var(--space) * 2)' }}>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Repos</div>
                    <div style={{ fontWeight: '500' }}>{repositories.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Orgs</div>
                    <div style={{ fontWeight: '500' }}>{new Set(repositories.map(repo => repo.full_name.split('/')[0])).size}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8em', color: 'var(--muted)' }}>Private</div>
                    <div style={{ fontWeight: '500' }}>{repositories.filter(repo => repo.private).length}</div>
                  </div>
                </div>
              )}

              {/* Repository list with native HTML checkboxes */}
              {repositories.length > 0 ? (
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
              ) : repositories.length === 0 && !loading ? (
                <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 'calc(var(--space) * 2)' }}>
                  NO REPOSITORIES DETECTED
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
            onClick={onSubmit}
            disabled={loading}
            title="Analyze your GitHub commits and generate activity summary with AI insights"
            style={{
              width: '100%',
              padding: 'calc(var(--space) * 1.5)',
              background: loading ? 'var(--muted)' : 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '500',
              cursor: loading ? 'default' : 'pointer',
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