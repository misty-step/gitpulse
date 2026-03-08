import type { ActivityEvent, Scope, TimeWindow } from "@gitpulse/schemas";
import { normalizeScope } from "@gitpulse/schemas";

import { GitHubClient, GitHubError } from "./client";

type GitHubRepo = {
  full_name: string;
};

type GitHubCommit = {
  html_url: string;
  sha: string;
  author: { login: string } | null;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
};

type GitHubSearchResult<T> = {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
};

type GitHubSearchPullRequest = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  user: { login: string } | null;
};

type GitHubReview = {
  html_url: string;
  submitted_at: string | null;
  user: { login: string } | null;
};

export type ActivityWindowData = {
  scope: Scope;
  repos: string[];
  window: TimeWindow;
  events: ActivityEvent[];
  warnings: string[];
};

export type FetchActivityInput = {
  scope?: Partial<Scope>;
  window: TimeWindow;
  githubToken?: string;
  maxRepos?: number;
};

export async function fetchActivityWindow(input: FetchActivityInput): Promise<ActivityWindowData> {
  const scope = normalizeScope(input.scope);
  const client = new GitHubClient({ token: input.githubToken });
  const warnings: string[] = [];
  const maxRepos = normalizeMaxRepos(input.maxRepos);

  const repos = await resolveRepos(client, scope, maxRepos, warnings);
  if (repos.length === 0) {
    warnings.push("No repositories resolved from scope. Provide repos, orgs, or contributors with visible repositories.");
  }
  const contributorFilter = new Set(scope.contributors.map((value) => value.toLowerCase()));

  const events: ActivityEvent[] = [];

  for (const repo of repos) {
    try {
      const repoEvents = await fetchRepoEvents(client, repo, input.window, contributorFilter, warnings);
      events.push(...repoEvents);
    } catch (error) {
      if (error instanceof GitHubError) {
        warnings.push(`Skipping ${repo}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return {
    scope,
    repos,
    window: input.window,
    events,
    warnings,
  };
}

async function resolveRepos(
  client: GitHubClient,
  scope: Scope,
  maxRepos: number,
  warnings: string[],
): Promise<string[]> {
  const repos = new Set(scope.repos);

  for (const org of scope.orgs) {
    try {
      const orgRepos = await client.getPagedJson<GitHubRepo>(
        `/orgs/${encodeURIComponent(org)}/repos?type=all&sort=pushed&per_page=100`,
        { maxPages: 2 },
      );
      for (const repo of orgRepos) {
        repos.add(repo.full_name);
        if (repos.size >= maxRepos) {
          break;
        }
      }
    } catch (error) {
      warnings.push(`Could not resolve org ${org}: ${errorMessage(error)}`);
    }

    if (repos.size >= maxRepos) {
      break;
    }
  }

  if (repos.size < maxRepos) {
    for (const contributor of scope.contributors) {
      try {
        const userRepos = await client.getPagedJson<GitHubRepo>(
          `/users/${encodeURIComponent(contributor)}/repos?sort=updated&per_page=100`,
          { maxPages: 1 },
        );
        for (const repo of userRepos) {
          repos.add(repo.full_name);
          if (repos.size >= maxRepos) {
            break;
          }
        }
      } catch (error) {
        warnings.push(`Could not resolve repos for ${contributor}: ${errorMessage(error)}`);
      }

      if (repos.size >= maxRepos) {
        break;
      }
    }
  }

  return [...repos].slice(0, maxRepos);
}

function normalizeMaxRepos(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return 20;
  }

  return Math.min(100, Math.max(1, value));
}

async function fetchRepoEvents(
  client: GitHubClient,
  repo: string,
  window: TimeWindow,
  contributorFilter: Set<string>,
  warnings: string[],
): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  const repoPath = `/repos/${repo}`;

  const commits = await client.getPagedJson<GitHubCommit>(
    `${repoPath}/commits?since=${encodeURIComponent(window.from)}&until=${encodeURIComponent(window.to)}&per_page=100`,
    { maxPages: 2 },
  );

  for (const commit of commits) {
    const actor = commit.author?.login ?? commit.commit.author.name;
    if (!includeContributor(actor, contributorFilter)) {
      continue;
    }

    events.push({
      type: "commit",
      repo,
      actor,
      title: firstLine(commit.commit.message) || commit.sha.slice(0, 8),
      url: commit.html_url,
      timestamp: toIso(commit.commit.author.date),
    });
  }

  const openedPulls = await searchPullRequests(client, repo, window, "created", warnings);
  for (const pull of openedPulls) {
    const actor = pull.user?.login ?? "ghost";
    if (!includeContributor(actor, contributorFilter)) {
      continue;
    }

    events.push({
      type: "pull_request_opened",
      repo,
      actor,
      title: pull.title,
      url: pull.html_url,
      timestamp: toIso(pull.created_at),
    });
  }

  const mergedPulls = await searchPullRequests(client, repo, window, "merged", warnings);
  for (const pull of mergedPulls) {
    const actor = pull.user?.login ?? "ghost";
    const mergedAt = pull.closed_at;
    if (!mergedAt || !includeContributor(actor, contributorFilter)) {
      continue;
    }

    events.push({
      type: "pull_request_merged",
      repo,
      actor,
      title: pull.title,
      url: pull.html_url,
      timestamp: toIso(mergedAt),
    });
  }

  const reviewPulls = await searchPullRequests(client, repo, window, "updated", warnings);
  for (const pull of reviewPulls) {
    try {
      const reviews = await client.getPagedJson<GitHubReview>(
        `${repoPath}/pulls/${pull.number}/reviews?per_page=100`,
        { maxPages: 1 },
      );

      for (const review of reviews) {
        if (!review.submitted_at || !review.user?.login || !inWindow(review.submitted_at, window)) {
          continue;
        }

        if (!includeContributor(review.user.login, contributorFilter)) {
          continue;
        }

        events.push({
          type: "pull_request_reviewed",
          repo,
          actor: review.user.login,
          title: `Review on #${pull.number}: ${pull.title}`,
          url: review.html_url,
          timestamp: toIso(review.submitted_at),
        });
      }
    } catch (error) {
      warnings.push(`Could not fetch reviews for ${repo}#${pull.number}: ${errorMessage(error)}`);
    }
  }

  return events;
}

