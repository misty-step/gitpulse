/**
 * Integration Status Utilities Tests
 *
 * Tests for the pure utility functions in lib/integrationStatus.ts
 */

import {
  needsIntegrationAttention,
  formatTimestamp,
  getGithubInstallUrl,
  type IntegrationStatus,
} from "../integrationStatus";

describe("needsIntegrationAttention", () => {
  it("returns false for null status", () => {
    expect(needsIntegrationAttention(null)).toBe(false);
  });

  it("returns false for undefined status", () => {
    expect(needsIntegrationAttention(undefined)).toBe(false);
  });

  it("returns true for missing_installation", () => {
    const status: IntegrationStatus = { kind: "missing_installation" };
    expect(needsIntegrationAttention(status)).toBe(true);
  });

  it("returns true for no_events", () => {
    const status: IntegrationStatus = { kind: "no_events" };
    expect(needsIntegrationAttention(status)).toBe(true);
  });

  it("returns true for stale_events", () => {
    const status: IntegrationStatus = {
      kind: "stale_events",
      staleSince: Date.now() - 86400000,
    };
    expect(needsIntegrationAttention(status)).toBe(true);
  });

  it("returns false for healthy", () => {
    const status: IntegrationStatus = { kind: "healthy" };
    expect(needsIntegrationAttention(status)).toBe(false);
  });

  it("returns false for unauthenticated", () => {
    const status: IntegrationStatus = { kind: "unauthenticated" };
    expect(needsIntegrationAttention(status)).toBe(false);
  });

  it("returns false for missing_user", () => {
    const status: IntegrationStatus = { kind: "missing_user" };
    expect(needsIntegrationAttention(status)).toBe(false);
  });
});

describe("formatTimestamp", () => {
  it("returns 'Never' for null", () => {
    expect(formatTimestamp(null)).toBe("Never");
  });

  it("returns 'Never' for undefined", () => {
    expect(formatTimestamp(undefined)).toBe("Never");
  });

  it("returns 'Never' for zero", () => {
    expect(formatTimestamp(0)).toBe("Never");
  });

  it("formats valid timestamp", () => {
    const ts = new Date("2024-01-15T10:30:00Z").getTime();
    const result = formatTimestamp(ts);
    // Result format depends on locale, but should contain the date
    expect(result).not.toBe("Never");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts custom locale", () => {
    const ts = new Date("2024-01-15T10:30:00Z").getTime();
    const result = formatTimestamp(ts, "en-US");
    expect(result).not.toBe("Never");
  });
});

describe("getGithubInstallUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;
    }
  });

  it("returns env var when set", () => {
    process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL =
      "https://custom.example.com/install";
    expect(getGithubInstallUrl()).toBe("https://custom.example.com/install");
  });

  it("returns default URL when env unset", () => {
    delete process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;
    expect(getGithubInstallUrl()).toBe(
      "https://github.com/apps/gitpulse/installations/new"
    );
  });

  it("returns default URL when env is empty string", () => {
    process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL = "";
    expect(getGithubInstallUrl()).toBe(
      "https://github.com/apps/gitpulse/installations/new"
    );
  });
});
