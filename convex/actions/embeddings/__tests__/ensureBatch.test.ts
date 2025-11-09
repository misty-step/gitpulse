import { describe, expect, it, jest } from "@jest/globals";
import type { Doc, Id } from "../../../_generated/dataModel";
import { ensureBatchHandler } from "../ensureBatch";
import { createMockActionCtx } from "../../../../tests/__mocks__/convexCtx";
import { api, internal } from "../../../_generated/api";

jest.mock("../../../_generated/server", () => ({
  internalAction: (config: any) => config,
}));

jest.mock("../../../_generated/api", () => ({
  api: {
    embeddingQueue: { listPending: "api.embeddingQueue.listPending" },
    actions: {
      generateEmbeddings: { generateBatch: "api.actions.generateEmbeddings.generateBatch" },
    },
  },
  internal: {
    embeddingQueue: {
      markProcessing: "internal.embeddingQueue.markProcessing",
      complete: "internal.embeddingQueue.complete",
      fail: "internal.embeddingQueue.fail",
    },
  },
}));

describe("ensureBatchHandler", () => {
  it("returns zero when no jobs are pending", async () => {
    const ctx = createMockActionCtx({
      runQuery: jest.fn().mockResolvedValueOnce([]),
    });

    const result = await ensureBatchHandler(ctx, {});

    expect(result).toEqual({ processed: 0 });
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  it("processes pending jobs and completes them", async () => {
    const jobs: Array<Doc<"embeddingQueue">> = [
      {
        _id: "job1" as Id<"embeddingQueue">,
        _creationTime: 0,
        eventId: "evt1" as Id<"events">,
        contentHash: "hash-1",
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      },
      {
        _id: "job2" as Id<"embeddingQueue">,
        _creationTime: 0,
        eventId: "evt2" as Id<"events">,
        contentHash: "hash-2",
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      },
    ];

    const runQuery = jest.fn().mockResolvedValueOnce(jobs);
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const runAction = jest.fn().mockResolvedValue(undefined);

    const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

    const result = await ensureBatchHandler(ctx, { limit: 10 });

    expect(result).toEqual({ processed: jobs.length });
    expect(runMutation).toHaveBeenCalledWith(
      internal.embeddingQueue.markProcessing,
      { id: jobs[0]._id }
    );
    expect(runMutation).toHaveBeenCalledWith(
      internal.embeddingQueue.complete,
      { id: jobs[1]._id }
    );
    expect(runAction).toHaveBeenCalledWith(
      api.actions.generateEmbeddings.generateBatch,
      { eventIds: [jobs[0].eventId, jobs[1].eventId] }
    );
  });

  it("marks jobs as failed when embedding generation throws", async () => {
    const jobs: Array<Doc<"embeddingQueue">> = [
      {
        _id: "job1" as Id<"embeddingQueue">,
        _creationTime: 0,
        eventId: "evt1" as Id<"events">,
        contentHash: "hash-1",
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      },
    ];

    const runQuery = jest.fn().mockResolvedValueOnce(jobs);
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const runAction = jest.fn().mockRejectedValue(new Error("boom"));

    const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

    await expect(ensureBatchHandler(ctx, {})).rejects.toThrow("boom");

    expect(runMutation).toHaveBeenCalledWith(
      internal.embeddingQueue.fail,
      { id: jobs[0]._id, errorMessage: "boom" }
    );
  });
});
