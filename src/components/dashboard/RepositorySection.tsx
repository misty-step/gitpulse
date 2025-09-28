import React from 'react';
import { Repository } from '@/types/dashboard';

interface RepositorySectionProps {
  repositories: readonly Repository[];
  loading: boolean;
}

export default function RepositorySection({
  repositories,
  loading
}: RepositorySectionProps) {
  // Group repositories by organization
  const reposByOrg: Record<string, Repository[]> = {};
  repositories.forEach(repo => {
    const org = repo.full_name.split('/')[0];
    if (!reposByOrg[org]) reposByOrg[org] = [];
    reposByOrg[org].push(repo);
  });

  if (loading && repositories.length === 0) {
    return <aside style={{ color: 'var(--muted)' }}>Loading repositories...</aside>;
  }

  if (repositories.length === 0) {
    return <aside style={{ color: 'var(--muted)' }}>No repositories found</aside>;
  }

  return (
    <aside>
      <fieldset style={{ border: '1px solid var(--border)', padding: 'var(--space)' }}>
        <legend>{repositories.length} repositories</legend>

        {/* Organization groups with collapsible details */}
        {Object.entries(reposByOrg).map(([org, repos]) => (
          <details key={org} open>
            <summary style={{ cursor: 'pointer', marginBottom: 'calc(var(--space) / 2)' }}>
              {org} ({repos.length})
            </summary>
            <div style={{ paddingLeft: 'var(--space)' }}>
              {repos.map(repo => (
                <label key={repo.id} style={{ display: 'block', marginBottom: '4px' }}>
                  <input
                    type="checkbox"
                    name="repository"
                    value={repo.full_name}
                    defaultChecked
                  />
                  {' '}{repo.name}
                  {repo.private && ' (private)'}
                </label>
              ))}
            </div>
          </details>
        ))}
      </fieldset>
    </aside>
  );
}