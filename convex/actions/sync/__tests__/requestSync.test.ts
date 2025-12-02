/**
 * Sync Request Action Tests
 *
 * Tests for the requestSync and requestManualSync actions.
 * These are thin wrappers around SyncService.request().
 */

import { describe, expect, it, jest } from "@jest/globals";

// Mock the syncService module
jest.mock("../../../lib/syncService", () => ({
  request: jest.fn(),
}));

import { request } from "../../../lib/syncService";

const mockRequest = request as jest.MockedFunction<typeof request>;

describe("requestSync action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to syncService.request with all args", async () => {
    mockRequest.mockResolvedValueOnce({
      started: true,
      message: "Sync started",
      jobId: "job123" as any,
    });

    // Import the handler after mocking
    const { requestSync } = await import("../requestSync");

    const mockCtx = {
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      runAction: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
      auth: { getUserIdentity: jest.fn() },
    } as any;

    const result = await requestSync.handler(mockCtx, {
      installationId: 12345,
      trigger: "cron",
      since: 1000,
      until: 2000,
    });

    expect(mockRequest).toHaveBeenCalledWith(mockCtx, {
      installationId: 12345,
      trigger: "cron",
      since: 1000,
      until: 2000,
    });
    expect(result.started).toBe(true);
  });

  it("passes optional args as undefined when not provided", async () => {
    mockRequest.mockResolvedValueOnce({
      started: true,
      message: "Sync started",
    });

    const { requestSync } = await import("../requestSync");

    const mockCtx = {
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      runAction: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
      auth: { getUserIdentity: jest.fn() },
    } as any;

    await requestSync.handler(mockCtx, {
      installationId: 12345,
      trigger: "webhook",
    });

    expect(mockRequest).toHaveBeenCalledWith(mockCtx, {
      installationId: 12345,
      trigger: "webhook",
      since: undefined,
      until: undefined,
    });
  });
});

describe("requestManualSync action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns auth error when not authenticated", async () => {
    const { requestManualSync } = await import("../requestSync");

    const mockCtx = {
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      runAction: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
      auth: { getUserIdentity: jest.fn().mockResolvedValue(null) },
    } as any;

    const result = await requestManualSync.handler(mockCtx, {
      installationId: 12345,
    });

    expect(result.started).toBe(false);
    expect(result.message).toBe("Authentication required");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("calls syncService when authenticated", async () => {
    mockRequest.mockResolvedValueOnce({
      started: true,
      message: "Sync started",
    });

    const { requestManualSync } = await import("../requestSync");

    const mockCtx = {
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      runAction: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
      auth: {
        getUserIdentity: jest.fn().mockResolvedValue({ subject: "user123" }),
      },
    } as any;

    const result = await requestManualSync.handler(mockCtx, {
      installationId: 12345,
    });

    expect(mockRequest).toHaveBeenCalledWith(mockCtx, {
      installationId: 12345,
      trigger: "manual",
    });
    expect(result.started).toBe(true);
  });
});
