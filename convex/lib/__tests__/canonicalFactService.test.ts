import { describe, expect, it, jest } from "@jest/globals";
import type { Id } from "../../_generated/dataModel";
import type { CanonicalEvent } from "../canonicalizeEvent";
import { persistCanonicalEvent } from "../canonicalFactService";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { internal } from "../../_generated/api";

jest.mock("../../_generated/api", () => ({
  api: {
    users: { upsert: "api.users.upsert" },
    repos: { upsert: "api.repos.upsert" },
  },
  internal: {
    events: {
      getByContentHash: "internal.events.getByContentHash",
      upsertCanonical: "internal.events.upsertCanonical",
    },
    embeddingQueue: {
      enqueue: "internal.embeddingQueue.enqueue",
    },
    actions: {
      embeddings: {
        ensureBatch: {
          ensureBatch: "internal.actions.embeddings.ensureBatch",
        },
      },
    },
  },
}));

jest.mock("../metrics", () => ({
  emitMetric: jest.fn(),
}));

function buildCanonicalEvent(): CanonicalEvent {
  return {
    type: "pr_opened",
    repo: {
      fullName: "acme/gitpulse",
      owner: "acme",
      name: "gitpulse",
      ghId: 42,
      ghNodeId: "MDQ6R2l0aHViUmVwby00Mg==",
      url: "https://github.com/acme/gitpulse",
    },
    actor: {
      ghId: 7,
      ghLogin: "octocat",
      ghNodeId: "MDQ6VXNlcjct",
    },
    ts: Date.now(),
    canonicalText: "PR #123 opened by octocat",
    sourceUrl: "https://github.com/acme/gitpulse/pull/123",
    metrics: { additions: 10, deletions: 2 },
    metadata: { number: 123 },
    ghId: "123",
    ghNodeId: "PR_kwDOANo",
    contentScope: "event",
  };
}

const repoPayload = {
  id: 99,
  node_id: "R_kgDOANk",
  full_name: "acme/gitpulse",
  owner: { login: "acme" },
  name: "gitpulse",
  private: false,
  fork: false,
  archived: false,
  html_url: "https://github.com/acme/gitpulse",
  stargazers_count: 10,
  forks_count: 2,
};

describe("persistCanonicalEvent", () => {
  it("inserts new canonical event and schedules embedding", async () => {
    const canonical = buildCanonicalEvent();
    const newEventId = "evt1" as Id<"events">;

    const runQuery = jest.fn().mockResolvedValueOnce(null);
    const runMutation = jest
      .fn()
      .mockResolvedValueOnce("user_1")
      .mockResolvedValueOnce("repo_1")
      .mockResolvedValueOnce(newEventId)
      .mockResolvedValueOnce("embedding_job");

    const schedulerRunAfter = jest.fn().mockResolvedValue(undefined);

    const ctx = createMockActionCtx({
      runQuery,
      runMutation,
      scheduler: { runAfter: schedulerRunAfter },
    });

    const result = await persistCanonicalEvent(
      ctx,
      canonical,
      { repoPayload, installationId: 123 }
    );

    expect(result).toEqual({ status: "inserted", eventId: newEventId });

    expect(runMutation).toHaveBeenCalledWith(
      internal.events.upsertCanonical,
      expect.objectContaining({ canonicalText: canonical.canonicalText })
    );
    expect(runMutation).toHaveBeenCalledWith(
      internal.embeddingQueue.enqueue,
      expect.objectContaining({ contentHash: expect.any(String) })
    );
    expect(schedulerRunAfter).toHaveBeenCalledWith(
      0,
      internal.actions.embeddings.ensureBatch.ensureBatch,
      {}
    );
  });

  it("returns duplicate without inserting when content hash already exists", async () => {
    const canonical = buildCanonicalEvent();
    const existingId = "evt_existing" as Id<"events">;

    const runQuery = jest.fn().mockResolvedValueOnce({ _id: existingId });
    const runMutation = jest
      .fn()
      .mockResolvedValueOnce("user_1")
      .mockResolvedValueOnce("repo_1");

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await persistCanonicalEvent(
      ctx,
      canonical,
      { repoPayload }
    );

    expect(result).toEqual({ status: "duplicate", eventId: existingId });
    expect(runMutation).toHaveBeenCalledTimes(2);
  });

  it("skips when repo metadata is missing", async () => {
    const canonical = buildCanonicalEvent();
    const runQuery = jest.fn();
    const runMutation = jest.fn().mockResolvedValueOnce("user_1");

    const ctx = createMockActionCtx({ runQuery, runMutation });

    const result = await persistCanonicalEvent(ctx, canonical, { repoPayload: null });

    expect(result).toEqual({ status: "skipped" });
    expect(runQuery).not.toHaveBeenCalled();
  });
});
