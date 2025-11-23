/**
 * Health Check API Route Tests
 *
 * Verifies health endpoint behavior for various scenarios
 */

import { GET } from "../route";

// Save original fetch before mocking
const originalFetch = global.fetch;

// Mock fetch globally
global.fetch = jest.fn();

describe("/api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  });

  // Restore original fetch to prevent pollution of other test suites
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("returns 200 when all systems are healthy", async () => {
    // Mock successful Convex health check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.server).toBe("ok");
    expect(data.convex).toBe("ok");
    expect(data.timestamp).toBeGreaterThan(0);
    expect(data.error).toBeUndefined();
  });

  it("returns 503 when Convex is unhealthy", async () => {
    // Mock failed Convex health check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.server).toBe("ok");
    expect(data.convex).toBe("error");
    expect(data.error).toContain("Convex health check failed");
  });

  it("returns 503 when Convex times out", async () => {
    // Mock timeout
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Request timeout"),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.convex).toBe("error");
  });

  it("returns 503 when Convex URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.convex).toBe("degraded");
    expect(data.error).toContain("Convex health check failed");
  });

  it("returns 503 when Convex returns degraded status", async () => {
    // Mock Convex returning "degraded" status
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "degraded" }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.convex).toBe("degraded");
  });

  it("calls Convex health endpoint with correct URL", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await GET();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/health",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("strips trailing slash from Convex URL", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud/";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await GET();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.convex.cloud/health",
      expect.anything(),
    );
  });

  it("includes no-cache headers in response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const response = await GET();
    const headers = response.headers;

    expect(headers.get("Cache-Control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(headers.get("Pragma")).toBe("no-cache");
    expect(headers.get("Expires")).toBe("0");
  });
});
