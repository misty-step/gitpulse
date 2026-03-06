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
  baseUrl?: string;
  timeoutMs?: number;
};

type GitHubHeaders = Record<string, string>;

export class GitHubClient {
  private readonly token?: string;
  private readonly userAgent: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
    this.userAgent = options.userAgent ?? "gitpulse-agentic/0.2";
    this.baseUrl = options.baseUrl ?? process.env.GITPULSE_GITHUB_API_BASE ?? "https://api.github.com";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await this.request(path);

    if (!response.ok) {
      const body = summarizeErrorBody(await response.text());
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
      const response = await this.request(nextPath);

      if (!response.ok) {
        const body = summarizeErrorBody(await response.text());
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

  private headers(): GitHubHeaders {
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async request(path: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers(),
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new GitHubError(408, path, `GitHub request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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

function summarizeErrorBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 200) {
    return normalized;
  }

  return `${normalized.slice(0, 197)}...`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
