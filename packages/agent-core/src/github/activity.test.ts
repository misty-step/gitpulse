import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { TimeWindow } from "@gitpulse/schemas";

import { fetchActivityWindow } from "./activity";

const WINDOW: TimeWindow = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-05T00:00:00.000Z",
};

const originalFetch = globalThis.fetch;

describe("fetchActivityWindow", () => {
  beforeEach(() => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/commits?")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/search/issues?")) {
        return jsonResponse({
          total_count: 0,
          incomplete_results: false,
          items: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("clamps maxRepos to a sane minimum before slicing explicit repos", async () => {
    const result = await fetchActivityWindow({
      window: WINDOW,
      scope: { repos: ["misty-step/gitpulse"] },
      maxRepos: 0,
    });

    expect(result.repos).toEqual(["misty-step/gitpulse"]);
    expect(result.warnings).toEqual([]);
  });

  test("maps deleted pull request authors to ghost instead of throwing", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/commits?")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/search/issues?") && (url.includes("merged%3A") || url.includes("updated%3A"))) {
        return jsonResponse({
          total_count: 0,
          incomplete_results: false,
          items: [],
        });
      }

      if (url.includes("/search/issues?") && url.includes("created%3A")) {
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              number: 42,
              title: "deleted author PR",
              html_url: "https://github.com/misty-step/gitpulse/pull/42",
              created_at: "2026-03-02T10:00:00.000Z",
              closed_at: null,
              updated_at: "2026-03-02T10:00:00.000Z",
              user: null,
              pull_request: {},
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await fetchActivityWindow({
      window: WINDOW,
      scope: { repos: ["misty-step/gitpulse"] },
    });

    expect(result.events).toEqual([
      {
        type: "pull_request_opened",
        repo: "misty-step/gitpulse",
        actor: "ghost",
        title: "deleted author PR",
        url: "https://github.com/misty-step/gitpulse/pull/42",
        timestamp: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  test("collects PR opened and merged events from window-correct search results", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/commits?")) {
        return jsonResponse([]);
      }

      if (url.includes("/search/issues?") && url.includes("created%3A")) {
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              number: 77,
              title: "search-opened pr",
              html_url: "https://github.com/misty-step/gitpulse/pull/77",
              created_at: "2026-03-03T09:00:00.000Z",
              closed_at: null,
              updated_at: "2026-03-06T09:00:00.000Z",
              user: { login: "phaedrus" },
              pull_request: {},
            },
          ],
        });
      }

      if (url.includes("/search/issues?") && url.includes("merged%3A")) {
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              number: 78,
              title: "search-merged pr",
              html_url: "https://github.com/misty-step/gitpulse/pull/78",
              created_at: "2026-02-25T09:00:00.000Z",
              closed_at: "2026-03-04T12:30:00.000Z",
              updated_at: "2026-03-04T12:30:00.000Z",
              user: { login: "phaedrus" },
              pull_request: {},
            },
          ],
        });
      }

      if (url.includes("/search/issues?") && url.includes("updated%3A")) {
        return jsonResponse({
          total_count: 0,
          incomplete_results: false,
          items: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await fetchActivityWindow({
      window: WINDOW,
      scope: { repos: ["misty-step/gitpulse"] },
    });

    expect(result.events).toEqual([
      {
        type: "pull_request_merged",
        repo: "misty-step/gitpulse",
        actor: "phaedrus",
        title: "search-merged pr",
        url: "https://github.com/misty-step/gitpulse/pull/78",
        timestamp: "2026-03-04T12:30:00.000Z",
      },
      {
        type: "pull_request_opened",
        repo: "misty-step/gitpulse",
        actor: "phaedrus",
        title: "search-opened pr",
        url: "https://github.com/misty-step/gitpulse/pull/77",
        timestamp: "2026-03-03T09:00:00.000Z",
      },
    ]);
  });

  test("collects reviews from PRs updated in-window even when the PR was opened outside the window", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/commits?")) {
        return jsonResponse([]);
      }

      if (url.includes("/search/issues?") && (url.includes("created%3A") || url.includes("merged%3A"))) {
        return jsonResponse({
          total_count: 0,
          incomplete_results: false,
          items: [],
        });
      }

      if (url.includes("/search/issues?") && url.includes("updated%3A")) {
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              number: 91,
              title: "stale PR with fresh review",
              html_url: "https://github.com/misty-step/gitpulse/pull/91",
              created_at: "2026-02-20T09:00:00.000Z",
              closed_at: null,
              updated_at: "2026-03-04T08:00:00.000Z",
              user: { login: "author" },
              pull_request: {},
            },
          ],
        });
      }

      if (url.includes("/pulls/91/reviews?")) {
        return jsonResponse([
          {
            html_url: "https://github.com/misty-step/gitpulse/pull/91#pullrequestreview-1",
            submitted_at: "2026-03-04T08:00:00.000Z",
            user: { login: "reviewer" },
          },
        ]);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await fetchActivityWindow({
      window: WINDOW,
      scope: { repos: ["misty-step/gitpulse"], contributors: ["reviewer"] },
    });

    expect(result.events).toEqual([
      {
        type: "pull_request_reviewed",
        repo: "misty-step/gitpulse",
        actor: "reviewer",
        title: "Review on #91: stale PR with fresh review",
        url: "https://github.com/misty-step/gitpulse/pull/91#pullrequestreview-1",
        timestamp: "2026-03-04T08:00:00.000Z",
      },
    ]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
