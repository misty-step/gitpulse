import { describe, expect, test } from "bun:test";

import type { ActivityEvent } from "@gitpulse/schemas";

import { computeMetrics } from "./metrics";

const EVENTS: ActivityEvent[] = [
  {
    type: "commit",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "feat: add cli",
    url: "https://github.com/misty-step/gitpulse/commit/1",
    timestamp: "2026-03-01T10:00:00.000Z",
  },
  {
    type: "pull_request_opened",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "Agentic pivot",
    url: "https://github.com/misty-step/gitpulse/pull/1",
    timestamp: "2026-03-01T12:00:00.000Z",
  },
  {
    type: "pull_request_reviewed",
    repo: "misty-step/gitpulse",
    actor: "reviewer",
    title: "Looks good",
    url: "https://github.com/misty-step/gitpulse/pull/1#review-1",
    timestamp: "2026-03-01T13:00:00.000Z",
  },
  {
    type: "pull_request_merged",
    repo: "misty-step/gitpulse",
    actor: "phaedrus",
    title: "Agentic pivot",
    url: "https://github.com/misty-step/gitpulse/pull/1",
    timestamp: "2026-03-01T15:00:00.000Z",
  },
];

describe("computeMetrics", () => {
  test("aggregates totals by event type, contributor, and repo", () => {
    const metrics = computeMetrics(EVENTS);

    expect(metrics.totalEvents).toBe(4);
    expect(metrics.commitCount).toBe(1);
    expect(metrics.pullRequestOpenedCount).toBe(1);
    expect(metrics.pullRequestMergedCount).toBe(1);
    expect(metrics.reviewCount).toBe(1);

    expect(metrics.contributors[0]).toEqual({
      login: "phaedrus",
      eventCount: 3,
    });

    expect(metrics.repos[0]).toEqual({
      repo: "misty-step/gitpulse",
      commitCount: 1,
      pullRequestOpenedCount: 1,
      pullRequestMergedCount: 1,
      reviewCount: 1,
      totalEvents: 4,
    });
  });
});
