import { afterEach, describe, expect, mock, test } from "bun:test";

import { GitHubClient, GitHubError } from "./client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("GitHubClient", () => {
  test("maps non-ok responses to GitHubError", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response('{"message":"missing"}', {
          status: 404,
          statusText: "Not Found",
          headers: {
            "content-type": "application/json",
          },
        }),
    ) as unknown as typeof fetch;

    const client = new GitHubClient({ baseUrl: "https://api.github.com" });

    await expect(client.getJson("/repos/misty-step/gitpulse")).rejects.toBeInstanceOf(GitHubError);
    await expect(client.getJson("/repos/misty-step/gitpulse")).rejects.toMatchObject({
      status: 404,
      path: "/repos/misty-step/gitpulse",
    });
  });

  test("follows pagination until the next link disappears", async () => {
    globalThis.fetch = mock(async (input) => {
      const url = String(input);

      if (url.endsWith("page=1")) {
        return new Response(JSON.stringify([{ id: 1 }]), {
          headers: {
            "content-type": "application/json",
            link: '<https://api.github.com/items?page=2>; rel="next"',
          },
        });
      }

      if (url.endsWith("page=2")) {
        return new Response(JSON.stringify([{ id: 2 }]), {
          headers: {
            "content-type": "application/json",
            link: '<not a url>; rel="next"',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const client = new GitHubClient({ baseUrl: "https://api.github.com" });
    const items = await client.getPagedJson<{ id: number }>("/items?page=1", { maxPages: 3 });

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  test("converts aborted fetches into timeout GitHubError", async () => {
    globalThis.fetch = mock(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Missing abort signal"));
            return;
          }

          const abort = () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          };

          if (signal.aborted) {
            abort();
            return;
          }

          signal.addEventListener("abort", abort, { once: true });
        }),
    ) as unknown as typeof fetch;

    const client = new GitHubClient({
      baseUrl: "https://api.github.com",
      timeoutMs: 5,
    });

    await expect(client.getJson("/slow")).rejects.toMatchObject({
      status: 408,
      path: "/slow",
      message: "GitHub request timed out after 5ms",
    });
  });
});
