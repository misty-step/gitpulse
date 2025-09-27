/**
 * GitHub API data provider for the effect-based summary service
 * Implements the DataProvider interface and handles all GitHub API interactions
 */

import { ioEffect, type IOEffect } from '../effects/types';
import type { DataProvider } from '../workflows/summary';
import type { CommitData } from '../../core/types/index';
import { logger } from '../../lib/logger';
import { 
  getAllAppInstallations,
  fetchAllRepositories,
  type AppInstallation,
  type Repository
} from '../../lib/github';
import { 
  fetchCommitsForRepositories, 
  type CommitFetchPhase,
  type CommitFetchRepositoryEvent
} from '../../lib/github/commits';
import type { Commit } from '../../lib/github/types';

const MODULE_NAME = "services:providers:github";

/**
 * Configuration for GitHub API provider
 */
export interface GitHubProviderConfig {
  accessToken?: string;
  installationIds?: readonly number[];
  currentUserName?: string;
  onCommitFetchProgress?: (progress: CommitFetchProgress) => void;
}

export interface CommitFetchProgress {
  repository: string;
  completed: number;
  total: number;
  phase: CommitFetchPhase;
}

/**
 * Extended GitHub data provider with raw commit access for AI summary generation
 */
export interface ExtendedGitHubDataProvider extends DataProvider {
  fetchRawCommits(
    repositories: readonly string[],
    dateRange: { start: Date; end: Date },
    branch?: string
  ): IOEffect<readonly Commit[]>;
}

/**
 * Create a GitHub API data provider that implements the DataProvider interface
 * This provider handles authentication, repository fetching, and commit retrieval
 */
