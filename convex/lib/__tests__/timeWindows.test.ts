/**
 * Time Windows Tests
 *
 * Comprehensive tests for timezone-aware date boundary calculations.
 * These tests are critical - timezone bugs are subtle and hard to catch.
 */

import {
  getYesterdayWindow,
  getTodayWindow,
  getLastWeekWindow,
  getMidnightUtcHour,
  getSundayMidnightUtcHour,
  formatReportDate,
  formatShortDate,
  formatDateRange,
  formatRelativeTime,
  isValidTimezone,
  getTimezoneOrDefault,
  isLocalSunday,
} from "../timeWindows";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Convert a date string in a timezone to a UTC timestamp.
 * Format: "2025-12-05 09:00" in "America/Chicago" → UTC timestamp
 */
function toUtc(dateTimeStr: string, timezone: string): number {
  const [datePart, timePart] = dateTimeStr.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart || "00:00").split(":").map(Number);

  // Create a date and format it to find the offset
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Use Intl to get what time it actually is in the timezone at that UTC time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(utcGuess));
  const localHour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10
  );
  const localMinute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10
  );

  // Calculate the offset and adjust
  const offsetMs =
    (localHour - hour) * 60 * 60 * 1000 + (localMinute - minute) * 60 * 1000;

  return utcGuess - offsetMs;
}

/**
 * Format a UTC timestamp as "YYYY-MM-DD HH:mm" in a timezone.
 */
function formatInTimezone(ts: number, timezone: string): string {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// ============================================================================
// getYesterdayWindow Tests
// ============================================================================

describe("getYesterdayWindow", () => {
  it("returns correct window for America/Chicago", () => {
    // At 9am CST on Dec 5, 2025 = 15:00 UTC
    const now = Date.UTC(2025, 11, 5, 15, 0, 0, 0);
    const window = getYesterdayWindow("America/Chicago", now);

    // Yesterday should be Dec 4 00:00 → Dec 5 00:00 CST
    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-05 00:00"
    );
  });

  it("returns correct window for Asia/Tokyo", () => {
    // At 9am JST on Dec 5, 2025 = 00:00 UTC
    const now = Date.UTC(2025, 11, 5, 0, 0, 0, 0);
    const window = getYesterdayWindow("Asia/Tokyo", now);

    expect(formatInTimezone(window.start, "Asia/Tokyo")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "Asia/Tokyo")).toBe("2025-12-05 00:00");
  });

  it("returns correct window for UTC", () => {
    // At 9am UTC on Dec 5
    const now = Date.UTC(2025, 11, 5, 9, 0, 0, 0);
    const window = getYesterdayWindow("UTC", now);

    expect(formatInTimezone(window.start, "UTC")).toBe("2025-12-04 00:00");
    expect(formatInTimezone(window.end, "UTC")).toBe("2025-12-05 00:00");
  });

  it("handles 30-minute offset timezone (India)", () => {
    // India is UTC+5:30, so 9am IST = 3:30 UTC
    const now = Date.UTC(2025, 11, 5, 3, 30, 0, 0);
    const window = getYesterdayWindow("Asia/Kolkata", now);

    expect(formatInTimezone(window.start, "Asia/Kolkata")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "Asia/Kolkata")).toBe(
      "2025-12-05 00:00"
    );
  });

  it("handles 45-minute offset timezone (Nepal)", () => {
    // Nepal is UTC+5:45, so 9am NPT = 3:15 UTC
    const now = Date.UTC(2025, 11, 5, 3, 15, 0, 0);
    const window = getYesterdayWindow("Asia/Kathmandu", now);

    expect(formatInTimezone(window.start, "Asia/Kathmandu")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "Asia/Kathmandu")).toBe(
      "2025-12-05 00:00"
    );
  });

  it("handles query at exactly midnight", () => {
    // Midnight CST on Dec 5 = 06:00 UTC
    const now = Date.UTC(2025, 11, 5, 6, 0, 0, 0);
    const window = getYesterdayWindow("America/Chicago", now);

    // At midnight Dec 5, "yesterday" is Dec 4
    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-05 00:00"
    );
  });

  it("handles query at 11:59pm", () => {
    // 11:59pm CST on Dec 5 = 05:59 UTC on Dec 6
    const now = Date.UTC(2025, 11, 6, 5, 59, 0, 0);
    const window = getYesterdayWindow("America/Chicago", now);

    // At 11:59pm Dec 5, "yesterday" is still Dec 4
    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-12-04 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-05 00:00"
    );
  });

  // DST Tests - These are crucial!
  // Note: To test DST day duration, query on the day AFTER the transition
  describe("DST transitions", () => {
    it("handles spring forward (23-hour day) - America/Chicago", () => {
      // In 2025, DST starts March 9 at 2am → 3am (23-hour day)
      // Query on March 10 to get March 9's window (yesterday)
      // At 9am CDT on March 10, 2025 = 14:00 UTC (CDT is UTC-5)
      const now = Date.UTC(2025, 2, 10, 14, 0, 0, 0);
      const window = getYesterdayWindow("America/Chicago", now);

      expect(formatInTimezone(window.start, "America/Chicago")).toBe(
        "2025-03-09 00:00"
      );
      expect(formatInTimezone(window.end, "America/Chicago")).toBe(
        "2025-03-10 00:00"
      );

      // Window should be 23 hours because DST started on March 9
      const durationHours = (window.end - window.start) / (1000 * 60 * 60);
      expect(durationHours).toBe(23);
    });

    it("handles fall back (25-hour day) - America/Chicago", () => {
      // In 2025, DST ends November 2 at 2am → 1am (25-hour day)
      // Query on November 3 to get November 2's window (yesterday)
      // At 9am CST on November 3, 2025 = 15:00 UTC (CST is UTC-6)
      const now = Date.UTC(2025, 10, 3, 15, 0, 0, 0);
      const window = getYesterdayWindow("America/Chicago", now);

      expect(formatInTimezone(window.start, "America/Chicago")).toBe(
        "2025-11-02 00:00"
      );
      expect(formatInTimezone(window.end, "America/Chicago")).toBe(
        "2025-11-03 00:00"
      );

      // Window should be 25 hours because DST ended on Nov 2
      const durationHours = (window.end - window.start) / (1000 * 60 * 60);
      expect(durationHours).toBe(25);
    });
  });
});

