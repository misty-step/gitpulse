import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { processWebhookHandler } from "../processWebhook";
import { createMockActionCtx } from "../../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../../tests/utils/jestMocks";
import { api, internal } from "../../../_generated/api";
import { canonicalizeEvent } from "../../../lib/canonicalizeEvent";
import { persistCanonicalEvent } from "../../../lib/canonicalFactService";
import { logger } from "../../../lib/logger";
import { Id } from "../../../_generated/dataModel";

// Type alias for mocked functions to avoid 'never' type issues
type MockedFn = jest.MockedFunction<(...args: any[]) => any>;

jest.mock("../../../_generated/api", () => ({
  api: {
    webhookEvents: { enqueue: "api.webhookEvents.enqueue" },
    users: { getByGhId: "api.users.getByGhId" },
    installations: { upsert: "api.installations.upsert" },
  },
  internal: {
    webhookEvents: {
      getById: "internal.webhookEvents.getById",
      updateStatus: "internal.webhookEvents.updateStatus",
    },
    actions: {
      github: {
        startBackfill: {
          adminStartBackfill: "internal.actions.github.startBackfill.adminStartBackfill",
        },
      },
    },
  },
}));

jest.mock("../../../lib/canonicalizeEvent", () => ({
  canonicalizeEvent: jest.fn(),
}));

jest.mock("../../../lib/canonicalFactService", () => ({
  persistCanonicalEvent: jest.fn(),
}));

jest.mock("../../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const baseWebhook = {
  _id: "webhook-1" as Id<"webhookEvents">,
  deliveryId: "delivery-1",
  event: "pull_request",
  payload: {
    repository: { full_name: "org/repo" },
    installation: { id: 10 },
  },
};

describe("processWebhook", () => {
  const canonical = {
    type: "pr_opened" as const,
    repo: { fullName: "org/repo" },
    actor: { ghLogin: "alice" },
    ts: Date.now(),
    canonicalText: "PR",
    sourceUrl: "https://github.com/org/repo/pull/1",
    metadata: {},
    contentScope: "event" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes a pull_request event and persists canonical event", async () => {
    const runQuery = createAsyncMock();
    runQuery.mockResolvedValueOnce(baseWebhook); // getById

    const runMutation = createAsyncMock();
    const runAction = createAsyncMock();

    (canonicalizeEvent as MockedFn).mockReturnValue(canonical);
    (persistCanonicalEvent as MockedFn).mockResolvedValue({ status: "inserted" });

    const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

    await processWebhookHandler(ctx, { webhookEventId: baseWebhook._id });

    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: baseWebhook._id,
      status: "processing",
    });
    expect(persistCanonicalEvent).toHaveBeenCalledWith(
      ctx,
      canonical,
      expect.objectContaining({ installationId: 10 }),
    );
    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: baseWebhook._id,
      status: "completed",
    });
  });

  it("counts duplicates without failing", async () => {
    const runQuery = createAsyncMock();
    runQuery.mockResolvedValueOnce(baseWebhook);
    const runMutation = createAsyncMock();
    const runAction = createAsyncMock();

    (canonicalizeEvent as MockedFn).mockReturnValue(canonical);
    (persistCanonicalEvent as MockedFn).mockResolvedValue({ status: "duplicate" });

    const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

    await processWebhookHandler(ctx, { webhookEventId: baseWebhook._id });

    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: baseWebhook._id,
      status: "completed",
    });
    expect(persistCanonicalEvent).toHaveBeenCalledTimes(1);
  });

  it("completes gracefully for unsupported events", async () => {
    const runQuery = createAsyncMock();
    runQuery.mockResolvedValueOnce({
      ...baseWebhook,
      event: "ping",
    });
    const runMutation = createAsyncMock();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    await processWebhookHandler(ctx, { webhookEventId: "webhook-unsupported" as Id<"webhookEvents"> });

    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: "webhook-unsupported",
      status: "completed",
    });
    expect(persistCanonicalEvent).not.toHaveBeenCalled();
  });

  it("returns early when webhook envelope is missing", async () => {
    const runQuery = createAsyncMock();
    runQuery.mockResolvedValueOnce(null);
    const runMutation = createAsyncMock();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    await processWebhookHandler(ctx, { webhookEventId: "missing-id" as Id<"webhookEvents"> });

    expect(runMutation).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("handles installation created event and triggers backfill when user linked", async () => {
    const runQuery = createAsyncMock();
    runQuery
      .mockResolvedValueOnce({
        ...baseWebhook,
        event: "installation",
        payload: {
          action: "created",
          installation: {
            id: 55,
            account: { login: "org", type: "Organization" },
            repository_selection: "selected",
          },
          repositories: [{ full_name: "org/repo" }],
          sender: { id: 999, login: "alice" },
        },
      })
      .mockResolvedValueOnce({ clerkId: "user_123" }); // users.getByGhId

    const runMutation = createAsyncMock();
    const runAction = createAsyncMock();
    const ctx = createMockActionCtx({ runQuery, runMutation, runAction });

    await processWebhookHandler(ctx, { webhookEventId: "install-1" as Id<"webhookEvents"> });

    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: "install-1",
      status: "processing",
    });
    expect(runMutation).toHaveBeenCalledWith(api.installations.upsert, expect.any(Object));
    expect(runAction).toHaveBeenCalledWith(
      internal.actions.github.startBackfill.adminStartBackfill,
      expect.objectContaining({ installationId: 55 }),
    );
    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: "install-1",
      status: "completed",
    });
  });

  it("marks webhook as failed when persistence throws", async () => {
    const runQuery = createAsyncMock();
    runQuery.mockResolvedValueOnce(baseWebhook);
    const runMutation = createAsyncMock();
    const ctx = createMockActionCtx({ runQuery, runMutation });

    (canonicalizeEvent as MockedFn).mockReturnValue(canonical);
    (persistCanonicalEvent as MockedFn).mockRejectedValue(new Error("boom"));

    await processWebhookHandler(ctx, { webhookEventId: baseWebhook._id });

    expect(runMutation).toHaveBeenCalledWith(internal.webhookEvents.updateStatus, {
      id: baseWebhook._id,
      status: "failed",
      errorMessage: "boom",
      retryCount: 0,
    });
  });
});