export const createGitHubDataProvider = (config: GitHubProviderConfig): ExtendedGitHubDataProvider => {
  const { accessToken, installationIds = [], currentUserName, onCommitFetchProgress } = config;

  return {
    fetchCommits: (
      repositories: readonly string[],
      dateRange: { start: Date; end: Date },
      branch?: string
    ): IOEffect<readonly CommitData[]> => 
      ioEffect(async () => {
        logger.debug(MODULE_NAME, "Fetching commits from GitHub API", {
          repositoryCount: repositories.length,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          },
          branch,
          hasAccessToken: !!accessToken,
          installationCount: installationIds.length
        });

        // Convert dates to ISO strings for GitHub API
        const since = dateRange.start.toISOString();
        const until = dateRange.end.toISOString();

        const totalRepositories = repositories.length;
        let completedRepositories = 0;

        const emitProgress = (event: CommitFetchRepositoryEvent) => {
          if (!onCommitFetchProgress || totalRepositories === 0) {
            return;
          }

          if (event.phase !== 'initial') {
            // Only track progress during the initial fetch attempt to avoid double counting
            return;
          }

          completedRepositories = Math.min(completedRepositories + 1, totalRepositories);
          onCommitFetchProgress({
            repository: event.repository,
            completed: completedRepositories,
            total: totalRepositories,
            phase: event.phase
          });
        };

        // Get all available installations if we have access token
        let allInstallations: AppInstallation[] = [];
        if (accessToken) {
          try {
            allInstallations = await getAllAppInstallations(accessToken);
            logger.debug(MODULE_NAME, "Retrieved GitHub App installations", {
              count: allInstallations.length
            });
          } catch (error) {
            logger.warn(MODULE_NAME, "Failed to get installations, proceeding with OAuth only", { error });
          }
        }

        // Map repositories to installations for efficient fetching
        const { reposByInstallation } = mapRepositoriesToInstallations(
          repositories,
          allInstallations,
          installationIds
        );

        // Fetch commits from all installation groups in parallel
        const commitFetchPromises: Promise<Commit[]>[] = [];
        
        for (const [key, repos] of Object.entries(reposByInstallation)) {
          if (repos.length === 0) continue;
          
          if (key === 'oauth') {
            // Fetch with OAuth if the user has an access token
            if (accessToken) {
              commitFetchPromises.push(
                fetchCommitsForRepositories(
                  accessToken,
                  undefined, // No installation ID for OAuth
                  repos,
                  since,
                  until,
                  undefined, // No author filter at API level
                  {
                    onRepositoryComplete: emitProgress
                  }
                )
              );
            }
          } else {
            // Fetch with installation ID
            const installId = parseInt(key, 10);
            commitFetchPromises.push(
              fetchCommitsForRepositories(
                accessToken,
                installId,
                repos,
                since,
                until,
                undefined, // No author filter at API level
                {
                  onRepositoryComplete: emitProgress
                }
              )
            );
          }
        }
        
        // Wait for all commit fetching to complete
        const commitResults = await Promise.all(commitFetchPromises);
        const githubCommits = commitResults.flat();

        logger.info(MODULE_NAME, "Fetched commits from GitHub", {
          commitCount: githubCommits.length,
          repositoriesRequested: repositories.length
        });

        // Transform GitHub API response to our domain model
        const commits: CommitData[] = githubCommits.map(transformGitHubCommit);

        return commits;
      }),

    fetchRawCommits: (
      repositories: readonly string[],
      dateRange: { start: Date; end: Date },
      branch?: string
    ): IOEffect<readonly Commit[]> => 
      ioEffect(async () => {
        logger.debug(MODULE_NAME, "Fetching raw commits from GitHub API", {
          repositoryCount: repositories.length,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          },
          branch
        });

        // Convert dates to ISO strings for GitHub API
        const since = dateRange.start.toISOString();
        const until = dateRange.end.toISOString();

        // Get all available installations if we have access token
        let allInstallations: AppInstallation[] = [];
        if (accessToken) {
          try {
            allInstallations = await getAllAppInstallations(accessToken);
          } catch (error) {
            logger.warn(MODULE_NAME, "Failed to get installations for raw commits", { error });
          }
        }

        // Map repositories to installations for efficient fetching
        const { reposByInstallation } = mapRepositoriesToInstallations(
          repositories,
          allInstallations,
          installationIds
        );

        // Fetch commits from all installation groups in parallel
        const commitFetchPromises: Promise<Commit[]>[] = [];
        
        for (const [key, repos] of Object.entries(reposByInstallation)) {
          if (repos.length === 0) continue;
          
          if (key === 'oauth') {
            // Fetch with OAuth if the user has an access token
            if (accessToken) {
              commitFetchPromises.push(
                fetchCommitsForRepositories(
                  accessToken,
                  undefined, // No installation ID for OAuth
                  repos,
                  since,
                  until,
                  undefined // No author filter at API level
                )
              );
            }
          } else {
            // Fetch with installation ID
            const installId = parseInt(key, 10);
            commitFetchPromises.push(
              fetchCommitsForRepositories(
                accessToken,
                installId,
                repos,
                since,
                until,
                undefined // No author filter at API level
              )
            );
          }
        }
        
        // Wait for all commit fetching to complete and return raw commits
        const commitResults = await Promise.all(commitFetchPromises);
        const rawCommits = commitResults.flat();

        logger.info(MODULE_NAME, "Fetched raw commits from GitHub", {
          commitCount: rawCommits.length,
          repositoriesRequested: repositories.length
        });

        return rawCommits;
      })
  };
};

/**
 * Transform GitHub API commit to our domain model
 */
const transformGitHubCommit = (githubCommit: Commit): CommitData => {
  // Extract repository name from HTML URL
  // e.g., "https://github.com/owner/repo/commit/sha" -> "owner/repo"
  const repoMatch = githubCommit.html_url.match(/github\.com\/([^/]+\/[^/]+)/);
  const repository = repoMatch ? repoMatch[1] : 'unknown/unknown';

  return {
    sha: githubCommit.sha,
    message: githubCommit.commit.message,
    author: githubCommit.author?.login || githubCommit.commit.author?.name || 'unknown',
    date: githubCommit.commit.author?.date || new Date().toISOString(),
    repository,
    additions: githubCommit.stats?.additions,
    deletions: githubCommit.stats?.deletions,
    url: githubCommit.html_url
  };
};

/**
 * Map repositories to installations for efficient fetching
 * Based on the existing handler logic but extracted as a pure function
 */
