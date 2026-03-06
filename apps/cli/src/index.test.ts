import { describe, expect, test } from "bun:test";

import { parseArgs } from "./index";

describe("parseArgs", () => {
  test("parses inline flags and csv values", () => {
    const parsed = parseArgs([
      "ask",
      "what",
      "shipped",
      "--from=2026-03-01T00:00:00Z",
      "--to=2026-03-05T00:00:00Z",
      "--repos=misty-step/gitpulse,misty-step/overmind",
      "--contributors=phaedrus,reviewer",
      "--model=google/gemini-2.5-pro",
      "--json",
    ]);

    expect(parsed.question).toBe("what shipped");
    expect(parsed.from).toBe("2026-03-01T00:00:00.000Z");
    expect(parsed.to).toBe("2026-03-05T00:00:00.000Z");
    expect(parsed.repos).toEqual(["misty-step/gitpulse", "misty-step/overmind"]);
    expect(parsed.contributors).toEqual(["phaedrus", "reviewer"]);
    expect(parsed.modelId).toBe("google/gemini-2.5-pro");
    expect(parsed.json).toBe(true);
  });

  test("returns help when no command is provided", () => {
    const parsed = parseArgs([]);

    expect(parsed.command).toBe("help");
    expect(parsed.question).toBe("");
  });

  test("throws on missing question", () => {
    expect(() => parseArgs(["ask", "--json"])).toThrow(
      'A question is required. Example: gitpulse ask "what happened last week"',
    );
  });

  test("throws on invalid dates", () => {
    expect(() => parseArgs(["ask", "what", "changed", "--from", "not-a-date"])).toThrow(
      "Invalid date value: not-a-date",
    );
  });
});
