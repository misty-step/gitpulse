/**
 * Data provider adapter for dashboard hooks
 * Integrates the effect-based GitHub provider with React hook requirements
 */

import { ioEffect, type IOEffect } from '../../../services/effects/types';
import type { DataProvider } from '../../../services/workflows/summary';
import type { CommitData } from '../../../core/types/index';
import { 
  createGitHubDataProvider, 
  createRepositoryProvider,
  type GitHubProviderConfig,
  type CommitFetchProgress 
} from '../../../services/providers/github';
import { logger } from '../../../lib/logger';
import type { SummaryRequestConfig } from '../utils/summary-params';
import { 
  shouldFilterByOrganizations, 
  getOrganizationFilters
} from '../utils/summary-params';

const MODULE_NAME = "hooks:adapters:summary-data-provider";

/**
 * Enhanced data provider for dashboard hooks that handles repository discovery
 */
export interface DashboardDataProvider extends DataProvider {
  /**
   * Fetch available repositories and apply organization filtering
   */
  fetchFilteredRepositories(config: SummaryRequestConfig): IOEffect<readonly string[]>;
}

/**
 * Configuration for the dashboard data provider
 */
export interface DashboardDataProviderConfig extends GitHubProviderConfig {
  repositories: readonly string[];
}

export interface DashboardDataProviderOptions {
  onCommitFetchProgress?: (progress: CommitFetchProgress) => void;
}

/**
 * Create a dashboard-specific data provider that handles repository filtering
 * and integrates with the dashboard's filtering requirements
 */
export const createDashboardDataProvider = (
  config: DashboardDataProviderConfig
): DashboardDataProvider => {
  const githubProvider = createGitHubDataProvider(config);
  const repositoryProvider = createRepositoryProvider(config);

  return {
    fetchCommits: (
      repositories: readonly string[],
      dateRange: { start: Date; end: Date },
      branch?: string
    ): IOEffect<readonly CommitData[]> => {
      return githubProvider.fetchCommits(repositories, dateRange, branch);
    },

    fetchFilteredRepositories: (requestConfig: SummaryRequestConfig): IOEffect<readonly string[]> =>
      ioEffect(async () => {
        logger.debug(MODULE_NAME, "Fetching filtered repositories", {
          hasOrganizationFilter: requestConfig.organizations.length > 0,
          hasRepositoryFilter: requestConfig.repositories.length > 0,
          activityMode: requestConfig.activityMode
        });

        // If specific repositories are already provided, use them
        if (requestConfig.repositories.length > 0) {
          logger.debug(MODULE_NAME, "Using specific repository filters", {
            repositoryCount: requestConfig.repositories.length
          });
          return requestConfig.repositories;
        }

        // If organization filters are specified, fetch and filter repositories
        if (shouldFilterByOrganizations(requestConfig)) {
          logger.debug(MODULE_NAME, "Fetching repositories by organization filter", {
            organizations: requestConfig.organizations
          });

          // Fetch all available repositories
          const allRepositories = await repositoryProvider.fetchRepositories()();
          
          // Apply organization filtering
          const organizationFilters = getOrganizationFilters(requestConfig);
          const filteredRepos = repositoryProvider.filterRepositories(
            allRepositories,
            organizationFilters,
            []
          );

          const repositoryNames = filteredRepos.map(repo => repo.full_name);
          
          logger.info(MODULE_NAME, "Filtered repositories by organization", {
            totalRepositories: allRepositories.length,
            filteredRepositories: repositoryNames.length,
            organizations: organizationFilters
          });

          return repositoryNames;
        }

        // Fallback: use all available repositories from the provided list
        logger.debug(MODULE_NAME, "Using all available repositories from config", {
          repositoryCount: config.repositories.length
        });
        
        return config.repositories;
      })
  };
};

/**
 * Create a dashboard data provider with session context
 * Handles authentication and user context from React session
 */
export const createSessionDataProvider = (
  session: any,
  installationIds: readonly number[],
  availableRepositories: readonly string[],
  options: DashboardDataProviderOptions = {}
): DashboardDataProvider => {
  const providerConfig: DashboardDataProviderConfig = {
    accessToken: session?.accessToken,
    installationIds,
    currentUserName: session?.user?.name,
    repositories: availableRepositories,
    onCommitFetchProgress: options.onCommitFetchProgress
  };

  return createDashboardDataProvider(providerConfig);
};


/**
 * Error transformer for dashboard-specific error handling
 */
export const transformDashboardError = (error: Error): Error => {
  const message = error.message;

  // Transform common API errors to user-friendly messages
  if (message.includes('Validation failed')) {
    return new Error('Invalid request parameters. Please check your filters and try again.');
  }

  if (message.includes('No repositories match')) {
    return new Error('No repositories found matching your organization and filter criteria. Please adjust your filters.');
  }

  if (message.includes('authentication')) {
    return new Error('Authentication issue detected. Please sign out and sign in again to refresh your permissions.');
  }

  if (message.includes('installation')) {
    return new Error('GitHub App installation required. Please install the GitHub App to access all your repositories.');
  }

  // Return original error if no transformation needed
  return error;
};
