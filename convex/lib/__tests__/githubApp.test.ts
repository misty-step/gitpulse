import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import {
  MIN_BACKFILL_BUDGET,
  __resetGithubAppInternalState,
  fetchRepoTimeline,
  mintInstallationToken,
  parseRateLimit,
  shouldPause,
} from "../githubApp";

jest.mock("jsonwebtoken", () => {
  const mockSign = jest.fn(() => "signed-jwt");
  return {
    __esModule: true,
    default: { sign: mockSign },
    sign: mockSign,
    __mockedSign: mockSign,
  };
});

const { __mockedSign: signMock } = jest.requireMock("jsonwebtoken") as {
  __mockedSign: jest.Mock;
};

beforeEach(() => {
  __resetGithubAppInternalState();
  signMock.mockClear();
  process.env.GITHUB_APP_ID = "123";
  process.env.GITHUB_APP_PRIVATE_KEY =
    "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";
});

describe("mintInstallationToken", () => {
  it("caches installation tokens until near expiry", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const fetchMock = createAsyncMock<unknown, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({ token: "token-1", expires_at: expiresAt }),
      text: async () => "",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = await mintInstallationToken(42);
    const second = await mintInstallationToken(42);

    expect(first.token).toBe("token-1");
    expect(second.token).toBe("token-1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const mockFetch = global.fetch as jest.Mock;
    const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((requestInit?.headers as any)?.Authorization).toBe(
      "Bearer signed-jwt",
    );
  });
});

describe("fetchRepoTimeline", () => {
  it("sends conditional requests and surfaces notModified", async () => {
    const headers = new Headers({
      etag: '"etag-123"',
      "x-ratelimit-remaining": "400",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 1000),
    });

    const fetchMock = createAsyncMock<unknown, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue({
      status: 304,
      ok: false,
      headers,
      text: async () => "",
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchRepoTimeline({
      token: "token",
      repoFullName: "acme/gitpulse",
      sinceISO: new Date().toISOString(),
      cursor: "2",
      etag: '"etag-123"',
    });

    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('"etag-123"');
    const mockFetch = global.fetch as jest.Mock;
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init?.headers as any)?.["If-None-Match"]).toBe('"etag-123"');
  });

  it("returns nodes and pagination metadata", async () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "100",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
    });

    const fetchMock = createAsyncMock<unknown, Parameters<typeof fetch>>();
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers,
      json: async () => [
        {
          id: 1,
          node_id: "MDQ6",
          title: "Fix bug",
          html_url: "https://github.com/acme/gitpulse/pull/1",
          updated_at: new Date().toISOString(),
          user: { id: 7, login: "octocat", node_id: "MDQ6U" },
        },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchRepoTimeline({
      token: "token",
      repoFullName: "acme/gitpulse",
      sinceISO: new Date().toISOString(),
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.hasNextPage).toBe(false);
    expect(result.rateLimit.remaining).toBe(100);
  });
});

describe("rate limit helpers", () => {
  it("parses headers and determines pause threshold", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "90",
      "x-ratelimit-reset": "1700000000",
    });
    const info = parseRateLimit(headers);
    expect(info.remaining).toBe(90);
    expect(info.reset).toBe(1700000000 * 1000);
    expect(shouldPause(info.remaining)).toBe(true);
    expect(shouldPause(MIN_BACKFILL_BUDGET + 1)).toBe(false);
  });
});
