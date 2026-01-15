# State Machine Documentation

This document contains Mermaid state diagrams for complex stateful flows in GitPulse.

## 1. Ingestion Job Lifecycle

Jobs track GitHub data sync progress per repository.

**States**: 6 (pending, running, blocked, completed, failed + zombie detection)
**Bug potential**: High - rate limits, zombie jobs, blocked state recovery

```mermaid
stateDiagram-v2
    [*] --> pending: create()

    pending --> running: processSyncJob() marks running

    running --> completed: All commits processed
    running --> blocked: Rate limit hit (429)
    running --> failed: Error thrown
    running --> failed: Zombie detection (10min+ stale)

    blocked --> running: Scheduler resumes at blockedUntil
    blocked --> [*]: Cleanup (24h old or 5min past blockedUntil)

    completed --> [*]: Cleanup (1h old)
    failed --> [*]: Cleanup (1h old)

    note right of blocked
        Self-schedules resume via
        ctx.scheduler.runAt(blockedUntil)

        Safety nets:
        - findStuckBlockedJobs (cron)
        - purgeExpiredBlocked (cron)
        - cleanOldBlockedJobs (24h)
    end note

    note right of running
        Zombie detection:
        cleanupStuckJobs() finds jobs
        with lastUpdatedAt > 10min ago
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/ingestionJobs.ts`
- `/Users/phaedrus/Development/gitpulse/convex/actions/sync/processSyncJob.ts`

---

## 2. Sync Batch Lifecycle

Batches coordinate multiple ingestion jobs (one per repo) for a single sync request.

**States**: 3 (running, completed, failed)
**Bug potential**: Medium - OCC races on counter updates, lazy finalization

```mermaid
stateDiagram-v2
    [*] --> running: create() with N repo jobs

    state running {
        [*] --> awaiting_jobs
        awaiting_jobs --> computing_state: Job completes/fails
        computing_state --> awaiting_jobs: More jobs pending
        computing_state --> ready_to_finalize: All jobs done
    }

    running --> completed: All jobs succeeded (or partial success)
    running --> failed: All jobs failed

    completed --> [*]
    failed --> [*]

    note right of running
        OCC-safe design:
        - Counters computed from jobs, not incremented
        - maybeFinalize() is idempotent
        - Lazy finalization via cron fallback
    end note

    note left of completed
        Triggers:
        - Installation syncStatus -> idle
        - lastSyncedAt updated
        - generateTodayDaily scheduled
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/syncBatches.ts`

---

## 3. Webhook Event Processing

Webhook events are enqueued for async processing to ensure <200ms GitHub ACK.

**States**: 4 (pending, processing, completed, failed)
**Bug potential**: Medium - retries, duplicate delivery handling

```mermaid
stateDiagram-v2
    [*] --> pending: enqueue() (idempotent via deliveryId)

    pending --> processing: Worker claims job

    processing --> completed: Event canonicalized + persisted
    processing --> pending: Retry (< 5 attempts)
    processing --> failed: Max retries exceeded

    completed --> [*]
    failed --> [*]: DLQ for manual inspection

    note right of pending
        Idempotency:
        - Check by_deliveryId before insert
        - Same deliveryId returns existing _id
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/webhookEvents.ts`
- `/Users/phaedrus/Development/gitpulse/convex/actions/github/processWebhook.ts`

---

## 4. Embedding Queue Lifecycle

Embedding jobs are content-addressed (by contentHash) for deduplication.

**States**: 3 (pending, processing, failed)
**Bug potential**: Medium - OCC races on claim, retry logic

```mermaid
stateDiagram-v2
    [*] --> skip: Already embedded (by_contentHash)
    [*] --> pending: enqueue() new contentHash

    pending --> processing: markProcessing() (idempotent)

    processing --> [*]: complete() deletes job
    processing --> pending: fail() with attempts < 5
    processing --> failed: fail() with attempts >= 5

    failed --> pending: Re-enqueue resets attempts

    note right of processing
        Claim guard:
        markProcessing() only succeeds
        if status === "pending"
        (prevents OCC race)
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/embeddingQueue.ts`
- `/Users/phaedrus/Development/gitpulse/convex/actions/embeddings/ensureBatch.ts`

---

## 5. Installation Sync Status

Tracks GitHub App installation sync state for UI display and throttling.

**States**: 4 (idle, syncing, rate_limited, error)
**Bug potential**: Medium - race between manual and cron syncs

```mermaid
stateDiagram-v2
    [*] --> idle: Installation created

    idle --> syncing: requestManualSync() or cron trigger

    syncing --> idle: Batch completed successfully
    syncing --> rate_limited: All jobs blocked
    syncing --> error: All jobs failed

    rate_limited --> syncing: Jobs resume after cooldown
    rate_limited --> idle: Jobs eventually complete

    error --> idle: Manual retry succeeds

    note right of syncing
        One-job-per-installation invariant:
        getActiveForInstallation() checks
        for running/pending/blocked jobs
    end note

    note left of idle
        Triggers post-sync:
        - lastSyncedAt updated
        - nextSyncAt computed
        - Report generation scheduled
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/schema.ts` (installations table)
- `/Users/phaedrus/Development/gitpulse/lib/integrationStatus.ts`

