"use node";

import { signJwt } from "../actions/_nodeUtils";
import type {
  InstallationToken,
  RepoTimelineNode,
  RateLimitInfo,
  RepoTimelineResult,
  FetchRepoTimelineArgs,
} from "./githubTypes";
import { TOKEN_REFRESH_BUFFER_MS, MIN_BACKFILL_BUDGET } from "./githubTypes";

// Re-export types for backwards compatibility
export type {
  InstallationToken,
  RepoTimelineNode,
  RateLimitInfo,
  RepoTimelineResult,
  FetchRepoTimelineArgs,
};
export { TOKEN_REFRESH_BUFFER_MS, MIN_BACKFILL_BUDGET };

const GITHUB_API_BASE = "https://api.github.com";
const INSTALLATIONS_ENDPOINT = `${GITHUB_API_BASE}/app/installations`;
const APP_JWT_TTL_MS = 8 * 60 * 1000; // 8 minutes to stay under GitHub's 10 min limit
const APP_JWT_SKEW_SECONDS = 30;
const SEARCH_PER_PAGE = 50;
const SEARCH_MAX_RESULTS = 1000;

type TokenCache = {
  token: string;
  expiresAt: number;
};

const appJwtCache: TokenCache = {
  token: "",
  expiresAt: 0,
};

const installationTokenCache = new Map<number, TokenCache>();

/**
 * Replace literal \n sequences with actual newlines so Convex env vars work.
 */
function normalizePrivateKey(key: string): string {
  if (key.includes("-----BEGIN")) {
    return key.replace(/\\n/g, "\n");
  }

  return key;
}

function requireAppConfig(): { appId: string; privateKey: string } {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured");
  }

  return { appId, privateKey: normalizePrivateKey(privateKey) };
}

/**
 * Build (and cache) the GitHub App JWT used for authenticating installation token requests.
 */
function buildAppJwt(): string {
  const now = Date.now();

  if (appJwtCache.token && appJwtCache.expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return appJwtCache.token;
  }

  const { appId, privateKey } = requireAppConfig();

  const iat = Math.floor(now / 1000) - APP_JWT_SKEW_SECONDS;
  const exp = Math.floor((now + APP_JWT_TTL_MS) / 1000);

  const token = signJwt(
    {
      iat,
      exp,
      iss: appId,
    },
    privateKey,
    {
      algorithm: "RS256",
    }
  );

  appJwtCache.token = token;
  appJwtCache.expiresAt = now + APP_JWT_TTL_MS;

  return token;
}

/**
 * Mint (and cache) a GitHub App installation access token.
 */
export async function mintInstallationToken(
  installationId: number
): Promise<InstallationToken> {
  const cached = installationTokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return cached;
  }

  const appJwt = buildAppJwt();

  const response = await fetch(`${INSTALLATIONS_ENDPOINT}/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${appJwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to mint installation token (${response.status}): ${body || response.statusText}`
    );
  }

  const payload = (await response.json()) as {
    token: string;
    expires_at: string;
  };

  const expiresAt = new Date(payload.expires_at).getTime();
  const token: InstallationToken = { token: payload.token, expiresAt };

  installationTokenCache.set(installationId, token);

  return token;
}

/**
 * Call GitHub's Search API to fetch issue + PR timelines for a repository window.
 */
export async function fetchRepoTimeline(
  args: FetchRepoTimelineArgs
): Promise<RepoTimelineResult> {
  const { repoFullName, sinceISO, untilISO, cursor, token, etag } = args;

  if (!repoFullName.includes("/")) {
    throw new Error(`Invalid repo format: ${repoFullName}`);
  }

  const page = cursor ? Math.max(Number(cursor), 1) : 1;
  const queryParts = [`repo:${repoFullName}`, `updated:>=${sinceISO}`];
  if (untilISO) {
    queryParts.push(`updated:<${untilISO}`);
  }

  const searchParams = new URLSearchParams({
    q: queryParts.join(" "),
    sort: "updated",
    order: "asc",
    per_page: SEARCH_PER_PAGE.toString(),
    page: page.toString(),
  });

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(`${GITHUB_API_BASE}/search/issues?${searchParams.toString()}`, {
    method: "GET",
    headers,
  });

  const rateLimit = parseRateLimit(response.headers);
  const responseEtag = response.headers.get("etag");

  if (response.status === 304) {
    return {
      nodes: [],
      hasNextPage: false,
      endCursor: cursor,
      etag: responseEtag ?? etag,
      totalCount: 0,
      rateLimit,
      notModified: true,
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `GitHub search error (${response.status}): ${errText || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    total_count: number;
    items: Array<any>;
  };

  const nodes: RepoTimelineNode[] = data.items.map((item) => ({
    __typename: item.pull_request ? "PullRequest" : "Issue",
    id: item.node_id ?? String(item.id ?? item.url),
    number: item.number,
    title: item.title,
    body: item.body,
    state: item.state,
    url: item.html_url,
    updatedAt: item.updated_at,
    actor: item.user
      ? {
          id: item.user.id,
          login: item.user.login,
          nodeId: item.user.node_id,
        }
      : null,
  }));

  const cappedTotal = Math.min(data.total_count ?? 0, SEARCH_MAX_RESULTS);
  const couldHaveMore = nodes.length === SEARCH_PER_PAGE && page * SEARCH_PER_PAGE < cappedTotal;
  const endCursor = couldHaveMore ? String(page + 1) : undefined;

  return {
    nodes,
    endCursor,
    hasNextPage: !!endCursor,
    etag: responseEtag,
    totalCount: data.total_count ?? 0,
    rateLimit,
  };
}

export function parseRateLimit(headers: Headers): RateLimitInfo {
  const remainingHeader = headers.get("x-ratelimit-remaining");
  const resetHeader = headers.get("x-ratelimit-reset");

  const result: RateLimitInfo = {};

  if (remainingHeader !== null) {
    const parsed = Number(remainingHeader);
    if (!Number.isNaN(parsed)) {
      result.remaining = parsed;
    }
  }

  if (resetHeader !== null) {
    const parsed = Number(resetHeader);
    if (!Number.isNaN(parsed)) {
      result.reset = parsed * 1000;
    }
  }

  return result;
}

export function shouldPause(remaining?: number): boolean {
  if (typeof remaining !== "number") {
    return false;
  }

  return remaining <= MIN_BACKFILL_BUDGET;
}

/**
 * Test-only helper to clear cached tokens.
 */
export function __resetGithubAppInternalState() {
  appJwtCache.token = "";
  appJwtCache.expiresAt = 0;
  installationTokenCache.clear();
}