const mapRepositoriesToInstallations = (
  repositories: readonly string[],
  installations: readonly AppInstallation[],
  installationIds: readonly number[]
): {
  reposByInstallation: Record<string, string[]>
} => {
  logger.debug(MODULE_NAME, "Mapping repositories to installations", {
    repoCount: repositories.length,
    installationsCount: installations.length,
    selectedInstallationIds: installationIds.length
  });

  // Create mapping from organizations to installation IDs
  const orgToInstallationMap = new Map<string, number>();
    
  if (installationIds.length > 0) {
    repositories.forEach(repoFullName => {
      const orgName = repoFullName.split('/')[0];
      
      // Find an installation for this org if we don't already have one mapped
      if (!orgToInstallationMap.has(orgName)) {
        const matchingInstallation = installations.find(
          inst => inst.account?.login === orgName && installationIds.includes(inst.id)
        );
        
        if (matchingInstallation) {
          orgToInstallationMap.set(orgName, matchingInstallation.id);
        }
      }
    });
  }

  // Group repositories by installation ID for efficient fetching
  const reposByInstallation: Record<string, string[]> = {};
  
  // Initialize with a default key for OAuth
  reposByInstallation['oauth'] = [];
  
  repositories.forEach(repoFullName => {
    const orgName = repoFullName.split('/')[0];
    const installId = orgToInstallationMap.get(orgName);
    
    if (installId) {
      // Use the installation ID as the key
      const key = installId.toString();
      if (!reposByInstallation[key]) {
        reposByInstallation[key] = [];
      }
      reposByInstallation[key].push(repoFullName);
    } else {
      // No installation found for this org, use OAuth
      reposByInstallation['oauth'].push(repoFullName);
    }
  });

  logger.debug(MODULE_NAME, "Grouped repositories by installation", {
    installationGroups: Object.keys(reposByInstallation).length,
    reposCounts: Object.fromEntries(
      Object.entries(reposByInstallation).map(([key, repos]) => [key, repos.length])
    )
  });

  return { reposByInstallation };
};

/**
 * Repository provider for fetching available repositories
 * This is separate from the commit data provider as it's used for UI population
 */
export interface RepositoryProvider {
  fetchRepositories(): IOEffect<readonly Repository[]>;
  filterRepositories(
    repositories: readonly Repository[],
    organizations?: readonly string[],
    repositoryNames?: readonly string[]
  ): readonly Repository[];
}

/**
 * Create a repository provider for fetching and filtering repositories
 */
export const createRepositoryProvider = (config: GitHubProviderConfig): RepositoryProvider => {
  const { accessToken, installationIds = [] } = config;

  return {
    fetchRepositories: (): IOEffect<readonly Repository[]> =>
      ioEffect(async () => {
        logger.debug(MODULE_NAME, "Fetching repositories from GitHub API", {
          hasAccessToken: !!accessToken,
          installationCount: installationIds.length
        });

        let allRepos: Repository[] = [];
        
        if (installationIds.length > 0) {
          // Fetch repos from all installations in parallel
          const repoPromises = installationIds.map(id => 
            fetchAllRepositories(accessToken, id)
          );
          
          const repoResults = await Promise.all(repoPromises);
          allRepos = repoResults.flat();
          
          logger.debug(MODULE_NAME, "Fetched repositories from installations", {
            installationCount: installationIds.length,
            totalRepoCount: allRepos.length
          });
        } else if (accessToken) {
          // Fetch with OAuth only
          allRepos = await fetchAllRepositories(accessToken);
          
          logger.debug(MODULE_NAME, "Fetched repositories with OAuth", {
            repoCount: allRepos.length
          });
        }

        return allRepos;
      }),

    filterRepositories: (
      repositories: readonly Repository[],
      organizations: readonly string[] = [],
      repositoryNames: readonly string[] = []
    ): readonly Repository[] => {
      let filteredRepos = [...repositories];

      // Apply organization filter if specified
      if (organizations.length > 0) {
        filteredRepos = filteredRepos.filter(repo => {
          const orgName = repo.full_name.split('/')[0];
          return organizations.includes(orgName);
        });
      }

      // Apply repository filter if specified
      if (repositoryNames.length > 0) {
        filteredRepos = filteredRepos.filter(repo => 
          repositoryNames.includes(repo.full_name)
        );
      }

      logger.debug(MODULE_NAME, "Filtered repositories", {
        originalCount: repositories.length,
        filteredCount: filteredRepos.length,
        organizationFilters: organizations.length,
        repositoryFilters: repositoryNames.length
      });

      return filteredRepos;
    }
  };
};
