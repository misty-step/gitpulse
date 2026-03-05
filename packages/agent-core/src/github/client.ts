const GITHUB_API_BASE = process.env.GITPULSE_GITHUB_API_BASE ?? "https://api.github.com";

export class GitHubError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.path = path;
  }
}

export type GitHubClientOptions = {
  token?: string;
  userAgent?: string;
};

export class GitHubClient {
  private readonly token?: string;
  private readonly userAgent: string;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
    this.userAgent = options.userAgent ?? "gitpulse-agentic/0.2";
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new GitHubError(
        response.status,
        path,
        `GitHub request failed: ${response.status} ${response.statusText} ${body}`,
      );
    }

    return (await response.json()) as T;
  }

  async getPagedJson<T>(path: string, options: { maxPages?: number } = {}): Promise<T[]> {
    const maxPages = options.maxPages ?? 3;
    const items: T[] = [];
    let pageCount = 0;
    let nextPath: string | null = path;

    while (nextPath && pageCount < maxPages) {
      const response = await fetch(`${GITHUB_API_BASE}${nextPath}`, {
        headers: this.headers(),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new GitHubError(
          response.status,
          nextPath,
          `GitHub request failed: ${response.status} ${response.statusText} ${body}`,
        );
      }

      const pageItems = (await response.json()) as T[];
      items.push(...pageItems);
      nextPath = parseNextPath(response.headers.get("link"));
      pageCount += 1;
    }

    return items;
  }

  private headers(): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }
}

function parseNextPath(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const nextPart = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));

  if (!nextPart) {
    return null;
  }

  const match = nextPart.match(/<([^>]+)>/);
  if (!match?.[1]) {
    return null;
  }

  const url = new URL(match[1]);
  return `${url.pathname}${url.search}`;
}
