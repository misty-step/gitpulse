/**
 * Time Windows - Single Source of Truth for All Date Logic
 *
 * Deep module design (Ousterhout): simple interface, hides timezone complexity.
 * Used by: crons, report generation, UI display, event queries.
 *
 * Key insight: "A day is a user-local concept, not a UTC concept."
 *
 * All functions are pure and deterministic for easy testing.
 */

// ============================================================================
// Types
// ============================================================================

export interface DayWindow {
  /** UTC timestamp of day start (user's local midnight) */
  start: number;
  /** UTC timestamp of day end (user's next local midnight) */
  end: number;
}

export interface WeekWindow {
  /** UTC timestamp of week start (user's local Sunday midnight) */
  start: number;
  /** UTC timestamp of week end (user's next Sunday midnight) */
  end: number;
}

// ============================================================================
// Window Calculations
// ============================================================================

/**
 * Get yesterday's boundaries in user's timezone.
 *
 * Example: At 2am Chicago time on Dec 5:
 * - Returns window for Dec 4 00:00 CST → Dec 5 00:00 CST
 * - In UTC: Dec 4 06:00 UTC → Dec 5 06:00 UTC
 *
 * @param timezone - IANA timezone (e.g., "America/Chicago")
 * @param referenceTime - Optional "now" for testing (default: Date.now())
 */
export function getYesterdayWindow(
  timezone: string,
  referenceTime?: number
): DayWindow {
  const now = referenceTime ?? Date.now();

  // Get "today" in user's timezone
  const todayLocal = getLocalDateString(now, timezone);

  // Parse it back as midnight in that timezone
  const todayMidnight = parseLocalMidnight(todayLocal, timezone);

  // Yesterday is 24 hours before today's midnight
  const yesterdayMidnight = getLocalMidnightBefore(todayMidnight, timezone);

  return {
    start: yesterdayMidnight,
    end: todayMidnight,
  };
}

/**
 * Get "today's" window (midnight to midnight) in user's timezone.
 *
 * Useful for checking if events fall within "today".
 */
export function getTodayWindow(
  timezone: string,
  referenceTime?: number
): DayWindow {
  const now = referenceTime ?? Date.now();
  const todayLocal = getLocalDateString(now, timezone);
  const todayMidnight = parseLocalMidnight(todayLocal, timezone);
  const tomorrowMidnight = getLocalMidnightAfter(todayMidnight, timezone);

  return {
    start: todayMidnight,
    end: tomorrowMidnight,
  };
}

/**
 * Get a day's window N days ago in user's timezone.
 *
 * @param timezone - IANA timezone (e.g., "America/Chicago")
 * @param daysAgo - How many days back (0 = today, 1 = yesterday, 7 = a week ago)
 * @param referenceTime - Optional "now" for testing (default: Date.now())
 *
 * Example: getDayWindow("America/Chicago", 3) on Dec 10 returns Dec 7's window
 */
export function getDayWindow(
  timezone: string,
  daysAgo: number,
  referenceTime?: number
): DayWindow {
  const now = referenceTime ?? Date.now();

  // Get today's midnight
  const todayLocal = getLocalDateString(now, timezone);
  const todayMidnight = parseLocalMidnight(todayLocal, timezone);

  // Go back daysAgo days to get start
  const startMidnight =
    daysAgo === 0
      ? todayMidnight
      : getLocalMidnightNDaysBefore(todayMidnight, daysAgo, timezone);

  // End is midnight the next day
  const endMidnight = getLocalMidnightAfter(startMidnight, timezone);

  return {
    start: startMidnight,
    end: endMidnight,
  };
}

/**
 * Get last week's boundaries (Sunday to Sunday) in user's timezone.
 *
 * Example: On Wednesday Dec 11:
 * - Returns window for Sunday Dec 1 00:00 → Sunday Dec 8 00:00
 */
export function getLastWeekWindow(
  timezone: string,
  referenceTime?: number
): WeekWindow {
  const now = referenceTime ?? Date.now();

  // Get the most recent Sunday midnight
  const thisSundayMidnight = getMostRecentSundayMidnight(now, timezone);

  // Last week is the Sunday before that
  const lastSundayMidnight = getLocalMidnightNDaysBefore(
    thisSundayMidnight,
    7,
    timezone
  );

  return {
    start: lastSundayMidnight,
    end: thisSundayMidnight,
  };
}

/**
 * Get the UTC hour when midnight occurs in a timezone.
 *
 * Example: America/Chicago (UTC-6 in winter)
 * - Local midnight = 06:00 UTC
 * - Returns: 6
 *
 * Note: This changes with DST! America/Chicago is UTC-5 in summer.
 *
 * @param timezone - IANA timezone
 * @param date - Optional date to check (for DST-aware calculation)
 */
export function getMidnightUtcHour(timezone: string, date?: Date): number {
  const d = date ?? new Date();

  // Get midnight on that date in the timezone
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD format
  const midnightUtc = parseLocalMidnight(dateStr, timezone);

  // Extract the UTC hour
  return new Date(midnightUtc).getUTCHours();
}

/**
 * Get the UTC hour when Sunday midnight occurs in a timezone.
 *
 * Used for weekly report scheduling.
 */
export function getSundayMidnightUtcHour(
  timezone: string,
  date?: Date
): number {
  const d = date ?? new Date();

  // Find next Sunday
  const nextSunday = new Date(d);
  nextSunday.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));

  return getMidnightUtcHour(timezone, nextSunday);
}

// ============================================================================
// UI Formatting (Centralized)
// ============================================================================

