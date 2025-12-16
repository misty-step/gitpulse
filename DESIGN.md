# Weekly Cron Migration → `midnightUtcHour`

## Architecture Overview
**Selected Approach**: `midnightUtcHour` indexed lookup + per-user local-Sunday filter (keep 168 UTC weekly jobs)

**Rationale**: Preserves the existing “no full table scans” cron strategy while fixing global timing. `midnightUtcHour` gives O(index) fanout by hour; local-Sunday filtering prevents “weekly at every midnight” mistakes and handles date-line timezones that require non-UTC-Sunday execution.

**Core Modules**
- `convex/crons.ts` – defines cron topology (24 daily, 168 weekly)
- `convex/actions/runWeeklyReports.ts` – weekly cron runner (fanout + guard + job-history)
- `convex/users.ts` – indexed schedule queries (`getUsersByMidnightHour`)
- `convex/lib/timeWindows.ts` – deep, pure timezone/date logic (add “is local Sunday?” API)
- `convex/actions/generateScheduledReport.ts` – builds weekly report with `getLastWeekWindow()`
- `convex/reportJobHistory.ts` – writes immutable run logs for observability/replay

**Data Flow**: Convex Cron (UTC day/hour) → `runWeeklyReports` → `users.getUsersByMidnightHour(midnightUtcHour)` → `timeWindows.isLocalSunday(now, tz)` filter → `generateScheduledReport.generateWeeklyReport` → `reportJobHistory.logRun`

**Key Decisions**
1. Keep 168 weekly jobs – required to hit “local Sunday midnight” for UTC± offsets crossing the date line.
2. Centralize “is local Sunday?” in `timeWindows` – avoids timezone logic leakage into cron runners.
3. Stop using `weeklyDayUTC` + `reportHourUTC` at runtime – deprecated fields remain only for migration compatibility.

## Requirements (from TASK.md)
- Weekly cron must stop querying `weeklyDayUTC + reportHourUTC` (deprecated).
- Weekly cron must query by `midnightUtcHour`, then run only when it’s Sunday in the user’s timezone.
- Acceptance: weekly cron uses `midnightUtcHour`; deprecated schedule fields removed from runtime behavior.

## Module: `WeeklyReportsCronRunner` (`convex/actions/runWeeklyReports.ts`)
Responsibility: fan out weekly report generation to eligible users for the current UTC day/hour, without leaking timezone math.

Public Interface:
```ts
export const run: InternalAction<{
  dayUTC: number;  // 0-6 (passed by cron, used for logging/history only)
  hourUTC: number; // 0-23
}>
```

Dependencies:
- Reads: `internal.users.getUsersByMidnightHour`
- Uses: `timeWindows.isLocalSunday` (new)
- Calls: `internal.actions.generateScheduledReport.generateWeeklyReport`
- Writes: `internal.reportJobHistory.logRun`

Error Handling:
- Per-user failures: catch, log (redacted), continue.
- Query failures: throw (cron retry/visibility via logs).

## Module: `UserScheduleQueries` (`convex/users.ts`)
Responsibility: expose a single indexed “who should run now?” lookup.

Public Interface:
```ts
export const getUsersByMidnightHour: InternalQuery<{
  midnightUtcHour: number;
  dailyEnabled?: boolean;
  weeklyEnabled?: boolean;
}, User[]>
```

Notes:
- `getUsersByWeeklySchedule` remains for migration only; weekly cron no longer calls it.

## Module: `TimeWindows` (`convex/lib/timeWindows.ts`)
Responsibility: deep module for timezone-aware day/week boundaries; extend to also answer “what weekday is it locally?”

Add Public Interface (minimal):
```ts
export function isLocalSunday(referenceTime: number, timezone: string): boolean;
```

Implementation Sketch:
- Use `Intl.DateTimeFormat({ timeZone, weekday: "short" })` once; compare to `"Sun"`.
- Keep pure/deterministic; no `Date.now()` inside the function.

## Core Algorithms

### `runWeeklyReports(dayUTC, hourUTC)`
1. `now = Date.now()`
2. `users = getUsersByMidnightHour({ midnightUtcHour: hourUTC, weeklyEnabled: true })`
3. If none: log + `reportJobHistory.logRun(type="weekly", usersAttempted=0, ...)` and return.
4. `eligible = users.filter(u => isLocalSunday(now, u.timezone ?? "UTC"))`
5. For each `u` in `eligible`:
   1. `generateWeeklyReport({ userId: u.clerkId, timezone: u.timezone })`
   2. count successes/failures
6. Log summary + write `reportJobHistory.logRun` using:
   - `usersAttempted = eligible.length` (not raw queried count)
   - `reportsGenerated`, `errors`, `durationMs`, `startedAt`, `completedAt`

### `isLocalSunday(referenceTime, timezone)`
1. `weekday = Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date(referenceTime))`
2. `return weekday === "Sun"`

