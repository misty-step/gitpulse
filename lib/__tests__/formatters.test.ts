import { describe, expect, it } from "@jest/globals";
import { formatReportDate } from "../formatters";

// Timestamps chosen to be unambiguous UTC dates that format predictably
// 2024-03-15T12:00:00Z — a fixed midday UTC instant
const MAR_15_NOON_UTC = Date.UTC(2024, 2, 15, 12, 0, 0);
// 2024-03-20T12:00:00Z
const MAR_20_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);

describe("formatReportDate", () => {
  describe("single-day range", () => {
    it("returns long-form date when start and end are on the same local day", () => {
      // Same timestamp → definitely same day
      const result = formatReportDate(MAR_15_NOON_UTC, MAR_15_NOON_UTC);
      expect(result).toBe("March 15, 2024");
    });
  });

  describe("multi-day range", () => {
    it("returns short-form range when start and end are on different days", () => {
      const result = formatReportDate(MAR_15_NOON_UTC, MAR_20_NOON_UTC);
      expect(result).toBe("Mar 15 – Mar 20, 2024");
    });
  });

  describe("timeZone parameter", () => {
    it("accepts an explicit timeZone and formats accordingly", () => {
      // UTC noon on Mar 15 is still Mar 15 in America/New_York (UTC-4/5)
      const result = formatReportDate(
        MAR_15_NOON_UTC,
        MAR_15_NOON_UTC,
        "America/New_York"
      );
      expect(result).toBe("March 15, 2024");
    });

    it("formats multi-day range with explicit timeZone", () => {
      const result = formatReportDate(
        MAR_15_NOON_UTC,
        MAR_20_NOON_UTC,
        "America/New_York"
      );
      expect(result).toBe("Mar 15 – Mar 20, 2024");
    });

    it("is backwards-compatible when timeZone is omitted", () => {
      const withoutTz = formatReportDate(MAR_15_NOON_UTC, MAR_20_NOON_UTC);
      const withUndefined = formatReportDate(
        MAR_15_NOON_UTC,
        MAR_20_NOON_UTC,
        undefined
      );
      expect(withoutTz).toBe(withUndefined);
    });

    it("formats correctly with UTC timeZone", () => {
      const result = formatReportDate(MAR_15_NOON_UTC, MAR_20_NOON_UTC, "UTC");
      expect(result).toBe("Mar 15 – Mar 20, 2024");
    });
  });
});
