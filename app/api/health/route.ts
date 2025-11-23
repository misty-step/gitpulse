/**
 * Next.js Health Check API Route
 *
 * Provides comprehensive health status for the application:
 * - Next.js server availability
 * - Convex backend connectivity
 * - Overall system health
 *
 * Used by:
 * - Vercel health checks
 * - External monitoring (UptimeRobot, Pingdom, etc.)
 * - Load balancers
 * - Kubernetes liveness/readiness probes
 *
 * Response codes:
 * - 200 OK: All systems operational
 * - 503 Service Unavailable: One or more systems degraded
 */

import { NextResponse } from "next/server";

interface HealthCheck {
  server: "ok";
  convex: "ok" | "degraded" | "error";
  timestamp: number;
  error?: string;
}

/**
 * Check Convex backend health
 *
 * Attempts to connect to Convex /health endpoint to verify:
 * - Network connectivity to Convex
 * - Convex runtime availability
 * - Database connectivity (tested by Convex health endpoint)
 */
async function checkConvexHealth(): Promise<"ok" | "degraded" | "error"> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    // Convex URL not configured - degraded state
    return "degraded";
  }

  try {
    // Remove trailing slash if present
    const baseUrl = convexUrl.replace(/\/$/, "");
    const healthUrl = `${baseUrl}/health`;

    const response = await fetch(healthUrl, {
      method: "GET",
      // Timeout after 5 seconds to avoid hanging health checks
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
    // Network error, timeout, or other failure
    return "error";
  }
}

/**
 * GET /api/health
 *
 * Returns comprehensive health status
 */
export async function GET() {
  const checks: HealthCheck = {
    server: "ok", // Next.js server is responding (we're in this handler)
    convex: await checkConvexHealth(),
    timestamp: Date.now(),
  };

  // Overall health is OK only if all checks pass
  const allHealthy = checks.convex === "ok";

  if (!allHealthy) {
    // Include error context for debugging
    checks.error = `Convex health check failed: ${checks.convex}`;
  }

  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503,
    headers: {
      // Prevent caching of health check responses
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
