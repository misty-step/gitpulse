import { jest } from "@jest/globals";
import type { ActionCtx } from "../../convex/_generated/server";

export interface MockActionCtx {
  runQuery: jest.Mock<any>;
  runMutation: jest.Mock<any>;
  runAction: jest.Mock<any>;
  scheduler: { runAfter: jest.Mock<any> };
  auth: { getUserIdentity: jest.Mock<any> };
}

export function createMockActionCtx(
  overrides: Partial<MockActionCtx> = {},
): ActionCtx {
  const base: MockActionCtx = {
    runQuery: jest.fn() as any,
    runMutation: jest.fn() as any,
    runAction: jest.fn() as any,
    scheduler: { runAfter: jest.fn() as any },
    auth: { getUserIdentity: jest.fn() as any },
  };

  const merged: MockActionCtx = {
    ...base,
    ...overrides,
    scheduler: { ...base.scheduler, ...overrides.scheduler },
    auth: { ...base.auth, ...overrides.auth },
  };

  return merged as unknown as ActionCtx;
}
