import { describe, expect, test } from "bun:test";

import { guardAgentRoute } from "./agent-route-guard";

describe("guardAgentRoute", () => {
  test("allows local development when no shared secret is configured", () => {
    expect(
      guardAgentRoute({
        allowUnauthenticated: false,
        nodeEnv: "development",
      }),
    ).toBeNull();
  });

  test("requires the shared secret even outside production when configured", () => {
    expect(
      guardAgentRoute({
        allowUnauthenticated: false,
        nodeEnv: "preview",
        sharedSecret: "top-secret",
        requestSecret: null,
      }),
    ).toEqual({
      error: "Unauthorized agent route request.",
      status: 401,
    });
  });

  test("blocks production until explicitly enabled", () => {
    expect(
      guardAgentRoute({
        allowUnauthenticated: false,
        nodeEnv: "production",
      }),
    ).toEqual({
      error: "Agent route is disabled in production until auth is configured.",
      status: 503,
    });
  });

  test("allows production when explicit opt-in is set and the shared secret matches", () => {
    expect(
      guardAgentRoute({
        allowUnauthenticated: true,
        nodeEnv: "production",
        sharedSecret: "top-secret",
        requestSecret: "top-secret",
      }),
    ).toBeNull();
  });
});
