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
      if (url.includes("/commits?") || url.includes("/pulls?")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
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

      if (url.includes("/pulls?")) {
        return new Response(
          JSON.stringify([
            {
              number: 42,
              title: "deleted author PR",
              html_url: "https://github.com/misty-step/gitpulse/pull/42",
              created_at: "2026-03-02T10:00:00.000Z",
              merged_at: null,
              user: null,
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
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
});
