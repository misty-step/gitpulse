import { jest } from "@jest/globals";
import type { ActionCtx } from "../../convex/_generated/server";

export interface MockActionCtx {
  runQuery: jest.Mock;
  runMutation: jest.Mock;
  runAction: jest.Mock;
  scheduler: { runAfter: jest.Mock };
  auth: { getUserIdentity: jest.Mock };
}

export function createMockActionCtx(
  overrides: Partial<MockActionCtx> = {}
): ActionCtx {
  const base: MockActionCtx = {
    runQuery: jest.fn(),
    runMutation: jest.fn(),
    runAction: jest.fn(),
    scheduler: { runAfter: jest.fn() },
    auth: { getUserIdentity: jest.fn() },
  };

  const merged: MockActionCtx = {
    ...base,
    ...overrides,
    scheduler: { ...base.scheduler, ...overrides.scheduler },
    auth: { ...base.auth, ...overrides.auth },
  };

  return merged as unknown as ActionCtx;
}
