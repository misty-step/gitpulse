
### [Reliability] Weekly Cron Migration to midnightUtcHour
**File**: `convex/actions/runWeeklyReports.ts`
**Perspectives**: consultant audit (Risk 4), carmack, grug
**Impact**: Weekly cron uses deprecated `weeklyDayUTC + reportHourUTC`. Wrong timing for global users.
**Fix**: Query by `midnightUtcHour` + Sunday detection (match daily pattern):
```typescript
// Current: Legacy schedule fields
const users = await ctx.runQuery(internal.users.getUsersByWeeklySchedule, {
  weeklyDayUTC: args.dayUTC,
  reportHourUTC: args.hourUTC,
});

// Fixed: Use midnightUtcHour + isSunday logic
const users = await ctx.runQuery(internal.users.getUsersByMidnightHour, {
  midnightUtcHour: args.hourUTC,
  weeklyEnabled: true,
});
// Filter for Sunday in user's timezone
```
**Effort**: 2h | **Risk**: MEDIUM | **Benefit**: Correct weekly timing globally
**Acceptance**: Weekly cron uses midnightUtcHour, deprecated fields removed from runtime

---

