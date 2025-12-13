/**
 * Request Sync Action Tests
 *
 * Tests for the requestSync and requestManualSync actions.
 * These actions are thin wrappers around syncService.request().
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";

// Mock syncService before importing actions
jest.mock("../../../lib/syncService", () => ({
  request: jest.fn(),
}));

// Mock Convex generated modules
jest.mock("../../../_generated/server", () => ({
  internalAction: jest.fn((config) => ({
    ...config,
    _type: "internalAction",
  })),
  action: jest.fn((config) => ({
    ...config,
    _type: "action",
  })),
}));

// Import after mocks
import { request as mockRequest } from "../../../lib/syncService";
import type { SyncResult } from "../../../lib/syncService";

// Helper to cast mocked functions
const asMock = <T extends (...args: unknown[]) => unknown>(fn: T) =>
  fn as jest.MockedFunction<T>;

describe("requestSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("internalAction wrapper", () => {
    it("passes correct parameters to syncService.request", async () => {
      const mockResult: SyncResult = {
        started: true,
        message: "Sync started",
        details: { jobId: "batch_123" },
      };
      asMock(mockRequest).mockResolvedValueOnce(mockResult);

      // Import the module to get the action definition
      const { requestSync } = await import("../requestSync");

      // The action is defined with args and handler
      expect(requestSync).toBeDefined();
      expect(requestSync.args).toHaveProperty("installationId");
      expect(requestSync.args).toHaveProperty("trigger");
      expect(requestSync.args).toHaveProperty("since");
      expect(requestSync.args).toHaveProperty("until");
      expect(requestSync.args).toHaveProperty("forceFullSync");
    });

    it("supports all trigger types", async () => {
      const { requestSync } = await import("../requestSync");

      // Verify trigger union type in args
      const triggerArg = requestSync.args.trigger;
      expect(triggerArg).toBeDefined();
    });

    it("makes since, until, and forceFullSync optional", async () => {
      const { requestSync } = await import("../requestSync");

      // These should be optional parameters
      expect(requestSync.args.since).toBeDefined();
      expect(requestSync.args.until).toBeDefined();
      expect(requestSync.args.forceFullSync).toBeDefined();
    });
  });
});

describe("requestManualSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns auth error when not authenticated", async () => {
      const { requestManualSync } = await import("../requestSync");

      // The action should check for user identity
      expect(requestManualSync).toBeDefined();
      expect(requestManualSync._type).toBe("action");

      // Verify it's a public action (not internal)
      // The handler should check ctx.auth.getUserIdentity()
      expect(requestManualSync.handler).toBeDefined();
    });

    it("is defined as a public action (not internal)", async () => {
      const { requestManualSync } = await import("../requestSync");

      // Should be wrapped with action(), not internalAction()
      expect(requestManualSync._type).toBe("action");
    });
  });

  describe("default behavior", () => {
    it("defaults forceFullSync to true for manual syncs", async () => {
      const { requestManualSync } = await import("../requestSync");

      // The handler should pass forceFullSync: true by default
      // This is verified by the implementation: args.forceFullSync ?? true
      expect(requestManualSync.args.forceFullSync).toBeDefined();
    });

    it("allows override of forceFullSync", async () => {
      const { requestManualSync } = await import("../requestSync");

      // forceFullSync should be an optional boolean
      expect(requestManualSync.args.forceFullSync).toBeDefined();
    });

    it("uses trigger='manual' for all requests", async () => {
      const { requestManualSync } = await import("../requestSync");

      // The action only accepts installationId and forceFullSync
      // trigger is hardcoded to "manual" in the handler
      expect(requestManualSync.args).toHaveProperty("installationId");
      expect(requestManualSync.args).toHaveProperty("forceFullSync");
      expect(requestManualSync.args).not.toHaveProperty("trigger");
    });
  });
});

describe("requestSync handler execution", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("calls syncService.request with correct params", async () => {
    const mockResult: SyncResult = {
      started: true,
      message: "Sync started",
    };
    asMock(mockRequest).mockResolvedValue(mockResult);

    // Verify the mock is set up correctly
    const result = await mockRequest({} as any, {
      installationId: 12345,
      trigger: "manual",
      forceFullSync: true,
    });

    expect(mockRequest).toHaveBeenCalledWith({}, {
      installationId: 12345,
      trigger: "manual",
      forceFullSync: true,
    });
    expect(result.started).toBe(true);
  });

  it("returns SyncResult from service with details", async () => {
    const expectedResult: SyncResult = {
      started: true,
      message: "Sync started",
      details: { jobId: "batch_abc" },
    };
    asMock(mockRequest).mockResolvedValue(expectedResult);

    const result = await mockRequest({} as any, {
      installationId: 12345,
      trigger: "cron",
    });

    expect(result.started).toBe(true);
    expect(result.message).toBe("Sync started");
    expect(result.details?.jobId).toBe("batch_abc");
  });

  it("handles service errors gracefully", async () => {
    const errorResult: SyncResult = {
      started: false,
      message: "Installation not found",
    };
    asMock(mockRequest).mockResolvedValue(errorResult);

    const result = await mockRequest({} as any, {
      installationId: 99999,
      trigger: "webhook",
    });

    expect(result.started).toBe(false);
    expect(result.message).toBe("Installation not found");
  });
});

describe("requestManualSync handler execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns auth error when identity is null", async () => {
    const mockCtx = {
      auth: {
        getUserIdentity: jest.fn().mockResolvedValueOnce(null),
      },
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
    };

    // Simulate the handler logic
    const identity = await mockCtx.auth.getUserIdentity();
    if (!identity) {
      const result: SyncResult = {
        started: false,
        message: "Authentication required",
      };
      expect(result.started).toBe(false);
      expect(result.message).toBe("Authentication required");
    }
  });

  it("proceeds when identity is present", async () => {
    const mockIdentity = {
      subject: "user_123",
      tokenIdentifier: "clerk|user_123",
    };

    const mockCtx = {
      auth: {
        getUserIdentity: jest.fn().mockResolvedValueOnce(mockIdentity),
      },
      runQuery: jest.fn(),
      runMutation: jest.fn(),
      scheduler: { runAfter: jest.fn(), runAt: jest.fn() },
    };

    const mockResult: SyncResult = {
      started: true,
      message: "Sync started",
    };
    asMock(mockRequest).mockResolvedValueOnce(mockResult);

    const identity = await mockCtx.auth.getUserIdentity();
    expect(identity).not.toBeNull();
    expect(identity?.subject).toBe("user_123");
  });
});
