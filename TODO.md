# TODO

## Sync Architecture Overhaul

The current sync/ingestion system has accumulated complexity: multiple entry points, scattered policy logic, caller-specific code, and leaky abstractions. Rather than patch incrementally, we're redesigning around Ousterhout's deep module principles.

**Goal**: A single, deep `SyncService` that hides all sync complexity behind a minimal interface.

### Phase 1: Pure Policy Module ✓

Create `convex/lib/syncPolicy.ts` — a pure, zero-I/O decision engine.

- [x] Define `SyncDecision` type: `{ action: 'start' | 'skip' | 'block', reason: string, metadata?: { cooldownMs?, blockedUntil? } }`
- [x] Implement `evaluate(installation, trigger, now)` → `SyncDecision`
  - Cooldown logic (manual sync throttle, stale bypass)
  - Rate-limit budget checks (minimum reserve, webhook protection)
  - Already-syncing guard
  - No-repos detection
- [x] Success criteria: every branch deterministic, unit-testable without mocks (48 tests passing)

### Phase 2: Sync Service Orchestrator ✓

Create or extend `convex/lib/syncService.ts` — the single entrypoint for all sync requests.

- [x] Implement `request({ installationId, trigger })` action:
  - Load installation state
  - Call `SyncPolicy.evaluate()`
  - On `start`: enqueue job, set `syncStatus = 'syncing'`
  - On `skip`/`block`: return decision to caller
- [x] Enforce "one active job per installation" invariant in enqueue path
- [x] Success criteria: no caller interprets timestamps, budgets, or status — they just call `request()` and get a decision (15 tests passing)

### Phase 3: Sync Worker ✓

Create `convex/actions/sync/processSyncJob.ts` — a single worker action for all sync execution.

- [x] Consume job with installation snapshot + repo list
- [x] Stream GitHub timeline events, update progress incrementally
- [x] Handle rate-limit: set `blockedUntil`, re-enqueue self, return
- [x] Finalize status on completion (`idle`) or failure (`error`)
- [x] Success criteria: idempotent retries safe; only one job active per installation (14 tests passing)

### Phase 4: Wire All Callers ✓

Migrate all sync triggers to use `SyncService.request()`.

- [x] Cron scheduler → `SyncService.request({ trigger: 'cron' })`
- [x] Webhook auto-backfill → `SyncService.request({ trigger: 'webhook' })`
- [x] Manual "Sync Now" UI → `SyncService.request({ trigger: 'manual' })`
- [x] Maintenance recovery → `SyncService.request({ trigger: 'maintenance' })`
- [x] Delete `adminStartBackfill` and any direct job-creation paths
- [x] Success criteria: All callers route through SyncService; tests pass (532 tests passing)

### Phase 5: Slim Status View-Model ✓

Replace complex status queries with a minimal contract.

- [x] Create `convex/sync/getStatus.ts` returning:
  ```typescript
  {
    state: 'idle' | 'syncing' | 'blocked' | 'error',
    canSyncNow: boolean,
    cooldownMs?: number,
    blockedUntil?: number,
    activeJobProgress?: { current: number, total: number },
    lastSyncedAt?: number,
    lastSyncError?: string,
  }
  ```
- [x] Normalize all user-facing error messages (hide raw Convex errors)
- [x] UI components depend only on this view-model — no direct access to `ingestionJobs` table (installations still used for listing)

### Phase 6: UI Refactor ✓

Update frontend to the new contract.

- [x] `IntegrationStatusBanner`: read `sync/getStatusForUser` for active sync state
- [x] `IntegrationHealthCard`: use `sync/getStatusForUser` for sync errors and last sync time
- [x] Remove direct `ingestionJobs.listActive` access from UI components
- [x] Success criteria: UI is a thin view layer over the status query

### Phase 7: Testing ✓

Comprehensive tests for the new architecture.

- [x] Policy unit tests — 48 tests, 100% line coverage, 93% branch coverage
- [x] Orchestrator tests — 15 tests covering all policy blocks, job creation, trigger behavior
- [x] Worker tests — 14 tests for state transitions, rate-limit handling, completion/failure
- [x] View-model tests — 21 tests for status derivation logic
- [x] Success criteria: 98 sync-related tests passing; pure functions fully covered

### Phase 8: Observability ✓

Consolidated metrics and logging.