// ============================================================================
// getTodayWindow Tests
// ============================================================================

describe("getTodayWindow", () => {
  it("returns correct window for America/Chicago", () => {
    const now = toUtc("2025-12-05 09:00", "America/Chicago");
    const window = getTodayWindow("America/Chicago", now);

    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-12-05 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-06 00:00"
    );
  });
});

// ============================================================================
// getLastWeekWindow Tests
// ============================================================================

describe("getLastWeekWindow", () => {
  it("returns Sunday-to-Sunday window", () => {
    // Wednesday Dec 10, 2025
    const now = toUtc("2025-12-10 09:00", "America/Chicago");
    const window = getLastWeekWindow("America/Chicago", now);

    // Last week: Sunday Dec 1 → Sunday Dec 8
    // Wait, let me recalculate. Dec 10 is a Wednesday.
    // Most recent Sunday is Dec 7. Previous Sunday is Nov 30.

    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-11-30 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-07 00:00"
    );
  });

  it("handles when called on Sunday", () => {
    // Sunday Dec 7, 2025
    const now = toUtc("2025-12-07 09:00", "America/Chicago");
    const window = getLastWeekWindow("America/Chicago", now);

    // On Sunday, "last week" is the previous full week
    // Most recent completed week: Nov 30 → Dec 7
    expect(formatInTimezone(window.start, "America/Chicago")).toBe(
      "2025-11-30 00:00"
    );
    expect(formatInTimezone(window.end, "America/Chicago")).toBe(
      "2025-12-07 00:00"
    );
  });
});

// ============================================================================
// getMidnightUtcHour Tests
// ============================================================================

