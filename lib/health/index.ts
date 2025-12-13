import { NextResponse } from "next/server";

export type HealthMode = "liveness" | "deep";
export type ConvexStatus = "ok" | "degraded" | "error";

export interface HealthResponse {
  status: "ok" | "error";
  mode: HealthMode;
  timestamp: number;
  convex?: ConvexStatus;
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

export async function checkConvexHealth(): Promise<ConvexStatus> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return "degraded";
  }

  try {
    const baseUrl = convexUrl.replace(/\/$/, "");
    // Convex cloud exposes /version (not /health) for availability checks
    const versionUrl = `${baseUrl}/version`;

    const response = await fetch(versionUrl, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_DEEP_TIMEOUT_MS),
    });

    // /version returns 200 with a version string when Convex is healthy
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export function buildHealthResponse(mode: HealthMode, convex?: ConvexStatus) {
  if (mode === "liveness") {
    const body: HealthResponse = {
      status: "ok",
      mode,
      timestamp: Date.now(),
    };
    return { body, ok: true } as const;
  }

  const healthy = convex === "ok";
  const body: HealthResponse = {
    status: healthy ? "ok" : "error",
    mode,
    convex,
    timestamp: Date.now(),
    error: healthy ? undefined : `Convex health check failed: ${convex}`,
  };

  // Intentionally surface any Convex degradation as a 503 to pull instances from load balancers (see ADR 0001).
  return { body, ok: healthy } as const;
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
