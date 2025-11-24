/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import { HeroMetadata } from "@/components/HeroMetadata";

const originalFetch = global.fetch;

describe("HeroMetadata", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("shows operational when deep health succeeds", async () => {
    const json = jest.fn().mockResolvedValue({
      status: "ok",
      mode: "deep",
      convex: "ok",
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json,
    }) as unknown as typeof fetch;

    render(<HeroMetadata />);

    await waitFor(() => {
      expect(screen.getByText("System Operational")).toBeInTheDocument();
      expect(screen.getByText(/ms$/)).toBeInTheDocument();
    });
  });

  it("shows degraded when deep health returns error", async () => {
    const json = jest.fn().mockResolvedValue({
      status: "error",
      mode: "deep",
      convex: "error",
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json,
    }) as unknown as typeof fetch;

    render(<HeroMetadata />);

    await waitFor(() => {
      expect(screen.getByText("System Degraded")).toBeInTheDocument();
      expect(screen.getByText(/ms$/)).toBeInTheDocument();
    });
  });

  it("keeps latency empty and logs when fetch throws", async () => {
    const consoleSpy = jest.spyOn(console, "error");

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network failure")) as unknown as typeof fetch;

    render(<HeroMetadata />);

    await waitFor(() => {
      expect(screen.getByText("System Degraded")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalled();
  });
});
