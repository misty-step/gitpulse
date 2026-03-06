import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { z } from "zod";

const runGitPulseAgent = mock(async () => ({
  answer: "ok",
  citations: [],
  blocks: [],
  metrics: {
    totalEvents: 0,
    commitCount: 0,
    pullRequestOpenedCount: 0,
    pullRequestMergedCount: 0,
    reviewCount: 0,
    contributors: [],
    repos: [],
  },
  events: [],
}));

mock.module("@gitpulse/agent-core", () => ({
  runGitPulseAgent,
}));

const { POST } = await import("./route");
const env = process.env as Record<string, string | undefined>;

const originalEnv = {
  nodeEnv: env.NODE_ENV,
  allowUnauthenticated: env.GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE,
  sharedSecret: env.GITPULSE_AGENT_ROUTE_SHARED_SECRET,
  githubToken: env.GITHUB_TOKEN,
};

function createRequest(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("POST /api/agent", () => {
  beforeEach(() => {
    env.NODE_ENV = "development";
    delete env.GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE;
    delete env.GITPULSE_AGENT_ROUTE_SHARED_SECRET;
    delete env.GITHUB_TOKEN;
    runGitPulseAgent.mockReset();
    runGitPulseAgent.mockImplementation(async () => ({
      answer: "ok",
      citations: [],
      blocks: [],
      metrics: {
        totalEvents: 0,
        commitCount: 0,
        pullRequestOpenedCount: 0,
        pullRequestMergedCount: 0,
        reviewCount: 0,
        contributors: [],
        repos: [],
      },
      events: [],
    }));
  });

  afterEach(() => {
    mock.restore();
    if (originalEnv.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalEnv.nodeEnv;
    if (originalEnv.allowUnauthenticated === undefined) delete env.GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE;
    else env.GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE = originalEnv.allowUnauthenticated;
    if (originalEnv.sharedSecret === undefined) delete env.GITPULSE_AGENT_ROUTE_SHARED_SECRET;
    else env.GITPULSE_AGENT_ROUTE_SHARED_SECRET = originalEnv.sharedSecret;
    if (originalEnv.githubToken === undefined) delete env.GITHUB_TOKEN;
    else env.GITHUB_TOKEN = originalEnv.githubToken;
  });

  test("returns agent output for valid requests", async () => {
    env.GITHUB_TOKEN = "ghs_test";

    const response = await POST(
      createRequest(
        JSON.stringify({
          question: "What happened this week?",
          window: {
            from: "2026-03-01T00:00:00Z",
            to: "2026-03-05T00:00:00Z",
          },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(runGitPulseAgent).toHaveBeenCalledWith({
      question: "What happened this week?",
      window: {
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-05T00:00:00Z",
      },
      scope: undefined,
      githubToken: "ghs_test",
    });
    expect(await response.json()).toEqual({
      answer: "ok",
      citations: [],
      blocks: [],
      metrics: {
        totalEvents: 0,
        commitCount: 0,
        pullRequestOpenedCount: 0,
        pullRequestMergedCount: 0,
        reviewCount: 0,
        contributors: [],
        repos: [],
      },
      events: [],
    });
  });

  test("returns 400 for invalid json", async () => {
    const response = await POST(createRequest("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON payload." });
    expect(runGitPulseAgent).not.toHaveBeenCalled();
  });

  test("returns formatted zod validation errors", async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({
          question: "no",
          window: {
            from: "2026-03-05T00:00:00Z",
            to: "2026-03-01T00:00:00Z",
          },
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "question: String must contain at least 3 character(s), window.from: from must be <= to",
    });
    expect(runGitPulseAgent).not.toHaveBeenCalled();
  });

  test("wires the production guard before invoking the agent", async () => {
    env.NODE_ENV = "production";

    const response = await POST(
      createRequest(
        JSON.stringify({
          question: "What happened this week?",
          window: {
            from: "2026-03-01T00:00:00Z",
            to: "2026-03-05T00:00:00Z",
          },
        }),
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Agent route is disabled in production until auth is configured.",
    });
    expect(runGitPulseAgent).not.toHaveBeenCalled();
  });

  test("returns 500 for unexpected failures", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    runGitPulseAgent.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const response = await POST(
      createRequest(
        JSON.stringify({
          question: "What happened this week?",
          window: {
            from: "2026-03-01T00:00:00Z",
            to: "2026-03-05T00:00:00Z",
          },
        }),
      ),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error." });
    expect(errorSpy).toHaveBeenCalled();
  });

  test("returns 500 when the agent raises an internal zod validation error", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    runGitPulseAgent.mockImplementationOnce(async () => {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.invalid_string,
          validation: "url",
          path: ["events", 0, "url"],
          message: "Invalid url",
        },
      ]);
    });

    const response = await POST(
      createRequest(
        JSON.stringify({
          question: "What happened this week?",
          window: {
            from: "2026-03-01T00:00:00Z",
            to: "2026-03-05T00:00:00Z",
          },
        }),
      ),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error." });
    expect(errorSpy).toHaveBeenCalled();
  });
});
