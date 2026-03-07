import { beforeEach, describe, expect, test } from "bun:test";

import type { ActivityEvent, Scope, TimeWindow } from "@gitpulse/schemas";

import {
  backoffWithJitter,
  runGitPulseAgent,
  type ActivitySource,
} from "./agent";

const WINDOW: TimeWindow = {
  from: "2026-03-01T00:00:00.000Z",
  to: "2026-03-05T00:00:00.000Z",
};

const SCOPE: Scope = {
  repos: ["misty-step/gitpulse"],
  orgs: [],
  contributors: [],
};

const EVENTS: ActivityEvent[] = [
  {
    type: "commit",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "feat: add architecture docs",
    url: "https://github.com/misty-step/gitpulse/commit/1",
    timestamp: "2026-03-02T10:00:00.000Z",
  },
  {
    type: "pull_request_opened",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "agentic rebuild",
    url: "https://github.com/misty-step/gitpulse/pull/10",
    timestamp: "2026-03-03T10:00:00.000Z",
  },
  {
    type: "pull_request_merged",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "agentic rebuild",
    url: "https://github.com/misty-step/gitpulse/pull/10",
    timestamp: "2026-03-04T10:00:00.000Z",
  },
  {
    type: "pull_request_reviewed",
    repo: "misty-step/gitpulse",
    actor: "reviewer",
    title: "Review on #10: agentic rebuild",
    url: "https://github.com/misty-step/gitpulse/pull/10#review-1",
    timestamp: "2026-03-04T12:00:00.000Z",
  },
];

const activitySource: ActivitySource = async () => ({
  scope: SCOPE,
  repos: SCOPE.repos,
  window: WINDOW,
  events: EVENTS,
  warnings: [],
});

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe("runGitPulseAgent", () => {
  test("returns zero retry delay when the configured base delay is zero", () => {
    expect(backoffWithJitter(0)).toBe(0);
  });

  test("adds bounded jitter to non-zero retry delays", () => {
    expect(backoffWithJitter(300, () => 0.5)).toBe(350);
  });

  test("returns deterministic metrics and citations without LLM key", async () => {
    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: SCOPE,
      activitySource,
    });

    expect(answer.metrics.totalEvents).toBe(4);
    expect(answer.metrics.commitCount).toBe(1);
    expect(answer.metrics.pullRequestOpenedCount).toBe(1);
    expect(answer.metrics.pullRequestMergedCount).toBe(1);
    expect(answer.metrics.reviewCount).toBe(1);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answer).toContain("Observed 4 total events");
    expect(answer.blocks.some((block) => block.type === "metric_grid")).toBe(
      true
    );
  });

  test("surfaces activity source failures", async () => {
    const failingSource: ActivitySource = async () => {
      throw new Error("GitHub exploded");
    };

    await expect(
      runGitPulseAgent({
        question: "What happened this week?",
        window: WINDOW,
        scope: SCOPE,
        activitySource: failingSource,
      })
    ).rejects.toThrow("GitHub exploded");
  });

  test("falls back deterministically when the narrative generator reports empty output", async () => {
    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: SCOPE,
      activitySource,
      narrativeGenerator: async () => ({
        text: null,
        warnings: ["LLM returned empty narrative output; using deterministic fallback."],
      }),
    });

    expect(answer.answer).toContain("Observed 4 total events");
    expect(answer.answer).toContain("LLM returned empty narrative output; using deterministic fallback.");
  });

  test("uses narrative output when the narrative generator succeeds", async () => {
    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: SCOPE,
      activitySource,
      narrativeGenerator: async () => ({
        text: "Narrative response from LLM.",
        warnings: [],
      }),
    });

    expect(answer.answer).toBe("Narrative response from LLM.");
    expect(answer.blocks.some((block) => block.type === "insight_list")).toBe(false);
  });

  test("describes empty repo and org scope truthfully in fallback output", async () => {
    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: {},
      activitySource: async () => ({
        scope: { repos: [], orgs: [], contributors: [] },
        repos: [],
        window: WINDOW,
        events: [],
        warnings: ["No repositories resolved from scope."],
      }),
    });

    expect(answer.answer).toContain("Scope: repos=none, orgs=none, contributors=all");
  });

  test("renders concrete scope values instead of ambiguous counts in fallback output", async () => {
    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: {
        repos: ["misty-step/gitpulse", "misty-step/overmind"],
        orgs: ["misty-step"],
        contributors: ["phaedrus", "reviewer"],
      },
      activitySource,
    });

    expect(answer.answer).toContain(
      "Scope: repos=misty-step/gitpulse, misty-step/overmind, orgs=misty-step, contributors=phaedrus, reviewer",
    );
  });

  test("caps exported events without changing computed metrics", async () => {
    const oversizedEvents = Array.from({ length: 120 }, (_, index) => ({
      type: "commit" as const,
      repo: "misty-step/gitpulse",
      actor: "phaedrus",
      title: `commit-${index}`,
      url: `https://github.com/misty-step/gitpulse/commit/${index}`,
      timestamp: new Date(Date.parse(WINDOW.from) + index * 60_000).toISOString(),
    }));

    const answer = await runGitPulseAgent({
      question: "What happened this week?",
      window: WINDOW,
      scope: SCOPE,
      activitySource: async () => ({
        scope: SCOPE,
        repos: SCOPE.repos,
        window: WINDOW,
        events: oversizedEvents,
        warnings: [],
      }),
    });

    expect(answer.metrics.totalEvents).toBe(120);
    expect(answer.events).toHaveLength(100);
    expect(answer.events[0]?.title).toBe("commit-0");
    expect(answer.events[99]?.title).toBe("commit-99");
  });
});