- [x] Emit structured events from SyncService:
  - `sync.request` — installationId, trigger, result
  - `sync.job.started` — jobId, installationId, repoCount
  - `sync.job.progress` — jobId, current, total
  - `sync.job.blocked` — jobId, blockedUntil, reason
  - `sync.job.completed` — jobId, eventsIngested, durationMs
  - `sync.job.failed` — jobId, error
- [x] Ad-hoc log cleanup: Callers (`requestSync.ts`, `startBackfill.ts`) delegate cleanly; service-level logs provide useful debugging context alongside metrics

---

## Self-Healing UX

Users see "No events since X" banners but lack clear recovery paths. The system should auto-heal when data goes stale, show progress transparently, and provide manual fallback when automation fails.

**Goal**: Zero user intervention required for transient sync failures; clear "Sync Now" action when auto-recovery exhausted.

### Phase 1: Quick Wins ✓

Address immediate UX pain points.

- [x] Add dark mode classes to amber alert banners (IntegrationStatusBanner, IntegrationHealthCard)
- [x] Block empty report generation (pre-check event count in `generateScheduledReport.ts`)
- [x] Fix coverage contradiction (return 0% when events.length === 0, not 100%)
- [x] Fix type error in IntegrationStatusBanner (get installationId from syncStatuses)
- [x] Update test expectations for new coverage behavior

### Phase 2: Self-Healing Detection

Detect "sync succeeded with 0 events despite stale data" pattern and trigger automatic recovery.

- [ ] **Add "recovery" trigger type**
  - File: `convex/lib/syncPolicy.ts`
  - Add `"recovery"` to `SyncTrigger` union type
  - Document: Recovery syncs bypass normal cooldowns (like "stale" trigger)
  - Success: Type system enforces recovery trigger in SyncService calls

- [ ] **Detect zero-event pattern in finalize logic**
  - File: `convex/actions/sync/processSyncJob.ts` (finalize block, after setting syncStatus)
  - Check: `eventsIngested === 0 && (now - installation.lastEventTs > 3 * DAY_MS)`
  - Emit metric: `sync.zero_events_on_stale` with installationId, lastEventTs, syncWindow
  - Log warning with context (installationId, lastEventTs, syncWindow)
  - Success: Log entry appears when stale backfill finds 0 events

- [ ] **Schedule recovery sync on detection**
  - File: `convex/actions/sync/processSyncJob.ts` (in zero-event detection block)
  - Call: `ctx.scheduler.runAfter(5 * 60 * 1000, internal.actions.sync.processSyncJob, { installationId, trigger: "recovery", since: installation.lastEventTs })`
  - Success: Recovery job appears in ingestionJobs table 5 minutes after zero-event sync

- [ ] **Add unit tests for recovery trigger**
  - File: `convex/lib/__tests__/syncPolicy.test.ts`
  - Test: Recovery trigger bypasses cooldowns (like stale trigger)
  - Test: Recovery trigger respects rate-limit budget
  - Success: 2 new tests passing, coverage maintained

- [ ] **Add integration test for zero-event detection**
  - File: `convex/actions/sync/__tests__/processSyncJob.test.ts`
  - Test: Emits metric and schedules recovery when eventsIngested=0 and lastEventTs stale
  - Test: Does NOT schedule recovery when eventsIngested=0 but lastEventTs recent
  - Success: 2 new tests passing

### Phase 3: UI Recovery Indicators

Surface recovery state in UI with progress indicators and manual fallback.

- [ ] **Add "recovering" state to UserSyncStatus type**
  - File: `convex/sync/getStatus.ts`
  - Add `"recovering"` to state union: `'idle' | 'syncing' | 'blocked' | 'error' | 'recovering'`
  - Add optional fields: `recoveryAttempts?: number`, `nextRecoveryAt?: number`
  - Success: Type system enforces new state value

- [ ] **Add recovery tracking to installations schema**
  - File: `convex/schema.ts` (installations table)
  - Add fields: `recoveryAttempts: v.optional(v.number())`, `lastRecoveryAt: v.optional(v.number())`
  - These fields track retry count and timestamp for escalation logic
  - Success: Schema validation passes, fields queryable