async function searchPullRequests(
  client: GitHubClient,
  repo: string,
  window: TimeWindow,
  field: "created" | "merged" | "updated",
  warnings: string[],
): Promise<GitHubSearchPullRequest[]> {
  const deduped = new Map<number, GitHubSearchPullRequest>();
  const pulls = await searchPullRequestsRange(
    client,
    repo,
    field,
    Date.parse(window.from),
    Date.parse(window.to),
    warnings,
  );

  for (const pull of pulls) {
    deduped.set(pull.number, pull);
  }

  return [...deduped.values()];
}

async function searchPullRequestsRange(
  client: GitHubClient,
  repo: string,
  field: "created" | "merged" | "updated",
  fromMs: number,
  toMs: number,
  warnings: string[],
): Promise<GitHubSearchPullRequest[]> {
  const query = buildPullRequestSearchQuery(repo, field, fromMs, toMs);
  const firstPage = await client.getJson<GitHubSearchResult<GitHubSearchPullRequest>>(searchIssuesPath(query, 1));

  if (firstPage.incomplete_results) {
    warnings.push(`GitHub search returned incomplete PR results for ${repo} (${field}).`);
  }

  if (firstPage.total_count > 1000) {
    if (fromMs >= toMs) {
      warnings.push(`GitHub search exceeded 1000 PRs for ${repo} (${field}) within a 1ms slice; results truncated.`);
      return firstPage.items;
    }

    const midpoint = Math.floor((fromMs + toMs) / 2);
    const [left, right] = await Promise.all([
      searchPullRequestsRange(client, repo, field, fromMs, midpoint, warnings),
      searchPullRequestsRange(client, repo, field, midpoint + 1, toMs, warnings),
    ]);
    return [...left, ...right];
  }

  const pulls = [...firstPage.items];
  const totalPages = Math.min(10, Math.ceil(firstPage.total_count / 100));
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await client.getJson<GitHubSearchResult<GitHubSearchPullRequest>>(searchIssuesPath(query, page));
    pulls.push(...response.items);
  }

  return pulls;
}

function buildPullRequestSearchQuery(
  repo: string,
  field: "created" | "merged" | "updated",
  fromMs: number,
  toMs: number,
): string {
  const parts = [`repo:${repo}`, "is:pr"];
  if (field === "merged") {
    parts.push("is:merged");
  }
  parts.push(`${field}:${new Date(fromMs).toISOString()}..${new Date(toMs).toISOString()}`);
  return parts.join(" ");
}

function searchIssuesPath(query: string, page: number): string {
  const params = new URLSearchParams({
    q: query,
    per_page: "100",
    page: String(page),
  });
  return `/search/issues?${params.toString()}`;
}

function includeContributor(actor: string, filter: Set<string>): boolean {
  if (filter.size === 0) {
    return true;
  }

  return filter.has(actor.toLowerCase());
}

function inWindow(timestamp: string, window: TimeWindow): boolean {
  const value = Date.parse(timestamp);
  return value >= Date.parse(window.from) && value <= Date.parse(window.to);
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function firstLine(value: string): string {
  return value.split("\n")[0]?.trim() ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
