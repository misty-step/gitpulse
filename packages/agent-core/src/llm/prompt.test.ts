import { describe, expect, test } from "bun:test";

import type { Scope, TimeWindow } from "@gitpulse/schemas";

import { buildAgentUserPrompt } from "./prompt";

const WINDOW: TimeWindow = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-05T00:00:00.000Z",
};

describe("buildAgentUserPrompt", () => {
  test("uses none for empty repo and org scope", () => {
    const scope: Scope = {
      repos: [],
      orgs: [],
      contributors: [],
    };

    const prompt = buildAgentUserPrompt({
      question: "What changed?",
      scope,
      window: WINDOW,
    });

    expect(prompt).toContain("Scope: repos=(none), orgs=(none), contributors=(all)");
  });
});
