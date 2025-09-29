/**
 * GitHub commits module
 * 
 * Provides functions for fetching and interacting with GitHub commits
 * using both OAuth tokens and GitHub App installations.
 */

import { Octokit } from "octokit";
import { logger } from "../logger";
import { Commit } from "./types";
import { createOAuthOctokit, getInstallationOctokit } from "./auth";

const MODULE_NAME = "github:commits";

export type CommitFetchPhase =
  | "initial"
  | "retry-with-owner"
  | "retry-unfiltered";

export interface CommitFetchRepositoryEvent {
  repository: string;
  phase: CommitFetchPhase;
}

interface FetchCommitsForRepositoriesOptions {
  onRepositoryComplete?: (event: CommitFetchRepositoryEvent) => void;
}

/**
 * Fetch repository commits using OAuth token
 * @param accessToken GitHub OAuth access token
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @param since Start date for commit history (ISO date string)
 * @param until End date for commit history (ISO date string)
 * @param author Optional filter by commit author
 * @returns Array of GitHub commits
 */
export async function fetchRepositoryCommitsOAuth(
  accessToken: string,
  owner: string,
  repo: string,
  since: string,
  until: string,
  author?: string,
): Promise<Commit[]> {
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommitsOAuth called for ${owner}/${repo}`,
    {
      since,
      until,
      author: author || "not specified",
    },
  );

  const octokit = createOAuthOctokit(accessToken);

  try {
    logger.debug(
      MODULE_NAME,
      `Starting pagination for ${owner}/${repo} commits`,
    );
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      since,
      until,
      author,
      per_page: 100,
    });

    logger.info(MODULE_NAME, `Fetched commits for ${owner}/${repo}`, {
      count: commits.length,
      firstCommitSha: commits.length > 0 ? commits[0].sha : null,
      lastCommitSha:
        commits.length > 0 ? commits[commits.length - 1].sha : null,
    });

    // attach repository info
    const commitsWithRepoInfo = commits.map((commit) => ({
      ...commit,
      repository: {
        full_name: `${owner}/${repo}`,
      },
    }));

    return commitsWithRepoInfo as unknown as Commit[];
  } catch (error) {
    logger.error(MODULE_NAME, `Error fetching commits for ${owner}/${repo}`, {
      error,
    });
    // return empty array if there's an access or other error
    return [];
  }
}

/**
 * Fetch repository commits using GitHub App installation
 * @param installationId GitHub App installation ID
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @param since Start date for commit history (ISO date string)
 * @param until End date for commit history (ISO date string)
 * @param author Optional filter by commit author
 * @returns Array of GitHub commits
 */
export async function fetchRepositoryCommitsApp(
  installationId: number,
  owner: string,
  repo: string,
  since: string,
  until: string,
  author?: string,
): Promise<Commit[]> {
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommitsApp called for ${owner}/${repo}`,
    {
      installationId,
      since,
      until,
      author: author || "not specified",
    },
  );

  try {
    const octokit = await getInstallationOctokit(installationId);

    logger.debug(
      MODULE_NAME,
      `Starting pagination for ${owner}/${repo} commits via GitHub App`,
    );

    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      since,
      until,
      author,
      per_page: 100,
    });

    logger.info(
      MODULE_NAME,
      `Fetched commits for ${owner}/${repo} via GitHub App`,
      {
        count: commits.length,
        firstCommitSha: commits.length > 0 ? commits[0].sha : null,
        lastCommitSha:
          commits.length > 0 ? commits[commits.length - 1].sha : null,
      },
    );

    // attach repository info
    const commitsWithRepoInfo = commits.map((commit) => ({
      ...commit,
      repository: {
        full_name: `${owner}/${repo}`,
      },
    }));

    return commitsWithRepoInfo as unknown as Commit[];
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Error fetching commits for ${owner}/${repo} via GitHub App`,
      {
        error,
      },
    );
    // return empty array if there's an access or other error
    return [];
  }
}

/**
 * Unified function to fetch repository commits
 * @param accessToken GitHub OAuth access token
 * @param installationId GitHub App installation ID
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @param since Start date for commit history (ISO date string)
 * @param until End date for commit history (ISO date string)
 * @param author Optional filter by commit author
 * @returns Array of GitHub commits
 */
export async function fetchRepositoryCommits(
  accessToken?: string,
  installationId?: number,
  owner: string = "",
  repo: string = "",
  since: string = "",
  until: string = "",
  author?: string,
): Promise<Commit[]> {
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommits called for ${owner}/${repo}`,
    {
      hasAccessToken: !!accessToken,
      hasInstallationId: !!installationId,
      since,
      until,
      author: author || "not specified",
    },
  );

  try {
    // Prefer GitHub App installation if available
    if (installationId) {
      logger.info(
        MODULE_NAME,
        "Using GitHub App installation for commit access",
        {
          installationId,
        },
      );
      return await fetchRepositoryCommitsApp(
        installationId,
        owner,
        repo,
        since,
        until,
        author,
      );
    } else if (accessToken) {
      logger.info(MODULE_NAME, "Using OAuth token for commit access");
      return await fetchRepositoryCommitsOAuth(
        accessToken,
        owner,
        repo,
        since,
        until,
        author,
      );
    } else {
      // Neither authentication method is available
      logger.error(
        MODULE_NAME,
        "No authentication method available for commit access",
      );
      throw new Error(
        "No GitHub authentication available. Please sign in again.",
      );
    }
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Error in unified fetchRepositoryCommits for ${owner}/${repo}`,
      { error },
    );
    return [];
  }
}

/**
 * Fetch commits from multiple repositories
 * @param accessToken GitHub OAuth access token
 * @param installationId GitHub App installation ID
 * @param repositories Array of repository full names (owner/repo)
 * @param since Start date for commit history (ISO date string)
 * @param until End date for commit history (ISO date string)
 * @param author Optional filter by commit author
 * @returns Array of GitHub commits across all repositories
 */
export async function fetchCommitsForRepositories(
  accessToken?: string,
  installationId?: number,
  repositories: string[] = [],
  since: string = "",
  until: string = "",
  author?: string,
  options: FetchCommitsForRepositoriesOptions = {},
): Promise<Commit[]> {
  logger.debug(MODULE_NAME, "fetchCommitsForRepositories called", {
    repositoriesCount: repositories.length,
    hasAccessToken: !!accessToken,
    hasInstallationId: !!installationId,
    since,
    until,
    author: author || "not specified",
  });

  if (!accessToken && !installationId) {
    logger.error(
      MODULE_NAME,
      "No authentication method provided for fetching commits",
    );
    throw new Error(
      "No GitHub authentication available. Please sign in again.",
    );
  }

  const allCommits: Commit[] = [];
  let githubUsername = author;
  const batchSize = 5;

  // first pass with "author" if provided
  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    logger.debug(
      MODULE_NAME,
      `processing batch ${Math.floor(i / batchSize) + 1}`,
      { batchRepos: batch },
    );

    // Process repositories sequentially to avoid rate limits
    const results: Commit[][] = [];
    for (const repoFullName of batch) {
      const [owner, repo] = repoFullName.split("/");
      const commits = await fetchRepositoryCommits(
        accessToken,
        installationId,
        owner,
        repo,
        since,
        until,
        githubUsername,
      );
      options.onRepositoryComplete?.({
        repository: repoFullName,
        phase: "initial",
      });
      results.push(commits);

      // Add delay to respect GitHub rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    results.forEach((commits) => allCommits.push(...commits));
  }

  // if we found no commits with that author, try with owner name or no author
  if (allCommits.length === 0 && author) {
    logger.info(
      MODULE_NAME,
      "No commits found with provided author name; retrying with the repo owner as author",
    );

    if (repositories.length > 0) {
      const [fallbackOwner] = repositories[0].split("/");
      githubUsername = fallbackOwner;
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (repoFullName) => {
            const [owner, repo] = repoFullName.split("/");
            const commits = await fetchRepositoryCommits(
              accessToken,
              installationId,
              owner,
              repo,
              since,
              until,
              githubUsername,
            );
            options.onRepositoryComplete?.({
              repository: repoFullName,
              phase: "retry-with-owner",
            });
            return commits;
          }),
        );
        results.forEach((commits) => allCommits.push(...commits));
      }
    }
  }

  if (allCommits.length === 0 && author) {
    logger.info(
      MODULE_NAME,
      "Still no commits found, retrying without author filter",
    );
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (repoFullName) => {
          const [owner, repo] = repoFullName.split("/");
          const commits = await fetchRepositoryCommits(
            accessToken,
            installationId,
            owner,
            repo,
            since,
            until,
            undefined,
          );
          options.onRepositoryComplete?.({
            repository: repoFullName,
            phase: "retry-unfiltered",
          });
          return commits;
        }),
      );
      results.forEach((commits) => allCommits.push(...commits));
    }
  }

  logger.info(MODULE_NAME, "All repository commits fetched", {
    totalRepositories: repositories.length,
    totalCommits: allCommits.length,
    finalAuthorFilter: githubUsername || "none",
    authMethod: installationId ? "GitHub App" : "OAuth",
  });

  return allCommits;
}
