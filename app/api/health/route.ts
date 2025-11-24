import {
  buildHealthResponse,
  checkConvexHealth,
  makeHealthResponse,
  parseHealthMode,
} from "@/lib/health";

async function handle(request: Request, method: "GET" | "HEAD") {
  const url = new URL(request.url);
  const mode = parseHealthMode(url);

  if (mode === "liveness") {
    const { body, ok } = buildHealthResponse("liveness");
    return makeHealthResponse(body, ok, method);
  }

  const convex = await checkConvexHealth();
  const { body, ok } = buildHealthResponse("deep", convex);
  return makeHealthResponse(body, ok, method);
}

export async function GET(request: Request) {
  return handle(request, "GET");
}

// Some uptime monitors (including UptimeRobot keyword checks) default to POST when a body is configured.
// Treat POST like GET so probes never fail with 405.
export async function POST(request: Request) {
  return handle(request, "GET");
}

export async function HEAD(request: Request) {
  return handle(request, "HEAD");
}