- [ ] **Derive "recovering" state in getStatus logic**
  - File: `convex/sync/getStatus.ts` (status derivation logic)
  - Check: `installation.syncStatus === 'syncing' && lastJob?.metadata?.trigger === 'recovery'`
  - Return: `{ state: 'recovering', message: 'Automatically recovering stale data...', recoveryAttempts: installation.recoveryAttempts ?? 0 }`
  - Success: getStatusForUser returns "recovering" when recovery job active

- [ ] **Show recovery progress in IntegrationStatusBanner**
  - File: `components/IntegrationStatusBanner.tsx` (IntegrationWarningCard component)
  - When: `status.kind === 'stale_events' && syncState === 'recovering'`
  - Show: Spinner + "Recovering data..." message (no buttons)
  - Success: Banner shows progress indicator during recovery, not "Sync Now" button

- [ ] **Show "Sync Now" button when not recovering**
  - File: `components/IntegrationStatusBanner.tsx` (IntegrationWarningCard component)
  - When: `status.kind === 'stale_events' && syncState !== 'recovering'`
  - Show: "Sync Now" button (already implemented in handleSyncClick)
  - Success: Button visible when stale but not recovering

- [ ] **Add tests for recovery UI states**
  - File: `components/__tests__/IntegrationStatusBanner.test.tsx` (create if missing)
  - Test: Shows spinner + "Recovering..." when state=recovering
  - Test: Shows "Sync Now" button when state=idle and status=stale_events
  - Test: Hides both when state=syncing (normal sync)
  - Success: 3 new tests passing

### Phase 4: Observability & Escalation

Track recovery attempts and escalate repeated failures.

- [ ] **Add recovery metrics**
  - File: `convex/actions/sync/processSyncJob.ts` (finalize logic)
  - Emit on zero-event detection: `sync.zero_events_detected`
  - Emit on recovery start: `sync.recovery_triggered`
  - Emit on recovery success (eventsIngested > 0): `sync.recovery_succeeded`
  - Emit on recovery failure (eventsIngested = 0): `sync.recovery_failed`
  - Success: Metrics visible in Convex logs after recovery cycle

- [ ] **Increment recoveryAttempts on failure**
  - File: `convex/actions/sync/processSyncJob.ts` (recovery finalize logic)
  - When: Recovery sync also finds 0 events
  - Update: `installation.recoveryAttempts = (installation.recoveryAttempts ?? 0) + 1`
  - Success: recoveryAttempts increments after each failed recovery

- [ ] **Escalate after 3 failed attempts**
  - File: `convex/sync/getStatus.ts` (status derivation)
  - When: `installation.recoveryAttempts >= 3`
  - Return: `{ kind: 'webhook_failure', message: 'GitHub webhooks may have stopped. Check App installation.', actionUrl: githubInstallationSettingsUrl }`
  - Success: Banner changes to "Check App installation" after 3 failures

- [ ] **Reset recoveryAttempts on success**
  - File: `convex/actions/sync/processSyncJob.ts` (finalize logic)
  - When: Recovery sync ingests events (eventsIngested > 0)
  - Update: `installation.recoveryAttempts = 0`
  - Success: Counter resets after successful recovery

- [ ] **Add tests for escalation logic**
  - File: `convex/sync/__tests__/getStatus.test.ts`
  - Test: Returns "webhook_failure" status when recoveryAttempts >= 3
  - Test: Counter increments on each failed recovery
  - Test: Counter resets to 0 on successful recovery
  - Success: 3 new tests passing

---

## Cleanup (Non-Blocking)

Housekeeping items to address when convenient.

- [x] **Service worker build**: ~~Investigate `_async_to_generator is not defined` in `sw.js`~~ — No service worker/Workbox in project; stale task removed
- [x] **Health endpoint**: Fixed — Convex cloud uses `/version` endpoint (not `/health`); updated `checkConvexHealth()` accordingly

---

## Deleted Work

The following items from the previous TODO have been intentionally removed. They were attempting to incrementally fix a fundamentally broken system. The architectural overhaul above replaces them:

- ~~Manual Sync Stabilization~~ — replaced by Phases 1-6
- ~~Centralize Throttling + Rate-Limit Policy~~ — replaced by Phase 1 (SyncPolicy)
- ~~Tighten Sync Status View-Model Boundary~~ — replaced by Phase 5
- ~~Testing + Observability (old)~~ — replaced by Phases 7-8

The existing `githubIngestionService.ts` and `continuousSync.ts` files can be deleted or gutted once the new architecture is in place.
