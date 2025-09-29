/**
 * Data transformation utilities for GitHub GraphQL API responses
 *
 * Transforms GraphQL response objects to match the existing REST API
 * interfaces for backward compatibility.
 */

import type { Commit, Repository } from '../types';
import type { CommitNode, RepositoryNode } from './queries';

/**
 * Transform a GraphQL CommitNode to REST API Commit format
 *
 * @param node - GraphQL CommitNode from the API
 * @param repoFullName - Full repository name (owner/name)
 * @returns Commit object matching REST API format
 */
export function transformGraphQLCommit(
  node: CommitNode,
  repoFullName: string
): Commit {
  return {
    // Map oid to sha
    sha: node.oid,

    // Transform commit metadata
    commit: {
      author: {
        name: node.author?.name || undefined,
        email: node.author?.email || undefined,
        date: node.committedDate,
      },
      committer: node.committer ? {
        name: node.committer.name || undefined,
        email: node.committer.email || undefined,
        date: node.committedDate,
      } : undefined,
      message: node.message,
    },

    // Generate html_url from repository and commit sha
    html_url: `https://github.com/${repoFullName}/commit/${node.oid}`,

    // Transform author (GitHub user) - null if not a GitHub user
    author: node.author?.user ? {
      login: node.author.user.login,
      avatar_url: `https://github.com/${node.author.user.login}.png`,
      type: 'User',
    } : null,

    // Transform committer (GitHub user) - undefined if not present
    committer: node.committer?.user ? {
      login: node.committer.user.login,
      avatar_url: `https://github.com/${node.committer.user.login}.png`,
      type: 'User',
    } : undefined,

    // Preserve repository full name for downstream processing
    repository: {
      full_name: repoFullName,
    },
  };
}

/**
 * Transform a GraphQL RepositoryNode to REST API Repository format
 *
 * @param node - GraphQL RepositoryNode from the API
 * @returns Repository object matching REST API format
 */
export function transformGraphQLRepository(node: {
  id: string;
  nameWithOwner: string;
  owner?: {
    login: string;
    avatarUrl?: string;
  };
  isPrivate?: boolean;
  url?: string;
  description?: string;
  updatedAt?: string;
  primaryLanguage?: {
    name: string;
  };
}): Repository {
  // Parse owner and name from nameWithOwner
  const [ownerLogin, ...nameParts] = node.nameWithOwner.split('/');
  const name = nameParts.join('/');

  return {
    // Note: GraphQL returns string IDs, REST API uses numeric IDs
    // We'll need to handle this conversion at the call site if needed
    id: parseInt(node.id.replace(/\D/g, ''), 10) || 0,

    name,
    full_name: node.nameWithOwner,

    owner: {
      login: node.owner?.login || ownerLogin,
      avatar_url: node.owner?.avatarUrl,
      type: 'User', // Default to User, would need additional query to determine Organization
    },

    private: node.isPrivate ?? false,
    html_url: node.url || `https://github.com/${node.nameWithOwner}`,
    description: node.description || null,
    updated_at: node.updatedAt || null,
    language: node.primaryLanguage?.name || null,
  };
}

/**
 * Transform an array of GraphQL CommitNodes to Commit objects
 *
 * @param nodes - Array of GraphQL CommitNodes
 * @param repoFullName - Full repository name (owner/name)
 * @returns Array of Commit objects
 */
export function transformGraphQLCommits(
  nodes: CommitNode[],
  repoFullName: string
): Commit[] {
  return nodes.map(node => transformGraphQLCommit(node, repoFullName));
}

/**
 * Extract repository full name from a RepositoryNode
 *
 * @param node - GraphQL RepositoryNode
 * @returns Full repository name (owner/name)
 */
export function getRepositoryFullName(node: { nameWithOwner: string }): string {
  return node.nameWithOwner;
}