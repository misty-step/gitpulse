import jwt from "jsonwebtoken";
import {
  __resetGithubAppInternalState,
  fetchRepoTimeline,
  mintInstallationToken,
  MIN_BACKFILL_BUDGET,
} from "./githubApp";

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(() => "mock-app-jwt"),
  },
}));

const originalEnv = { ...process.env };

describe("githubApp helpers", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetGithubAppInternalState();
    (global.fetch as unknown) = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("mintInstallationToken", () => {
    it("throws if GitHub App credentials missing", async () => {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;

      await expect(mintInstallationToken(1234)).rejects.toThrow(
        "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured"
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("mints and caches installation tokens", async () => {
      process.env.GITHUB_APP_ID = "123";
      process.env.GITHUB_APP_PRIVATE_KEY =
        "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----";

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ token: "token-1", expires_at: expiresAt }),
        text: async () => "",
        headers: new Headers(),
      });

      const first = await mintInstallationToken(42);
      expect(first.token).toBe("token-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain("/app/installations/42/access_tokens");
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer mock-app-jwt");

      // Second call should hit cache (no extra fetch)
      const second = await mintInstallationToken(42);
      expect(second.token).toBe("token-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchRepoTimeline", () => {
    beforeEach(() => {
      process.env.GITHUB_APP_ID = "123";
      process.env.GITHUB_APP_PRIVATE_KEY =
        "-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----";
    });

    it("requests search API with If-None-Match headers and parses nodes", async () => {
      const headers = new Headers({
        etag: "W/\"etag-value\"",
        "x-ratelimit-remaining": String(MIN_BACKFILL_BUDGET + 10),
        "x-ratelimit-reset": "1234567890",
      });

      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers,
        json: async () => ({
          total_count: 2,
          items: [
            {
              node_id: "PR_kw",
              number: 12,
              title: "Add feature",
              pull_request: {},
              html_url: "https://github.com/test/repo/pull/12",
              user: { id: 1, login: "dev", node_id: "MDQ6VXNlcjE=" },
              updated_at: "2025-11-01T00:00:00Z",
            },
            {
              node_id: "IS_kw",
              number: 99,
              title: "Bug report",
              html_url: "https://github.com/test/repo/issues/99",
              user: { id: 2, login: "qa", node_id: "MDQ6VXNlcjI=" },
              updated_at: "2025-11-02T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      });

      const result = await fetchRepoTimeline({
        token: "installation-token",
        repoFullName: "test/repo",
        sinceISO: "2025-10-01T00:00:00Z",
        cursor: "1",
        etag: "W/\"old\"",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, requestInit] = fetchMock.mock.calls[0];
      expect(requestInit?.headers?.Authorization).toBe("Bearer installation-token");
      expect(requestInit?.headers?.["If-None-Match"]).toBe("W/\"old\"");
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].__typename).toBe("PullRequest");
      expect(result.nodes[1].__typename).toBe("Issue");
      expect(result.rateLimit.remaining).toBe(MIN_BACKFILL_BUDGET + 10);
      expect(result.rateLimit.reset).toBe(1234567890 * 1000);
    });
  });
});
