import { describe, expect, test } from "bun:test";

import { ScopeSchema, TimeWindowSchema, normalizeScope } from "./index";

describe("schemas", () => {
  test("validates time window ordering", () => {
    expect(() => {
      TimeWindowSchema.parse({
        from: "2026-01-10T00:00:00.000Z",
        to: "2026-01-01T00:00:00.000Z",
      });
    }).toThrow();
  });

  test("normalizes and deduplicates scope", () => {
    const scope = normalizeScope({
      repos: ["misty-step/gitpulse", "misty-step/gitpulse", ""],
      orgs: ["misty-step", " misty-step "],
      contributors: ["phaedrus", "phaedrus"],
    });

    expect(scope).toEqual({
      repos: ["misty-step/gitpulse"],
      orgs: ["misty-step"],
      contributors: ["phaedrus"],
    });

    expect(() => ScopeSchema.parse(scope)).not.toThrow();
  });
});