---

## 6. Report Regeneration Job

User-triggered report regeneration with progress tracking.

**States**: 7 (queued, collecting, generating, validating, saving, completed, failed)
**Bug potential**: High - long-running action, many failure points

```mermaid
stateDiagram-v2
    [*] --> queued: User triggers regenerate

    queued --> collecting: Start event collection
    collecting --> generating: Events collected, call LLM
    generating --> validating: LLM response received
    validating --> saving: Citations validated
    saving --> completed: Report saved to DB

    collecting --> failed: No events found
    generating --> failed: LLM error
    validating --> failed: Citation validation failed
    saving --> failed: DB write failed

    completed --> [*]
    failed --> [*]

    note right of generating
        Progress updates:
        - queued: 0%
        - collecting: 10%
        - generating: 30%
        - validating: 70%
        - saving: 90%
        - completed: 100%
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/convex/schema.ts` (reportRegenerations table)

---

## 7. Onboarding Flow (Frontend)

Linear 3-step wizard with conditional progression.

**States**: 3 steps + loading + redirect states
**Bug potential**: Low - linear flow, but has OAuth side-effect

```mermaid
stateDiagram-v2
    [*] --> loading: Page loads

    loading --> redirect_signin: !clerkUser && !isLoading
    loading --> redirect_dashboard: onboardingCompleted === true
    loading --> step1: User authenticated, not completed

    state step1 <<choice>>
    step1 --> step1_connect: !isGitHubConnected
    step1 --> step1_connected: isGitHubConnected

    step1_connect --> github_oauth: Click "Connect GitHub"
    github_oauth --> step1_connected: OAuth callback success
    step1_connected --> step2: Click "Continue"

    step2 --> step1: Click "Back"
    step2 --> step3: Click "Continue"

    step3 --> step2: Click "Back"
    step3 --> completing: Click "Complete Setup"

    completing --> redirect_dashboard: completeOnboarding() succeeds
    completing --> step3: Error (stays on step)

    note right of github_oauth
        Side effect:
        window.location.href = "/api/auth/github"
        Returns to same page after OAuth
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/app/onboarding/page.tsx`

---

## 8. GitHub OAuth Flow

Server-side OAuth with CSRF protection.

**States**: Spans multiple requests (init -> GitHub -> callback)
**Bug potential**: Medium - CSRF, token storage, preview deployment routing

```mermaid
sequenceDiagram
    participant U as User
    participant App as GitPulse
    participant GH as GitHub
    participant Convex as Convex DB

    U->>App: GET /api/auth/github
    App->>App: Generate CSRF state token
    App->>App: Set github_oauth_state cookie
    App->>U: Redirect to GitHub authorize URL

    U->>GH: Authorize (user consent)
    GH->>U: Redirect to callback with code + state

    U->>App: GET /api/auth/github/callback?code=X&state=Y
    App->>App: Verify state matches cookie

    alt State mismatch
        App->>U: Redirect /dashboard/settings?github=error
    else State valid
        App->>GH: POST /login/oauth/access_token
        GH->>App: access_token, refresh_token, expires_in

        App->>GH: GET /user (with token)
        GH->>App: GitHub user profile

        App->>Convex: updateGitHubAuth mutation
        Convex->>App: Success

        App->>App: Delete github_oauth_state cookie
        App->>U: Redirect /dashboard/settings?github=connected
    end
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/app/api/auth/github/route.ts`
- `/Users/phaedrus/Development/gitpulse/app/api/auth/github/callback/route.ts`

---

## 9. Integration Status State Machine

Derived status for UI banner display.

**States**: 6 (unauthenticated, missing_user, missing_installation, no_events, stale_events, healthy)
**Bug potential**: Low - read-only derivation

```mermaid
stateDiagram-v2
    [*] --> unauthenticated: No Clerk session

    unauthenticated --> missing_user: Clerk session exists
    missing_user --> missing_installation: Convex user exists
    missing_installation --> no_events: Installation exists
    no_events --> stale_events: Events exist but old
    no_events --> healthy: Recent events exist
    stale_events --> healthy: Fresh sync completes

    note right of missing_installation
        Attention states:
        - missing_installation
        - no_events
        - stale_events

        These trigger UI banner
    end note
```

**Key files**:
- `/Users/phaedrus/Development/gitpulse/lib/integrationStatus.ts`

---

## Complex Flows Still Undocumented

The following flows may benefit from diagrams if complexity increases:

1. **Scheduled Report Generation** (`convex/crons.ts`)
   - Currently straightforward: cron -> check midnightUtcHour -> filter Sunday -> generate
   - Low bug potential due to deep module design

2. **Content Hash Deduplication** (`convex/lib/contentHash.ts`)
   - Pure function, no state machine
   - Deterministic: same input -> same hash

3. **Report Cache Key Generation** (`convex/lib/reportOrchestrator.ts`)
   - Pure function combining (kind, userId, dates, contentHashAgg, promptVersion)
   - No state transitions

---

## Maintenance Notes

- Update diagrams when adding new states or transitions
- Test state transitions manually after major refactors
- Watch for zombie states (jobs stuck indefinitely)
- Monitor cron safety nets via Convex logs
