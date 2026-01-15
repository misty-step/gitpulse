# 0004 – Timezone-Aware Midnight Scheduling

## Status
Accepted

## Context
Automated reports should arrive when users start their day—but "morning" is timezone-dependent. Initial implementation used fixed UTC hours, causing reports to arrive at inconvenient times (e.g., 3am for Pacific users). Weekly reports need to run on "Sunday" in the user's timezone, not UTC Sunday.

Alternatives considered:
1. **User selects delivery hour in UTC**: Confusing UX—users think in local time.
2. **Store preferred local hour, convert at runtime**: Requires timezone math on every cron tick. DST transitions cause drift.
3. **Precompute midnightUtcHour per user**: Store when local midnight occurs in UTC. Cron queries by hour, then filters by day.

## Decision
Use `midnightUtcHour` pattern:
- On user signup/timezone change, compute `midnightUtcHour = getMidnightUtcHour(timezone)`
- Daily cron: Query users by `midnightUtcHour`, generate reports
- Weekly cron: Query users by `midnightUtcHour`, filter by `isLocalSunday(now, timezone)`
- Time window calculations use `timeWindows.ts` (getYesterdayWindow, getLastWeekWindow)

Key implementation: `convex/lib/timeWindows.ts`
- All functions take timezone parameter
- Binary search for midnight in arbitrary timezones
- DST-safe: recalculate `midnightUtcHour` when DST changes (deferred)

## Consequences
**Benefits:**
- Reports generated at local midnight (arrive by morning)
- Indexed queries: `by_midnightUtcHour` enables efficient hourly scans
- Weekly reports only run when it's actually Sunday locally
- Centralized timezone logic—UI/crons/reports all use same module

**Tradeoffs:**
- `midnightUtcHour` is approximate for non-hour-aligned timezones (e.g., Asia/Kolkata UTC+05:30)
- DST transitions require `midnightUtcHour` recalculation (not yet implemented)
- DateTimeFormatter caching needed for performance with many users

**Known limitations:**
- Non-hourly timezone support deferred (affects ~30 timezones)
- Invalid timezone falls back to UTC without warning (improvement needed)
- Deprecated fields (`reportHourUTC`, `weeklyDayUTC`) retained for migration