describe("getMidnightUtcHour", () => {
  it("returns correct hour for America/Chicago (winter)", () => {
    // CST is UTC-6, so midnight CST = 06:00 UTC
    const dec = new Date(2025, 11, 5); // December (standard time)
    expect(getMidnightUtcHour("America/Chicago", dec)).toBe(6);
  });

  it("returns correct hour for America/Chicago (summer)", () => {
    // CDT is UTC-5, so midnight CDT = 05:00 UTC
    const july = new Date(2025, 6, 5); // July (daylight time)
    expect(getMidnightUtcHour("America/Chicago", july)).toBe(5);
  });

  it("returns correct hour for Asia/Tokyo", () => {
    // JST is UTC+9, so midnight JST = 15:00 UTC (previous day)
    const dec = new Date(2025, 11, 5);
    expect(getMidnightUtcHour("Asia/Tokyo", dec)).toBe(15);
  });

  it("returns 0 for UTC", () => {
    const dec = new Date(2025, 11, 5);
    expect(getMidnightUtcHour("UTC", dec)).toBe(0);
  });

  it("handles 30-minute offset (India)", () => {
    // IST is UTC+5:30, so midnight IST = 18:30 UTC (previous day)
    // This means the hour is 18
    const dec = new Date(2025, 11, 5);
    const hour = getMidnightUtcHour("Asia/Kolkata", dec);
    // 18:30 UTC is the 18th hour
    expect(hour).toBe(18);
  });
});

// ============================================================================
// Formatting Tests
// ============================================================================

describe("formatReportDate", () => {
  it("formats date correctly in user timezone", () => {
    const ts = toUtc("2025-12-05 09:00", "America/Chicago");
    expect(formatReportDate(ts, "America/Chicago")).toBe("December 5, 2025");
  });

  it("handles timezone date boundary", () => {
    // 1am UTC on Dec 5 = Dec 4 7pm CST
    const ts = Date.UTC(2025, 11, 5, 1, 0, 0, 0);
    expect(formatReportDate(ts, "America/Chicago")).toBe("December 4, 2025");
    expect(formatReportDate(ts, "UTC")).toBe("December 5, 2025");
  });
});

describe("formatShortDate", () => {
  it("formats short date correctly", () => {
    const ts = toUtc("2025-12-05 09:00", "America/Chicago");
    expect(formatShortDate(ts, "America/Chicago")).toBe("Dec 5");
  });
});