/**
 * Format a timestamp as a human-readable date in user's timezone.
 *
 * Example: "December 4, 2025"
 */
export function formatReportDate(ts: number, timezone: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a timestamp as a short date.
 *
 * Example: "Dec 4"
 */
export function formatShortDate(ts: number, timezone: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date range.
 *
 * Example: "Dec 1 - Dec 7, 2025"
 */
export function formatDateRange(
  start: number,
  end: number,
  timezone: string
): string {
  const startDate = new Date(start);
  const endDate = new Date(end - 1); // -1ms so end of Dec 7 shows as Dec 7, not Dec 8

  const sameYear =
    startDate.toLocaleDateString("en-US", {
      timeZone: timezone,
      year: "numeric",
    }) ===
    endDate.toLocaleDateString("en-US", { timeZone: timezone, year: "numeric" });

  const startStr = startDate.toLocaleDateString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  const endStr = endDate.toLocaleDateString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startStr} - ${endStr}`;
}

/**
 * Format a relative time string.
 *
 * Examples: "2 hours ago", "yesterday", "3 days ago"
 */
export function formatRelativeTime(ts: number, timezone: string): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  // Fall back to formatted date
  return formatShortDate(ts, timezone);
}

/**
 * Format time of day.
 *
 * Example: "9:00 AM"
 */
export function formatTime(ts: number, timezone: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a timezone string is valid IANA timezone.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's timezone, with fallback to UTC.
 */
export function getTimezoneOrDefault(tz: string | undefined | null): string {
  if (tz && isValidTimezone(tz)) {
    return tz;
  }
  return "UTC";
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the date string (YYYY-MM-DD) for a timestamp in a timezone.
 */
function getLocalDateString(ts: number, timezone: string): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * Parse a YYYY-MM-DD string as midnight in the given timezone,
 * returning the UTC timestamp.
 *
 * Strategy: Binary search for the UTC timestamp that corresponds to
 * 00:00:00 in the target timezone on the given date.
 */
function parseLocalMidnight(dateStr: string, timezone: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);

  // Start with a guess: UTC midnight on this date
  // Then adjust based on what the local time actually is
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // For most timezones, the offset is between -12 and +14 hours
  // Try offsets in that range to find where local midnight falls
  for (let offsetHours = -14; offsetHours <= 14; offsetHours++) {
    const guess = utcMidnight - offsetHours * 60 * 60 * 1000;
    const localDateAtGuess = getLocalDateString(guess, timezone);
    const localTimeAtGuess = getLocalTimeString(guess, timezone);

    if (localDateAtGuess === dateStr && localTimeAtGuess === "00:00") {
      return guess;
    }
  }

  // Handle 30/45 minute offset timezones
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const guess = utcMidnight - offsetMinutes * 60 * 1000;
    const localDateAtGuess = getLocalDateString(guess, timezone);
    const localTimeAtGuess = getLocalTimeString(guess, timezone);

    if (localDateAtGuess === dateStr && localTimeAtGuess === "00:00") {
      return guess;
    }
  }

  // Fallback: just return UTC midnight (shouldn't happen for valid timezones)
  return utcMidnight;
}

/**
 * Get time string (HH:MM) for a timestamp in a timezone.
 */
function getLocalTimeString(ts: number, timezone: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Get the midnight of "today" (the day containing the timestamp) in a timezone.
 */
function getLocalMidnightOfDay(ts: number, timezone: string): number {
  const dateStr = getLocalDateString(ts, timezone);
  return parseLocalMidnight(dateStr, timezone);
}

/**
 * Get the midnight before a given midnight timestamp in a timezone.
 * Input should be a midnight timestamp; returns the previous day's midnight.
 */
function getLocalMidnightBefore(midnightTs: number, timezone: string): number {
  // Go back 12 hours from midnight to get into the previous day
  const earlier = midnightTs - 12 * 60 * 60 * 1000;
  return getLocalMidnightOfDay(earlier, timezone);
}

/**
 * Get the midnight after a given timestamp in a timezone.
 * Handles DST transitions correctly.
 */
function getLocalMidnightAfter(ts: number, timezone: string): number {
  // Get midnight of the day containing ts
  const todayMidnight = getLocalMidnightOfDay(ts, timezone);

  // Go forward to find the next day
  const later = todayMidnight + 36 * 60 * 60 * 1000; // Go forward 36 hours to be safe
  return getLocalMidnightOfDay(later, timezone);
}

/**
 * Get midnight N days before a given timestamp.
 */
function getLocalMidnightNDaysBefore(
  ts: number,
  days: number,
  timezone: string
): number {
  let currentMidnight = getLocalMidnightOfDay(ts, timezone);
  for (let i = 0; i < days; i++) {
    // Go back 12 hours from current midnight to get into the previous day
    const earlier = currentMidnight - 12 * 60 * 60 * 1000;
    currentMidnight = getLocalMidnightOfDay(earlier, timezone);
  }
  return currentMidnight;
}

/**
 * Get the most recent Sunday midnight before or at the given timestamp.
 */
function getMostRecentSundayMidnight(ts: number, timezone: string): number {
  const todayMidnight = getLocalMidnightOfDay(ts, timezone);

  // Get day of week for the date containing ts
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekdayStr = formatter.format(new Date(ts));
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekdayStr
  );

  // Go back to Sunday
  if (dayOfWeek === 0) {
    return todayMidnight;
  }
  return getLocalMidnightNDaysBefore(todayMidnight, dayOfWeek, timezone);
}
