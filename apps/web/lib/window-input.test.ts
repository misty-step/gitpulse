import { describe, expect, test } from "bun:test";

import { parseWindowInput } from "./window-input";

describe("parseWindowInput", () => {
  test("returns normalized iso timestamps for valid input", () => {
    expect(parseWindowInput("2026-03-01T00:00:00Z", "2026-03-05T00:00:00Z")).toEqual({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-05T00:00:00.000Z",
    });
  });

  test("returns a friendly error for invalid input", () => {
    expect(parseWindowInput("", "2026-03-05T00:00:00Z")).toEqual({
      error: "Please enter valid ISO date values for From and To.",
    });
  });

  test("returns a friendly error for reversed windows", () => {
    expect(parseWindowInput("2026-03-10T00:00:00Z", "2026-03-05T00:00:00Z")).toEqual({
      error: '"From" date must be before or equal to "To" date.',
    });
  });
});
