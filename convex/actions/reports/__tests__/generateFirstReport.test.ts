import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  generateFirstReport,
  generateFirstReportManual,
} from "../generateFirstReport";
import { internal } from "../../../_generated/api";
import {
  createMockActionCtx,
  createMockUser,
} from "../../../../tests/utils/factories";
import { logger } from "../../../lib/logger";

jest.mock("../../../_generated/api", () => ({
  internal: {
    users: {
      setFirstReportStatus: "internal.users.setFirstReportStatus",
    },
    actions: {
      reports: {
        generate: {
          generateTodayDaily:
            "internal.actions.reports.generate.generateTodayDaily",
        },
        generateFirstReport: {
          generateFirstReport:
            "internal.actions.reports.generateFirstReport.generateFirstReport",
        },
      },
    },
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("generateFirstReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets status to generating then completed on success", async () => {
    // Arrange
    const user = createMockUser();
    const runMutation = jest.fn().mockResolvedValue({ success: true });
    const runAction = jest.fn().mockResolvedValue({ success: true });
    const ctx = createMockActionCtx({ runMutation, runAction });

    // Act
    const result = await generateFirstReport.handler(ctx, {
      userId: user.clerkId,
    });

    // Assert
    expect(result).toEqual({ success: true });
    expect(runMutation).toHaveBeenNthCalledWith(
      1,
      internal.users.setFirstReportStatus,
      { clerkId: user.clerkId, status: "generating" },
    );
    expect(runAction).toHaveBeenCalledWith(
      internal.actions.reports.generate.generateTodayDaily,
      { userId: user.clerkId },
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      internal.users.setFirstReportStatus,
      { clerkId: user.clerkId, status: "completed" },
    );
  });

  it("sets status to failed when generateTodayDaily fails", async () => {
    // Arrange
    const user = createMockUser();
    const runMutation = jest.fn().mockResolvedValue({ success: true });
    const runAction = jest
      .fn()
      .mockResolvedValue({ success: false, error: "LLM failed" });
    const ctx = createMockActionCtx({ runMutation, runAction });

    // Act
    const result = await generateFirstReport.handler(ctx, {
      userId: user.clerkId,
    });

    // Assert
    expect(result).toEqual({ success: false, error: "LLM failed" });
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      internal.users.setFirstReportStatus,
      { clerkId: user.clerkId, status: "failed" },
    );
  });

  it("sets status to failed when generateTodayDaily throws", async () => {
    // Arrange
    const user = createMockUser();
    const runMutation = jest.fn().mockResolvedValue({ success: true });
    const runAction = jest.fn().mockRejectedValue(new Error("boom"));
    const ctx = createMockActionCtx({ runMutation, runAction });

    // Act
    const result = await generateFirstReport.handler(ctx, {
      userId: user.clerkId,
    });

    // Assert
    expect(result).toEqual({ success: false, error: "boom" });
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      internal.users.setFirstReportStatus,
      { clerkId: user.clerkId, status: "failed" },
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it("handles missing user gracefully", async () => {
    // Arrange
    const user = createMockUser();
    const runMutation = jest.fn().mockRejectedValue(new Error("missing user"));
    const runAction = jest.fn();
    const ctx = createMockActionCtx({ runMutation, runAction });

    // Act
    const result = await generateFirstReport.handler(ctx, {
      userId: user.clerkId,
    });

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to start report generation",
    });
    expect(runAction).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("generateFirstReportManual", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    // Arrange
    const ctx = createMockActionCtx({
      auth: { getUserIdentity: jest.fn().mockResolvedValue(null) },
    });

    // Act
    const result = await generateFirstReportManual.handler(ctx, {});

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Authentication required",
    });
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  it("delegates to internal action with correct userId", async () => {
    // Arrange
    const identity = { subject: "clerk_user_789" };
    const runAction = jest.fn().mockResolvedValue({ success: true });
    const ctx = createMockActionCtx({
      runAction,
      auth: { getUserIdentity: jest.fn().mockResolvedValue(identity) },
    });

    // Act
    const result = await generateFirstReportManual.handler(ctx, {});

    // Assert
    expect(result).toEqual({ success: true });
    expect(runAction).toHaveBeenCalledWith(
      internal.actions.reports.generateFirstReport.generateFirstReport,
      { userId: identity.subject },
    );
  });
});
