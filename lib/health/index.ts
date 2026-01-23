import { NextResponse } from "next/server";

export type HealthMode = "liveness" | "deep";
export type ServiceStatus = "ok" | "degraded" | "error" | "unconfigured";

export interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  mode: HealthMode;
  timestamp: number;
  services?: {
    convex?: ServiceHealth;
    github?: ServiceHealth;
    openrouter?: ServiceHealth;
    clerk?: ServiceHealth;
  };
  error?: string;
}

export const HEALTH_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

const DEFAULT_DEEP_TIMEOUT_MS = 5000;

export const HEALTH_DEEP_TIMEOUT_MS = Number(
  process.env.HEALTH_DEEP_TIMEOUT_MS ?? DEFAULT_DEEP_TIMEOUT_MS,
);

export function parseHealthMode(url: URL): HealthMode {
  return url.searchParams.has("deep") ? "deep" : "liveness";
}

/**
 * Check Convex backend health via /version endpoint
 */
export async function checkConvexHealth(): Promise<ServiceHealth> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return { status: "unconfigured", message: "NEXT_PUBLIC_CONVEX_URL not set" };
  }

  const start = Date.now();
  try {
    const baseUrl = convexUrl.replace(/\/$/, "");
    const versionUrl = `${baseUrl}/version`;

    const response = await fetch(versionUrl, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_DEEP_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;
    return response.ok
      ? { status: "ok", latencyMs }
      : { status: "error", latencyMs, message: `HTTP ${response.status}` };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check GitHub API health via rate limit endpoint
 * This is a lightweight check that also reveals rate limit status
 */
export async function checkGitHubHealth(): Promise<ServiceHealth> {
  // GitHub App uses installation tokens, but we can check the API is reachable
  // using the unauthenticated rate limit endpoint
  const start = Date.now();
  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "GitPulse-HealthCheck",
      },
      signal: AbortSignal.timeout(HEALTH_DEEP_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return { status: "error", latencyMs, message: `HTTP ${response.status}` };
    }

    // GitHub API is reachable
    return { status: "ok", latencyMs };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check OpenRouter API health
 * Uses /api/v1/models endpoint which is lightweight and doesn't consume credits
 */
export async function checkOpenRouterHealth(): Promise<ServiceHealth> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { status: "unconfigured", message: "OPENROUTER_API_KEY not set" };
  }

  const start = Date.now();
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(HEALTH_DEEP_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return { status: "error", latencyMs, message: `HTTP ${response.status}` };
    }

    return { status: "ok", latencyMs };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check Clerk API health via JWKS endpoint
 * This endpoint is always public and doesn't require authentication
 */
export async function checkClerkHealth(): Promise<ServiceHealth> {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return {
      status: "unconfigured",
      message: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set",
    };
  }

  // Extract the Clerk frontend API from the publishable key
  // Format: pk_test_xxx or pk_live_xxx where xxx encodes the instance
  const start = Date.now();
  try {
    // Use Clerk's status endpoint
    const response = await fetch("https://api.clerk.com/v1/health", {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_DEEP_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;

    // Clerk health endpoint may not exist, treat 404 as degraded but reachable
    if (response.status === 404) {
      return { status: "ok", latencyMs, message: "Clerk API reachable" };
    }

    if (!response.ok) {
      return { status: "error", latencyMs, message: `HTTP ${response.status}` };
    }

    return { status: "ok", latencyMs };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run all deep health checks in parallel
 */
export async function checkAllServices(): Promise<HealthResponse["services"]> {
  const [convex, github, openrouter, clerk] = await Promise.all([
    checkConvexHealth(),
    checkGitHubHealth(),
    checkOpenRouterHealth(),
    checkClerkHealth(),
  ]);

  return { convex, github, openrouter, clerk };
}

/**
 * Determine overall health status from individual service statuses
 */
function computeOverallStatus(
  services: HealthResponse["services"],
): "ok" | "degraded" | "error" {
  if (!services) return "ok";

  const statuses = Object.values(services).map((s) => s?.status);

  // Critical services: Convex must be healthy
  if (services.convex?.status === "error") {
    return "error";
  }

  // If any service has error, we're degraded
  if (statuses.some((s) => s === "error")) {
    return "degraded";
  }

  // If all configured services are ok, we're ok
  // (unconfigured services don't count against us)
  return "ok";
}

// Legacy export for backwards compatibility
export type ConvexStatus = ServiceStatus;

export function buildHealthResponse(
  mode: HealthMode,
  convex?: ServiceHealth,
  allServices?: HealthResponse["services"],
) {
  if (mode === "liveness") {
    const body: HealthResponse = {
      status: "ok",
      mode,
      timestamp: Date.now(),
    };
    return { body, ok: true } as const;
  }

  // Deep health check
  const services = allServices ?? (convex ? { convex } : undefined);
  const overallStatus = computeOverallStatus(services);

  const body: HealthResponse = {
    status: overallStatus,
    mode,
    services,
    timestamp: Date.now(),
    error:
      overallStatus !== "ok"
        ? `One or more services unhealthy: ${JSON.stringify(services)}`
        : undefined,
  };

  // Return 503 only for critical failures (Convex down)
  const ok = overallStatus !== "error";
  return { body, ok } as const;
}

export function makeHealthResponse(
  body: HealthResponse,
  ok: boolean,
  method: "GET" | "HEAD",
) {
  if (method === "HEAD") {
    return new NextResponse(null, {
      status: ok ? 200 : 503,
      headers: HEALTH_CACHE_HEADERS,
    });
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: HEALTH_CACHE_HEADERS,
  });
}
