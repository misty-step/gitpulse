import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Convex Cron Jobs for Automated Reports
 *
 * Per ultrathink design: 24 separate daily jobs + 168 separate weekly jobs.
 * Each job matches one UTC hour, queries users with matching reportHourUTC,
 * and generates reports for all of them.
 *
 * No runtime timezone math - hours pre-calculated at settings save.
 * No iteration through all users - indexed queries for efficiency.
 */

const crons = cronJobs();

// =============================================================================
// Daily Standup Jobs (24 jobs, one per UTC hour)
// =============================================================================

// Generate all 24 daily cron jobs (one for each UTC hour)
for (let hour = 0; hour < 24; hour++) {
  crons.daily(
    `daily-reports-utc-${hour.toString().padStart(2, "0")}`,
    { hourUTC: hour, minuteUTC: 0 },
    internal.actions.runDailyReports.run,
    { hourUTC: hour }
  );
}

// =============================================================================
// Weekly Retro Jobs (168 jobs, 7 days × 24 hours)
// =============================================================================

// Generate all 168 weekly cron jobs (one for each day/hour combination)
const daysOfWeek = [
  { name: "sunday", dayUTC: 0 },
  { name: "monday", dayUTC: 1 },
  { name: "tuesday", dayUTC: 2 },
  { name: "wednesday", dayUTC: 3 },
  { name: "thursday", dayUTC: 4 },
  { name: "friday", dayUTC: 5 },
  { name: "saturday", dayUTC: 6 },
] as const;

for (const day of daysOfWeek) {
  for (let hour = 0; hour < 24; hour++) {
    const dayAbbrev = day.name.substring(0, 3);
    crons.weekly(
      `weekly-reports-${dayAbbrev}-utc-${hour.toString().padStart(2, "0")}`,
      { dayOfWeek: day.name, hourUTC: hour, minuteUTC: 0 },
      internal.actions.runWeeklyReports.run,
      { dayUTC: day.dayUTC, hourUTC: hour }
    );
  }
}

export default crons;
