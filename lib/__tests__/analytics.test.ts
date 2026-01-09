/**
 * Tests for analytics utility functions.
 *
 * @jest-environment jsdom
 */
import { trackFunnel, trackOnce, FunnelEvent } from "../analytics";

// Mock Vercel Analytics track function
jest.mock("@vercel/analytics", () => ({
  track: jest.fn(),
}));

import { track } from "@vercel/analytics";

const mockTrack = track as jest.MockedFunction<typeof track>;

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe("trackFunnel", () => {
    it("calls track with event name", () => {
      trackFunnel("signup_started");
      expect(mockTrack).toHaveBeenCalledWith("signup_started", undefined);
    });

    it("calls track with event name and properties", () => {
      trackFunnel("signup_started", { source: "hero" });
      expect(mockTrack).toHaveBeenCalledWith("signup_started", {
        source: "hero",
      });
    });
  });

  describe("trackOnce", () => {
    it("tracks event on first call", () => {
      trackOnce("first_report_viewed", { reportId: "123" });
      expect(mockTrack).toHaveBeenCalledWith("first_report_viewed", {
        reportId: "123",
      });
    });

    it("stores tracking key in localStorage", () => {
      trackOnce("first_sync_completed");
      expect(localStorage.getItem("gitpulse_tracked_first_sync_completed")).not.toBeNull();
    });

    it("does not track same event twice", () => {
      trackOnce("signup_completed");
      trackOnce("signup_completed");
      expect(mockTrack).toHaveBeenCalledTimes(1);
    });

    it("tracks different events independently", () => {
      trackOnce("signup_completed");
      trackOnce("github_install_completed");
      expect(mockTrack).toHaveBeenCalledTimes(2);
    });
  });

  describe("FunnelEvent type", () => {
    it("accepts all valid funnel events", () => {
      const validEvents: FunnelEvent[] = [
        "signup_started",
        "signup_completed",
        "github_install_started",
        "github_install_completed",
        "first_sync_completed",
        "first_report_viewed",
        "report_generated",
      ];

      expect(validEvents).toHaveLength(7);
    });
  });
});
