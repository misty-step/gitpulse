import { NextResponse } from "next/server";

type HealthMode = "liveness" | "deep";
type ConvexStatus = "ok" | "degraded" | "error";

interface HealthResponse {
  status: "ok" | "error";
  mode: HealthMode;
  timestamp: number;
  convex?: ConvexStatus;
  error?: string;
}

const CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/**
 * Deep Convex health check for diagnostics (not used in default liveness probe).
 */
async function checkConvexHealth(): Promise<ConvexStatus> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return "degraded";
  }

  try {
    const baseUrl = convexUrl.replace(/\/$/, "");
    const healthUrl = `${baseUrl}/health`;

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === "ok" ? "ok" : "degraded";
    }

    // Non-200 response from Convex
    return "error";
  } catch (error) {
    return "error";
  }
}

function jsonResponse(body: HealthResponse, ok: boolean) {
  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: CACHE_HEADERS,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDeep = url.searchParams.has("deep");

  if (!isDeep) {
    const body: HealthResponse = {
      status: "ok",
      mode: "liveness",
      timestamp: Date.now(),
    };
    return jsonResponse(body, true);
  }

  const convex = await checkConvexHealth();
  const healthy = convex === "ok";

  const body: HealthResponse = {
    status: healthy ? "ok" : "error",
    mode: "deep",
    convex,
    timestamp: Date.now(),
  };

  if (!healthy) {
    body.error = `Convex health check failed: ${convex}`;
  }

  return jsonResponse(body, healthy);
}

// Keep HEAD aligned with GET for uptime monitors that default to HEAD.
export async function HEAD(request: Request) {
  return GET(request);
}