describe("formatDateRange", () => {
  it("formats range within same year", () => {
    // Dec 1 midnight CST = Dec 1 06:00 UTC (CST is UTC-6)
    const start = Date.UTC(2025, 11, 1, 6, 0, 0, 0);
    // Dec 8 midnight CST = Dec 8 06:00 UTC
    const end = Date.UTC(2025, 11, 8, 6, 0, 0, 0);
    expect(formatDateRange(start, end, "America/Chicago")).toBe(
      "Dec 1 - Dec 7, 2025"
    );
  });

  it("formats range across years", () => {
    // Dec 29 midnight CST = Dec 29 06:00 UTC
    const start = Date.UTC(2025, 11, 29, 6, 0, 0, 0);
    // Jan 5 midnight CST = Jan 5 06:00 UTC
    const end = Date.UTC(2026, 0, 5, 6, 0, 0, 0);
    expect(formatDateRange(start, end, "America/Chicago")).toBe(
      "Dec 29, 2025 - Jan 4, 2026"
    );
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent times", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30000, "America/Chicago")).toBe("just now");
  });

  it("returns minutes for times within the hour", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60 * 1000, "America/Chicago")).toBe(
      "5 minutes ago"
    );
  });

  it("returns hours for times within the day", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, "America/Chicago")).toBe(
      "3 hours ago"
    );
  });

  it("returns 'yesterday' for 1 day ago", () => {
    const now = Date.now();
    expect(
      formatRelativeTime(now - 25 * 60 * 60 * 1000, "America/Chicago")
    ).toBe("yesterday");
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe("isValidTimezone", () => {
  it("returns true for valid IANA timezones", () => {
    expect(isValidTimezone("America/Chicago")).toBe(true);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("returns false for invalid timezones", () => {
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Not_A_Real_Zone")).toBe(false);
    // Note: Abbreviations like "CST" may or may not be accepted depending on JS engine
  });
});

describe("getTimezoneOrDefault", () => {
  it("returns valid timezone as-is", () => {
    expect(getTimezoneOrDefault("America/Chicago")).toBe("America/Chicago");
  });

  it("returns UTC for invalid timezone", () => {
    expect(getTimezoneOrDefault("Invalid")).toBe("UTC");
    expect(getTimezoneOrDefault(undefined)).toBe("UTC");
    expect(getTimezoneOrDefault(null)).toBe("UTC");
    expect(getTimezoneOrDefault("")).toBe("UTC");
  });
});

// ============================================================================
// isLocalSunday Tests
// ============================================================================

describe("isLocalSunday", () => {
  it("returns true when it's Sunday in UTC", () => {
    // Sunday Dec 7, 2025 at noon UTC
    const sundayUtc = Date.UTC(2025, 11, 7, 12, 0, 0, 0);
    expect(isLocalSunday(sundayUtc, "UTC")).toBe(true);
  });

  it("returns false when it's not Sunday in UTC", () => {
    // Monday Dec 8, 2025 at noon UTC
    const mondayUtc = Date.UTC(2025, 11, 8, 12, 0, 0, 0);
    expect(isLocalSunday(mondayUtc, "UTC")).toBe(false);
  });

  it("handles date-line edge case: UTC Saturday but local Sunday", () => {
    // Pacific/Kiritimati is UTC+14
    // At 11:00 UTC on Saturday Dec 6, 2025, it's Sunday Dec 7 01:00 in Kiritimati
    const saturdayUtc = Date.UTC(2025, 11, 6, 11, 0, 0, 0);
    expect(isLocalSunday(saturdayUtc, "UTC")).toBe(false);
    expect(isLocalSunday(saturdayUtc, "Pacific/Kiritimati")).toBe(true);
  });

  it("handles date-line edge case: UTC Sunday but local Monday", () => {
    // Pacific/Kiritimati is UTC+14
    // At 12:00 UTC on Sunday Dec 7, 2025, it's Monday Dec 8 02:00 in Kiritimati
    const sundayUtc = Date.UTC(2025, 11, 7, 12, 0, 0, 0);
    expect(isLocalSunday(sundayUtc, "UTC")).toBe(true);
    expect(isLocalSunday(sundayUtc, "Pacific/Kiritimati")).toBe(false);
  });

  it("handles America/Chicago correctly", () => {
    // Sunday Dec 7, 2025 at midnight CST = 06:00 UTC
    const sundayCst = Date.UTC(2025, 11, 7, 6, 0, 0, 0);
    expect(isLocalSunday(sundayCst, "America/Chicago")).toBe(true);

    // Saturday Dec 6, 2025 at 11pm CST = 05:00 UTC on Dec 7
    const saturdayCst = Date.UTC(2025, 11, 7, 5, 0, 0, 0);
    expect(isLocalSunday(saturdayCst, "America/Chicago")).toBe(false);
  });

  it("handles Asia/Tokyo correctly", () => {
    // Sunday Dec 7, 2025 at noon JST = 03:00 UTC
    const sundayJst = Date.UTC(2025, 11, 7, 3, 0, 0, 0);
    expect(isLocalSunday(sundayJst, "Asia/Tokyo")).toBe(true);

    // Sunday Dec 7, 2025 at 10am UTC = Monday Dec 8 at 7pm JST
    const lateSundayUtc = Date.UTC(2025, 11, 7, 16, 0, 0, 0);
    expect(isLocalSunday(lateSundayUtc, "Asia/Tokyo")).toBe(false);
  });
});

// ============================================================================
// Property-Based Sanity Tests
// ============================================================================

describe("window invariants", () => {
  const timezones = [
    "America/Chicago",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Europe/London",
    "UTC",
  ];

  it("yesterday window start is always before end", () => {
    const now = Date.now();
    for (const tz of timezones) {
      const window = getYesterdayWindow(tz, now);
      expect(window.start).toBeLessThan(window.end);
    }
  });

  it("today window starts where yesterday window ends", () => {
    const now = Date.now();
    for (const tz of timezones) {
      const yesterday = getYesterdayWindow(tz, now);
      const today = getTodayWindow(tz, now);
      expect(yesterday.end).toBe(today.start);
    }
  });

  it("window duration is approximately 24 hours (22-26 for DST)", () => {
    const now = Date.now();
    for (const tz of timezones) {
      const window = getYesterdayWindow(tz, now);
      const durationHours = (window.end - window.start) / (1000 * 60 * 60);
      expect(durationHours).toBeGreaterThanOrEqual(22);
      expect(durationHours).toBeLessThanOrEqual(26);
    }
  });
});
