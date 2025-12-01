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

## Cleanup (Non-Blocking)

Housekeeping items to address when convenient.

- [ ] **Service worker build**: Investigate `_async_to_generator is not defined` in `sw.js` (Workbox/bundling config issue)
- [ ] **Health endpoint**: Fix `/api/health?deep=1` returning 503 in dev, or adjust dashboard interpretation for local environments

---

## Deleted Work

The following items from the previous TODO have been intentionally removed. They were attempting to incrementally fix a fundamentally broken system. The architectural overhaul above replaces them:

- ~~Manual Sync Stabilization~~ — replaced by Phases 1-6
- ~~Centralize Throttling + Rate-Limit Policy~~ — replaced by Phase 1 (SyncPolicy)
- ~~Tighten Sync Status View-Model Boundary~~ — replaced by Phase 5
- ~~Testing + Observability (old)~~ — replaced by Phases 7-8

The existing `githubIngestionService.ts` and `continuousSync.ts` files can be deleted or gutted once the new architecture is in place.
