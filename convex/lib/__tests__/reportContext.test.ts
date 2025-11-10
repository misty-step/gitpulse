import { describe, expect, it } from "@jest/globals";
import type { Doc, Id } from "../../_generated/dataModel";
import { buildReportContext } from "../reportContext";

function createEvent(overrides: Partial<Doc<"events">> = {}): Doc<"events"> {
  return {
    _id: (`event_${Math.random()}`) as Id<"events">,
    _creationTime: Date.now(),
    type: "pr_opened",
    actorId: "user_1" as Id<"users">,
    repoId: "repo_1" as Id<"repos">,
    ts: Date.now(),
    metadata: {},
    createdAt: Date.now(),
    contentScope: "event",
    ...overrides,
  };
}

function createRepo(overrides: Partial<Doc<"repos">> = {}): Doc<"repos"> {
  return {
    _id: "repo_1" as Id<"repos">,
    _creationTime: Date.now(),
    ghId: 1,
    ghNodeId: "node",
    fullName: "acme/gitpulse",
    name: "gitpulse",
    owner: "acme",
    url: "https://github.com/acme/gitpulse",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    ghCreatedAt: Date.now(),
    ghUpdatedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("buildReportContext", () => {
  it("normalizes sourceUrl values into timeline + allowed URLs", () => {
    const event = createEvent({
      sourceUrl: "https://github.com/acme/gitpulse/pull/123/",
      ts: Date.now(),
    });

    const { timeline, allowedUrls } = buildReportContext({
      events: [event],
      reposById: new Map([[event.repoId, createRepo()]]),
      startDate: event.ts - 1000,
      endDate: event.ts + 1000,
      maxTimelineEvents: 5,
    });

    expect(timeline[0]?.url).toBe("https://github.com/acme/gitpulse/pull/123");
    expect(allowedUrls).toEqual([
      "https://github.com/acme/gitpulse/pull/123",
    ]);
  });

  it("respects maxTimelineEvents override and surfaces canonicalText", () => {
    const older = createEvent({
      _id: "event_old" as Id<"events">,
      ts: Date.now() - 1000,
      canonicalText: "Older event canonical",
    });
    const newer = createEvent({
      _id: "event_new" as Id<"events">,
      ts: Date.now(),
      canonicalText: "New canonical",
    });
    const newest = createEvent({
      _id: "event_newest" as Id<"events">,
      ts: Date.now() + 1000,
      canonicalText: "Newest canonical",
    });

    const { timeline } = buildReportContext({
      events: [older, newer, newest],
      reposById: new Map([[newest.repoId, createRepo()]]),
      startDate: older.ts - 1000,
      endDate: newest.ts + 1000,
      maxTimelineEvents: 2,
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.id).toBe("event_newest");
    expect(timeline[0]?.canonicalText).toBe("Newest canonical");
    expect(timeline[1]?.canonicalText).toBe("New canonical");
  });
});
