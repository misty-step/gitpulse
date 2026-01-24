/**
 * Health Check API Route Tests
 *
 * Verifies health endpoint behavior for various scenarios.
 * Deep mode now checks multiple services (Convex, GitHub, OpenRouter, Clerk).
 */

import { GET, HEAD, POST } from "../route";
import { PUBLIC_ROUTES } from "@/lib/auth/publicRoutes";

// Save original fetch before mocking
const originalFetch = global.fetch;

// Mock fetch globally
global.fetch = jest.fn();

const makeRequest = (path: string) =>
  new Request(`http://localhost${path}`, { method: "GET" });

/**
 * Helper to mock all 4 service health checks for deep mode.
 * Order: Convex, GitHub, OpenRouter, Clerk (from Promise.all in checkAllServices)
 */
function mockAllServicesOk() {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true }) // Convex /version
    .mockResolvedValueOnce({ ok: true }) // GitHub /rate_limit
    .mockResolvedValueOnce({ ok: true }) // OpenRouter /models
    .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk /health
}

describe("/api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_test_FAKE_KEY_FOR_TESTING";
  });

  // Restore original fetch to prevent pollution of other test suites
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("returns liveness 200 without touching external services", async () => {
    const response = await GET(makeRequest("/api/health"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("liveness");
    expect(data.services).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("treats POST like GET for uptime probes", async () => {
    const response = await POST(
      new Request("http://localhost/api/health", { method: "POST" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mode).toBe("liveness");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 200 in deep mode when all services are healthy", async () => {
    mockAllServicesOk();

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("deep");
    expect(data.services.convex.status).toBe("ok");
    expect(data.services.github.status).toBe("ok");
    expect(data.error).toBeUndefined();
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 in deep mode when Convex (critical) is unhealthy", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 }) // Convex fails
      .mockResolvedValueOnce({ ok: true }) // GitHub ok
      .mockResolvedValueOnce({ ok: true }) // OpenRouter ok
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk ok

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.services.convex.status).toBe("error");
    expect(data.error).toContain("unhealthy");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 200 (degraded) when non-critical service fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // Convex ok
      .mockResolvedValueOnce({ ok: false, status: 503 }) // GitHub fails
      .mockResolvedValueOnce({ ok: true }) // OpenRouter ok
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk ok

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    // Degraded returns 200 (only critical failures return 503)
    expect(response.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.services.convex.status).toBe("ok");
    expect(data.services.github.status).toBe("error");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 in deep mode when Convex times out", async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error("Request timeout")) // Convex timeout
      .mockResolvedValueOnce({ ok: true }) // GitHub ok
      .mockResolvedValueOnce({ ok: true }) // OpenRouter ok
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk ok

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.services.convex.status).toBe("error");
    expect(data.services.convex.message).toContain("timeout");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 200 (degraded) when Convex URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    // Other services still get checked
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // GitHub ok
      .mockResolvedValueOnce({ ok: true }) // OpenRouter ok
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk ok

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    // Unconfigured Convex counts as degraded, not error
    expect(response.status).toBe(200);
    expect(data.services.convex.status).toBe("unconfigured");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("calls Convex version endpoint with correct URL in deep mode", async () => {
    mockAllServicesOk();

    await GET(makeRequest("/api/health?deep=1"));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/version",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("strips trailing slash from Convex URL in deep mode", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud/";
    mockAllServicesOk();

    await GET(makeRequest("/api/health?deep=1"));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/version",
      expect.anything(),
    );
  });

  it("includes no-cache headers in responses", async () => {
    mockAllServicesOk();

    const response = await GET(makeRequest("/api/health?deep=1"));
    const headers = response.headers;

    expect(headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(headers.get("Pragma")).toBe("no-cache");
    expect(headers.get("Expires")).toBe("0");
  });

  it("returns liveness HEAD with no body and matching headers", async () => {
    const response = await HEAD(new Request("http://localhost/api/health"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("");
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  it("returns deep HEAD mirroring GET success", async () => {
    mockAllServicesOk();

    const response = await HEAD(
      new Request("http://localhost/api/health?deep=1"),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("returns deep HEAD with 503 when Convex fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 }) // Convex fails
      .mockResolvedValueOnce({ ok: true }) // GitHub ok
      .mockResolvedValueOnce({ ok: true }) // OpenRouter ok
      .mockResolvedValueOnce({ ok: true, status: 200 }); // Clerk ok

    const response = await HEAD(
      new Request("http://localhost/api/health?deep=1"),
    );
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toBe("");
  });
});

describe("health contract guards", () => {
  it("exposes health endpoint as public", () => {
    expect(PUBLIC_ROUTES).toContain("/api/health(.*)");
  });

  it("exports HEAD handler alongside GET", () => {
    expect(typeof HEAD).toBe("function");
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });
});
