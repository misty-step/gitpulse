/**
 * GitHub API Client for Convex Actions
 *
 * Adapted from packages/sdk/src/github.ts for Convex serverless environment.
 * Uses fetch API instead of Octokit to avoid Node.js dependencies.
 *
 * Deep module: Simple interface hiding GitHub API pagination, auth, rate limits.
 */

/**
 * GitHub API base URL
 */
const GITHUB_API_BASE = "https://api.github.com";

/**
 * GitHub API error response
 */
interface GitHubError {
  message: string;
  documentation_url?: string;
}

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if it's a rate limit error (403 or 429)
      const is403Or429 =
        error instanceof Error &&
        (error.message.includes("403") || error.message.includes("429"));

      if (is403Or429) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Make authenticated GitHub API request
 */
async function githubFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const url = `${GITHUB_API_BASE}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gitpulse/0.1",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as GitHubError;
    throw new Error(
      `GitHub API error (${response.status}): ${error.message || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

/**
 * GitHub Pull Request (simplified)
 */
export interface GitHubPullRequest {
  id: number;
  node_id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  user: {
    id: number;
    login: string;
    node_id: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

/**
 * GitHub Review (simplified)
 */
export interface GitHubReview {
  id: number;
  node_id: string;
  user: {
    id: number;
    login: string;
    node_id: string;
  };
  body: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  html_url: string;
  submitted_at: string;
}

/**
 * GitHub Commit (simplified)
 */
export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    id: number;
    login: string;
    node_id: string;
  } | null;
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

/**
 * GitHub Repository (simplified)
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: {
    id: number;
    login: string;
    node_id: string;
  };
  description: string | null;
  homepage: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

/**
 * Backfill pull requests for a repository
 *
 * Fetches all PRs created after a specific date with pagination.
 *
 * @param token - GitHub personal access token
 * @param fullName - Repository full name (e.g., "facebook/react")
 * @param sinceISO - ISO date string to filter PRs created after
 * @returns Array of pull request objects
 */
export async function backfillPRs(
  token: string,
  fullName: string,
  sinceISO: string
): Promise<GitHubPullRequest[]> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo format: ${fullName}. Expected "owner/repo"`);
  }

  const since = new Date(sinceISO);
  const allPRs: GitHubPullRequest[] = [];

  // Paginate through results
  let page = 1;
  const perPage = 100;

  while (true) {
    const prs = await withRetry(() =>
      githubFetch<GitHubPullRequest[]>(
        `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
        token
      )
    );

    if (prs.length === 0) {
      break;
    }

    // Filter PRs created after the specified date
    const filtered = prs.filter((pr) => new Date(pr.created_at) >= since);
    allPRs.push(...filtered);

    // If we got fewer than perPage results, we've reached the end
    if (prs.length < perPage) {
      break;
    }

    page++;
  }

  return allPRs;
}

/**
 * List all reviews for a pull request
 *
 * @param token - GitHub personal access token
 * @param fullName - Repository full name (e.g., "facebook/react")
 * @param prNumber - Pull request number
 * @returns Array of review objects
 */
export async function listReviews(
  token: string,
  fullName: string,
  prNumber: number
): Promise<GitHubReview[]> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo format: ${fullName}. Expected "owner/repo"`);
  }

  return await withRetry(() =>
    githubFetch<GitHubReview[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      token
    )
  );
}

/**
 * List commits for a repository
 *
 * @param token - GitHub personal access token
 * @param fullName - Repository full name (e.g., "facebook/react")
 * @param sinceISO - ISO date string to filter commits after
 * @param author - Optional: Filter by author login
 * @returns Array of commit objects
 */
export async function listCommits(
  token: string,
  fullName: string,
  sinceISO: string,
  author?: string
): Promise<GitHubCommit[]> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo format: ${fullName}. Expected "owner/repo"`);
  }

  let path = `/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`;
  if (author) {
    path += `&author=${author}`;
  }

  const allCommits: GitHubCommit[] = [];
  let page = 1;

  while (true) {
    const commits = await withRetry(() =>
      githubFetch<GitHubCommit[]>(`${path}&page=${page}`, token)
    );

    if (commits.length === 0) {
      break;
    }

    allCommits.push(...commits);

    // If we got fewer than 100 results, we've reached the end
    if (commits.length < 100) {
      break;
    }

    page++;
  }

  return allCommits;
}

/**
 * Get repository details
 *
 * @param token - GitHub personal access token
 * @param fullName - Repository full name (e.g., "facebook/react")
 * @returns Repository object
 */
export async function getRepository(
  token: string,
  fullName: string
): Promise<GitHubRepository> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo format: ${fullName}. Expected "owner/repo"`);
  }

  return await withRetry(() =>
    githubFetch<GitHubRepository>(`/repos/${owner}/${repo}`, token)
  );
}

/**
 * List all repositories for a GitHub user
 *
 * Fetches all repos (public + private if token has access) with pagination.
 *
 * @param token - GitHub personal access token
 * @param username - GitHub username (e.g., "torvalds")
 * @returns Array of repository objects
 */
export async function listUserRepositories(
  token: string,
  username: string
): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const repos = await withRetry(() =>
      githubFetch<GitHubRepository[]>(
        `/users/${username}/repos?per_page=${perPage}&page=${page}`,
        token
      )
    );

    if (repos.length === 0) {
      break;
    }

    allRepos.push(...repos);

    // If we got fewer than perPage results, we've reached the end
    if (repos.length < perPage) {
      break;
    }

    page++;
  }

  return allRepos;
}

/**
 * List all repositories for a GitHub organization
 *
 * Fetches all repos (public + private if token has org access) with pagination.
 *
 * @param token - GitHub personal access token (needs read:org for private repos)
 * @param orgName - GitHub organization name (e.g., "facebook")
 * @returns Array of repository objects
 */
export async function listOrgRepositories(
  token: string,
  orgName: string
): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const repos = await withRetry(() =>
      githubFetch<GitHubRepository[]>(
        `/orgs/${orgName}/repos?per_page=${perPage}&page=${page}`,
        token
      )
    );

    if (repos.length === 0) {
      break;
    }

    allRepos.push(...repos);

    // If we got fewer than perPage results, we've reached the end
    if (repos.length < perPage) {
      break;
    }

    page++;
  }

  return allRepos;
}