## File Organization
Changes (planned):
- `convex/actions/runWeeklyReports.ts` – swap query + add Sunday filter
- `convex/lib/timeWindows.ts` – export `isLocalSunday`
- `convex/actions/__tests__/runWeeklyReports.test.ts` – update mocks/expectations; add Sunday filter tests
- `convex/lib/__tests__/timeWindows.test.ts` – add unit tests for `isLocalSunday`
- `convex/crons.ts` – no functional change; comments updated to reflect weekly behavior (optional)

## Integration Points

### Database / Indexes
- No schema change required: `users.by_midnightUtcHour` already exists.
- Deprecated indexes (`by_weeklySchedule`, `by_reportHourUTC`) remain until later migration cleanup.

### External Services
- None; weekly runner only orchestrates internal Convex actions.

### Env Vars
- None.

### Observability
- Structured logs via `convex/lib/logger.ts` (PII redaction already configured).
- Persistent run records via `reportJobHistory`:
  - Use `usersAttempted = eligible.length` to keep signal accurate.
  - Keep logging `dayUTC/hourUTC` for correlating to the cron job name.

## Infrastructure Notes (current repo)
- Quality gates: Lefthook runs `prettier`, `eslint`, `gitleaks` pre-commit; `typecheck`, `jest`, `convex typecheck`, `build` pre-push (`.lefthook.yml`).
- CI: GitHub Actions runs `typecheck`, `lint`, `test`, `pnpm audit`, deployment-config verification (`.github/workflows/ci.yml`).
- Coverage: Jest coverage reporting on PRs (`.github/workflows/coverage.yml`).
- Deploy: Vercel for Next.js + Convex deployments (see `vercel.json` + repo docs).
- Error tracking: Sentry is configured for Next.js (`sentry.*.config.ts`); Convex actions rely on structured logs + `reportJobHistory` today.

## State Management
- Server-only cron orchestration.
- Idempotency: weekly reports should be safe against duplicate cron execution; if not guaranteed today, enforce in `generateReport`/report storage (out of scope for this task).

## Error Handling Strategy
- Validation: reject impossible `hourUTC`/`dayUTC` early (optional guard).
- Per-user action errors: `logger.error({ err, userId }, ...)` and continue.
- Job-level failures: let throw bubble (cron visibility > silent partial success).

## Testing Strategy

### Unit (critical path, target 90%+ patch coverage)
- `timeWindows.isLocalSunday`:
  - UTC timezone: known Sunday timestamp returns true.
  - Date-line edge: a UTC timestamp that is Sunday in `Pacific/Kiritimati` but Saturday in UTC.
- `runWeeklyReports`:
  - Queries `getUsersByMidnightHour({ midnightUtcHour, weeklyEnabled:true })`.
  - Filters out non-Sunday users (mock `isLocalSunday` to true/false per user).
  - Writes `reportJobHistory` with `usersAttempted = eligible.length`.

### Mocking
- Keep the existing Convex ctx mocks (`tests/__mocks__/convexCtx`).
- Prefer mocking `timeWindows.isLocalSunday` rather than mocking `Intl` in cron-runner tests; test `Intl` behavior in `timeWindows` unit tests.

### Commands / Gates
- Local: `pnpm test -- runWeeklyReports` (or full `pnpm test`)
- CI: `pnpm typecheck`, `pnpm lint`, `pnpm test`, coverage via `pnpm test:coverage`

## Performance & Security Notes
- Perf: still one indexed query per cron invocation; filtering is in-memory over the hour-bucket only.
- Security: no new secrets; logs remain redacted (`userId`, `githubUsername`, tokens).

## Alternative Architectures Considered

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A | **Keep 168 jobs**, query `midnightUtcHour`, filter local Sunday | Simple, preserves indexing, handles date line | 168 cron definitions remain | **Chosen** |
| B | 24 jobs on UTC Sunday only | Fewer jobs | Misses users whose local Sunday midnight is UTC Saturday/Monday | Rejected |
| C | Single job scans all users hourly | Simplest cron config | Full scan (cost), worse latency, grows poorly | Rejected |
| D | “NextWeeklyRunAt” timestamp per user + single indexed due-time job | Fewer jobs, exact scheduling | New state machine + migrations + DST complexity | Future |

Scoring (Simplicity 40 / Module depth 30 / Explicitness 20 / Robustness 10):
- A: 9/10, 8/10, 9/10, 7/10 → best total
- D: 5/10, 8/10, 7/10, 9/10 → too much new surface for this fix

## ADR
Not required: no irreversible vendor/framework choice; change is localized scheduling logic within existing architecture.

## Open Questions / Assumptions
- Assumption: `midnightUtcHour` is accurate enough week-to-week; DST drift can shift stored hours (existing system risk, not introduced here).
- Assumption: weekly report generation is idempotent or tolerates rare duplicate cron execution.

## Validation Pass (self-review)
- Interfaces stay deep: cron runner stays orchestration-only; timezone logic lives in `timeWindows`.
- Dependencies explicit: only `users.getUsersByMidnightHour`, `timeWindows.isLocalSunday`, `generateWeeklyReport`, `reportJobHistory`.
- Tricky branches covered: “no users”, “non-Sunday users”, “some users fail”.
