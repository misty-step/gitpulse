/**
 * Health Check API Route Tests
 *
 * Verifies health endpoint behavior for various scenarios
 */

import { GET, HEAD } from "../route";
import { PUBLIC_ROUTES } from "@/lib/auth/publicRoutes";

// Save original fetch before mocking
const originalFetch = global.fetch;

// Mock fetch globally
global.fetch = jest.fn();

const makeRequest = (path: string) =>
  new Request(`http://localhost${path}`, { method: "GET" });

describe("/api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  });

  // Restore original fetch to prevent pollution of other test suites
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("returns liveness 200 without touching Convex", async () => {
    const response = await GET(makeRequest("/api/health"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("liveness");
    expect(data.convex).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 200 in deep mode when Convex is healthy", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.mode).toBe("deep");
    expect(data.convex).toBe("ok");
    expect(data.error).toBeUndefined();
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 in deep mode when Convex is unhealthy", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.convex).toBe("error");
    expect(data.error).toContain("Convex health check failed");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 in deep mode when Convex times out", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Request timeout"),
    );

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.convex).toBe("error");
    expect(data.error).toContain("Convex health check failed");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 in deep mode when Convex URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.convex).toBe("degraded");
    expect(data.error).toContain("Convex health check failed");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("returns 503 when Convex reports degraded status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "degraded" }),
    });

    const response = await GET(makeRequest("/api/health?deep=1"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.convex).toBe("degraded");
    expect(data.status).toBe("error");
    expect(data.error).toContain("Convex health check failed");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("calls Convex health endpoint with correct URL in deep mode", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await GET(makeRequest("/api/health?deep=1"));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/health",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("strips trailing slash from Convex URL in deep mode", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud/";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await GET(makeRequest("/api/health?deep=1"));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/health",
      expect.anything(),
    );
  });

  it("includes no-cache headers in responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

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
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const response = await HEAD(
      new Request("http://localhost/api/health?deep=1"),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("returns deep HEAD with 503 when Convex fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

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
  });
});
