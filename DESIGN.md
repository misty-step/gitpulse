# DESIGN.md - GitPulse Architecture

This document shows how the system works without drowning you in details. Read this before the code.

## The Problem

GitHub activity is scattered across PRs, commits, reviews, and issues. Engineers need periodic summaries ("What did I ship this week?") with citations back to the source. Every claim must link to a verifiable GitHub URL.

## The Solution (One Sentence)

Content-addressed fact graph ingested from GitHub, transformed into cited AI reports.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA ACQUISITION                               │
│                                                                          │
│  GitHub API ──────┬──── Webhooks (real-time) ────┬──→ Raw Payloads      │
│                   │                               │                      │
│                   └──── REST Polling (backfill) ─┘                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           NORMALIZATION                                  │
│                                                                          │
│  Raw Payload ──→ canonicalizeEvent() ──→ CanonicalEvent                 │
│                         │                    │                           │
│                         │                    ├── canonicalText           │
│                         │                    ├── sourceUrl (citation)    │
│                         │                    ├── metrics {+/-/files}     │
│                         │                    └── contentHash (SHA-256)   │
│                         │                                                │
│                         └──→ persistCanonicalEvent() ──→ Convex DB      │
│                                    │                                     │
│                                    └──→ enqueueEmbedding()              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTELLIGENCE                                   │
│                                                                          │
│  Events + Embeddings ──→ generateReport() ──→ Report                    │
│              │                  │                 │                      │
│              │                  │                 ├── markdown           │
│              │                  │                 ├── citations[]        │
│              │                  │                 ├── coverageScore      │
│              │                  │                 └── cacheKey           │
│              │                  │                                        │
│              │                  ├── LLM (Gemini 2.5 Flash)              │
│              │                  └── Cache hit: <5s / miss: <60s         │
│              │                                                           │
│              └──→ Vector search (Voyage 1024-dim) for semantic queries  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPERIENCE                                     │
│                                                                          │
│  Next.js App Router ──→ Dashboard ──→ Reports with clickable citations  │
│                                                                          │
│  Automated: Daily standups at local midnight                            │
│             Weekly retros on Sunday midnight                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Deep Modules (The Important Parts)

These five modules hide most of the complexity. Understand their interfaces.

### 1. SyncService (`convex/lib/syncService.ts`)

**Interface:** `request({ installationId, trigger }) → SyncResult`

**Hides:**
- One-batch-per-installation invariant enforcement
- Policy evaluation (cooldowns, rate limits, blocked status)
- Batch + job creation (job-per-repo architecture)
- Worker scheduling with staggered delays
- Status lifecycle (idle → syncing → completed/error)

**You never:** manually check if a sync is running, calculate cooldowns, or manage job state.

### 2. Canonical Fact Service (`convex/lib/canonicalFactService.ts`)

**Interface:** `persistCanonicalEvent(ctx, canonical, options) → PersistResult`

**Hides:**
- User upsert (ensures actor exists)
- Repo upsert (ensures repository exists)
- SHA-256 content hashing
- Duplicate detection (idempotent on contentHash)
- Embedding queue scheduling

**You never:** manually hash events, check for duplicates, or manage user/repo entities.

### 3. Event Normalizer (`convex/lib/canonicalizeEvent.ts`)

**Interface:** `canonicalizeEvent(type, rawPayload) → CanonicalEvent | null`

**Hides:**
- GitHub payload variations (PR opened vs closed, commit vs push)
- Field extraction from nested structures
- Canonical text generation for each event type
- Metric extraction (additions, deletions, files changed)
- URL construction for citations

**You never:** parse raw GitHub payloads directly or build citation URLs.

### 4. Report Generator (`convex/lib/generateReport.ts`)

**Interface:** `generateReport(ctx, params) → GeneratedReport`

**Hides:**
- LLM provider selection and fallback
- Prompt template selection (daily vs weekly)
- Citation validation and extraction
- Coverage score computation
- Deterministic cache key generation
- Cost tracking

**You never:** call LLM APIs directly, validate citations, or compute coverage.

### 5. Time Windows (`convex/lib/timeWindows.ts`)

**Interface:** `isLocalSunday(now, timezone)`, `getMidnightUtcHour(timezone)`

**Hides:**
- Timezone conversion complexity
- DST handling
- UTC hour calculation for scheduling
- Day-of-week computation across timezones

**You never:** do timezone math manually or worry about DST edge cases.

## Database Tables (12 Total)

**Core entities:**
- `users` - GitHub profiles + Clerk linkage + schedule preferences
- `repos` - Repository metadata (stars, language, etc.)
- `events` - Activity facts with contentHash deduplication

**Intelligence:**
- `embeddings` - 1024-dim vectors with native Convex vector index
- `reports` - Generated reports with citations and coverage

**Orchestration:**
- `installations` - GitHub App metadata + sync state
- `ingestionJobs` - Per-repo sync jobs
- `syncBatches` - Groups jobs for one installation
- `webhookEvents` - Raw webhook envelope queue

**Supporting:**
- `userInstallations` - N:M user↔installation mapping
- `trackedRepos` - User repo selection preferences
- `embeddingQueue` - Pending embedding jobs

## Key Invariants

1. **Content-addressed deduplication:** Same event → same contentHash → one DB row
2. **One batch per installation:** Multiple sync requests queue, not race
3. **Citations are verifiable:** Every report claim links to a real GitHub URL
4. **Timezone-aware scheduling:** Reports generate at user's local midnight

## Where to Start Reading Code

1. **Understand a sync:** `convex/lib/syncService.ts` → `convex/actions/sync/processSyncJob.ts`
2. **Understand normalization:** `convex/lib/canonicalizeEvent.ts` → `convex/lib/canonicalFactService.ts`
3. **Understand reports:** `convex/lib/generateReport.ts` → `convex/actions/reports/`
4. **Understand scheduling:** `convex/crons.ts` → `convex/lib/timeWindows.ts`

## What This Doc Doesn't Cover

- UI components (see `components/` - standard React patterns)
- Auth flow (see Clerk docs + `convex/auth.config.ts`)
- Deployment (see `docs/deployment/`)
- Testing (see `docs/TESTING.md`)

## Red Flags to Watch

These indicate complexity leaking:

- **Shallow modules:** If you're calling multiple lib functions for one operation, something should wrap them
- **Manual hashing:** Use `persistCanonicalEvent`, not raw `computeContentHash`
- **Direct LLM calls:** Use `generateReport`, not raw API calls
- **Timezone math:** Use `timeWindows.ts`, not `Date` manipulation
- **Sync status checks:** Use `SyncService.request()`, not manual status queries
