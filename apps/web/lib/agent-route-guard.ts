import { timingSafeEqual } from "node:crypto";

export type AgentRouteGuardInput = {
  allowUnauthenticated: boolean;
  nodeEnv?: string;
  requestSecret?: string | null;
  sharedSecret?: string;
};

export type AgentRouteGuardResult =
  | {
      error: string;
      status: 401 | 503;
    }
  | null;

export function guardAgentRoute(input: AgentRouteGuardInput): AgentRouteGuardResult {
  if (input.sharedSecret && !matchesSharedSecret(input.requestSecret, input.sharedSecret)) {
    return {
      error: "Unauthorized agent route request.",
      status: 401,
    };
  }

  if (input.nodeEnv !== "production") {
    return null;
  }

  if (input.allowUnauthenticated) {
    return null;
  }

  return {
    error: "Agent route is disabled in production until auth is configured.",
    status: 503,
  };
}

function matchesSharedSecret(requestSecret: string | null | undefined, sharedSecret: string): boolean {
  if (typeof requestSecret !== "string") {
    return false;
  }

  const actual = Buffer.from(requestSecret);
  const expected = Buffer.from(sharedSecret);
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
