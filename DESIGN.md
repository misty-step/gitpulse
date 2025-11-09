## Architecture Overview
**Selected Approach**: Dual-Stream Content-Addressed Fact Graph
**Rationale**: Shares one fact pipeline for webhook firehose + resumable backfills, keeps Convex as SoR, constrains LLM spend via deterministic hashes + caches. Aligns with GitHub App queue-first best practices and current stack (Next.js + Convex) so dev velocity stays high.

**Core Modules**
- GitHub Integration Service – receives & authenticates installs, webhooks, and backfill requests, pushes jobs into prioritized queues.
- Canonical Fact Service – normalizes payloads, enforces schemas, computes content hashes, writes facts/metrics into Convex.
- Embedding & Cache Service – batches Voyage/OpenAI embeddings keyed by contentHash, exposes ensureEmbeddings API + monitors spend.
- Report Orchestrator – selects facts per scope/window, guarantees coverage + citations, dispatches LLM calls with caching/fallbacks, persists reports.
- Scheduler & Automation – cron + Temporal-style retries for daily/weekly runs, ingestion reconciliation, secret rotation hooks.
- Experience & Observability Layer – React UI for reports/coverage + metrics emitters/log streams for ingestion, LLM cost, rate limits.

**Data Flow**: GitHub App → GitHub Integration Service → Canonical Fact Service → (Convex events + embeddings) → Report Orchestrator → Reports table → Next.js dashboard.

**Key Decisions**
1. Content-addressed EventFacts + coverage scoring drive caching + no double-spend (simplicity + robustness).
2. Shared module between webhook + backfill ensures no duplicated parsing, deep module boundary (module depth).
3. Queue-first ingestion with DLQ + reconciliation job handles rate-limit + webhook loss (robustness) without extra infra.
4. Report cache keyed by (scope, window, contentHashAgg, promptVersion) to cap LLM cost and deliver ≤60 s SLA.

## Module: GitHub Integration Service
Responsibility: hide GitHub App auth, webhook verification, and rate-limit aware ingestion scheduling.

Public Interface:
```typescript
interface GitHubIntegrationService {
  verifyAndEnqueueWebhook(evt: GitHubWebhookEnvelope): Promise<void>
  startBackfill(input: BackfillRequest): Promise<IngestionJobId>
  reconcileInstallation(installationId: number, cursor?: string): Promise<void>
}
```

Internal Implementation:
- Edge endpoint `/api/webhooks/github` validates `X-Hub-Signature-256`, stores payload envelope in Convex `webhookEvents` table, then enqueues `internal.actions.github.processEvent` on high-priority queue.
- Installation metadata stored in Convex `installations` collection (installationId, org, repositories, etags, lastCursor, rateLimitBudget).
- Backfill requests create `ingestionJobs` rows, push tasks into low-priority queue. Workers obey shared rate-limit cache (convex action storing `remaining`, `resetAt`).
- Reconciliation cron (hourly) uses stored `etag`/`cursor` to call GitHub GraphQL with conditional requests; only diffs processed.

Dependencies:
- Convex tables: `users`, `repos`, `ingestionJobs`, new `installations`, `webhookEvents`.
- External: GitHub App creds (private key, app id, webhook secret), GitHub REST/GraphQL APIs.
- Used by: Canonical Fact Service (downstream), Scheduler (for retries/cron).

Data Structures:
```typescript
type GitHubWebhookEnvelope = {
  id: string; // delivery
  event: string;
  payload: unknown;
  installationId: number;
  receivedAt: number;
};

type BackfillRequest = {
  installationId: number;
  repos: string[];
  since: number;
  until?: number;
  resumeCursor?: string;
};
```

Error Handling:
- Invalid signature → 401 + log metric, no enqueue.
- Rate-limit/abuse → worker marks job `blocked`, schedules retry at reset time.
- Missing installation → auto-clean job + emit alert; user prompted to reinstall.

## Module: Canonical Fact Service
Responsibility: convert raw GitHub payloads into deterministic EventFacts with hashes + metadata.

Public Interface:
```typescript
interface CanonicalFactService {
  upsertFromWebhook(evt: GitHubWebhookEnvelope): Promise<FactWriteResult>
  upsertFromBackfill(item: GitHubTimelineItem, context: BackfillContext): Promise<FactWriteResult>
}
```

Internal Implementation:
- Shared `canonicalizeEvent(payload, repoDoc)` returns `{type, actorId, repoId, ts, canonicalText, metrics, sourceUrl, metadata}`.
- Compute `contentHash = sha256(canonicalText + sourceUrl + JSON.stringify(metrics))`.
- Check Convex `events` for existing fact via `by_contentHash` index (new). If present, skip write, else insert with `createdAt` + `factMetrics`.
- Maintains `coverageCandidates` table (factId + reportScope + window) for later coverage calculation.
- Emits tracing log (`fact.upserted`, `fact.duplicate`, `fact.invalid`).

Dependencies:
- Uses `api.users.upsert`, `api.repos.upsert` to resolve foreign keys.
- Calls Embedding & Cache Service for any new `contentHash` via `ensureEmbeddings` async dispatch.

Data Structures:
```typescript
type EventFact = Doc<"events"> & {
  canonicalText: string;
  metrics?: { additions?: number; deletions?: number; filesChanged?: number };
  sourceUrl: string;
  contentHash: string;
  contentScope: "event" | "timeslice";
};
```

Error Handling:
- Missing actor/repo → retries after upserting user/repo; if still missing, send to DLQ with payload snapshot.
- Schema violations → log + move to `webhookEvents` DLQ for manual inspection.

## Module: Embedding & Cache Service
Responsibility: maintain Voyage/OpenAI embeddings per contentHash and expose cache hits for LLM context.

Public Interface:
```typescript
interface EmbeddingService {
  ensureEmbeddings(hashes: string[]): Promise<void>
  getEmbedding(hash: string): Promise<Embedding | null>
}
```

Internal Implementation:
- Background action `actions/embeddings.ensureBatch` pulls up to N hashes from `embeddingQueue` table.
- Deduplicate via `pendingHashSet` (Convex doc). Submit to Voyage batch endpoint (preferred) else OpenAI fallback. Store vector + provider metadata.
- Track spend per provider in `embeddingCosts` doc for observability dashboard.

Dependencies:
- Convex `embeddings` table (add `contentHash` field + unique index), environment keys `VOYAGE_API_KEY`, `OPENAI_API_KEY`.
- Called by Canonical Fact Service + Report Orchestrator (for RAG lookups).

Error Handling:
- Provider 429 → exponential backoff, requeue hash with `retryAfter`.
- Payload too large → split canonical text (first 2k chars) before embedding.

## Module: Report Orchestrator
Responsibility: deterministic report generation with coverage + citations + caching.

Public Interface:
```typescript
interface ReportOrchestrator {
  generateReport(input: ReportRequest): Promise<Id<"reports">>
  computeCoverage(reportId: Id<"reports">): Promise<CoverageSummary>
}
```

`ReportRequest = { kind: "daily" | "weekly" | "adhoc"; scope: Scope; start: number; end: number; force?: boolean }`

Internal Implementation:
- Stage C: query EventFacts via `events.by_actor_and_ts`/`by_repo_and_ts`, filter by scope/timeframe, require embeddings ready (if not, enqueue and wait with timeout). Build `AllowedUrl[]`, `coverageCandidates`, `contentHashAgg = sha256(sorted(hashes))`.
- Cache lookup: query `reports` for matching `(scope, kind, start, end, contentHashAgg, promptVersion)` if `force` false. Return cached doc if found (<5 s response).
- Otherwise Stage D: call `LLMClient.generate` with prompt (daily uses Gemini Flash, weekly uses Gemini Pro). Validator ensures headings + citations. On failure, fallback to GPT-5 via `LLMClient(auto)`. Synthetic builder last resort.
- Compute `coverageScore = usedFacts / candidateFacts` and breakdown per repo/user. Persist along with `citations[]`, `sections[]`, `HTML`, `costUsd` from `LLMClient` metadata.

Dependencies:
- Embedding Service, LLMClient, Convex `reports` table, `coverageCandidates`.
- Triggered by Scheduler (automated) and Next.js UI (manual).

Error Handling:
- Missing data (<3 facts) → store low-coverage report with warning flag, notify UI via `report.status = "insufficient_data"`.
- LLM failure → fallback chain + synthetic summary, log metric.

## Module: Scheduler & Automation
Responsibility: orchestrate recurring jobs, retries, secret rotations.

Components:
- Convex cron tasks `runDailyReports`, `runWeeklyReports`, `reconcileIngestion`, `rotateSecrets`.
- Optional Temporal workflow wrappers (flagged) for long backfills or multi-tenant scheduling. Workflow steps: Acquire token → check rate limit cache → fetch page → canonicalize.
- Maintains `jobsHistory` table for audit.

Interfaces:
```typescript
interface Scheduler {
  enqueueDaily(userId: string): Promise<void>
  enqueueWeekly(userId: string): Promise<void>
  scheduleBackfill(job: IngestionJobRef): Promise<void>
}
```

Error Handling: max retries 5 with exponential delay; on failure mark job `failed`, surface to UI.

## Module: Experience & Observability Layer
Responsibility: deliver UI + monitoring.

- Next.js App Router route `app/dashboard/reports/page.tsx` fetches `reports.list` + `reportCoverage.get` (new query) to render coverage meter, citations drawer, job history.
- `useReportGeneration` hook handles manual triggers, listens to job events via Convex live query.
- Observability: `lib/metrics.ts` wraps `console.log` style events into structured logs (JSON) for ingestion -> e.g. `events_ingested`, `report_latency_ms`, `llm_cost_usd`.
- Sentry instrumentation for UI errors; Convex logs for backend.

## Core Algorithms
### verifyAndEnqueueWebhook
1. Extract signature headers, compute HMAC with current + previous webhook secret (for rotation window).
2. If mismatch → 401 + metrics.
3. Persist envelope `{deliveryId, event, installationId, payload, receivedAt}`.
4. Push job `{type:"webhook", deliveryId}` onto high-priority queue (Convex action or Temporal signal).
5. Respond 200 immediately (<200 ms).

### processWebhookJob
1. Load envelope, ensure idempotency via `processedDeliveries` set.
2. Switch on event type; map to canonical payload (PR, commit, review, issue, push forced flag).
3. Call `CanonicalFactService.upsertFromWebhook` per derived facts.
4. If push event w/ `forced==true`, mark affected repo windows dirty (re-run coverage + cache invalidation).
5. Ack job, delete envelope if retention window passed.

### startBackfill
1. Validate scope + user permissions, fetch installation token.
2. Create/continue `ingestionJob` doc with cursor.
3. While rate-limit budget > threshold and repos remaining:
   - Fetch next page via GraphQL `search` or REST with `If-None-Match`.
   - For each timeline item, map to canonical fact and upsert.
   - Update cursor, budget, progress.
4. Persist stats, pause job when rate-limit low; scheduler resumes after reset.

### generateReport
1. Gather scope facts + compute `contentHashAgg`.
2. Check report cache; return if found unless `force` true.
3. Ensure embeddings ready (await up to 10 s). If timeout, degrade to text-only context.
4. Build prompt payload w/ `AllowedUrls`, coverage target metadata, cost guardrails.
5. Call `LLMClient.generate` primary → fallback as needed.
6. Validate headings + citation count (≥90 % sentences). If fail, re-prompt once; else fallback synthetic.
7. Persist report doc + coverage + cost + `cacheKey`.
8. Emit metrics.

### computeCoverage
1. Load `coverageCandidates` for scope/window.
2. Count facts referenced in report (match by `_id` or `contentHash`).
3. coverageScore = used / total; store breakdown.
4. Surface meter + warning if <70 %.

## File Organization
```
convex/
  actions/
    github/
      enqueueWebhook.ts
      processWebhook.ts
      startBackfill.ts
      reconcileInstallation.ts
    reports/
      generateDaily.ts
      generateWeekly.ts
      generateAdhoc.ts
    embeddings/
      ensureBatch.ts
  lib/
    canonicalizeEvent.ts
    contentHash.ts
    githubApp.ts
    queues.ts
    coverage.ts
  schema.ts (add installations, webhookEvents, coverageCandidates, cache indexes)
app/
  api/webhooks/github/route.ts
  dashboard/reports/
    page.tsx
    components/CoverageMeter.tsx
    components/CitationDrawer.tsx
    hooks/useReportGeneration.ts
lib/
  metrics.ts
  llm/
    prompts.ts
    cache.ts
```

Existing files touched:
- `convex/schema.ts`: new tables/fields + indexes.
- `convex/actions/generateScheduledReport.ts`: refactor into `reports/` orchestrator modules.
- `convex/events.ts`: extend schema for `contentHash`, indexes.
- `app/dashboard/...`: add coverage UI + job history.
- `middleware.ts`: ensure webhook route stays public.

## Integration Points
- **GitHub App**: requires env vars `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`. Installation tokens minted via `githubApp.ts` helper. Webhook endpoint registered at `/api/webhooks/github`.
- **LLM Providers**: `GEMINI_API_KEY`, `OPENAI_API_KEY`. All calls go through `LLMClient`; zero-retention mode toggled via env flag.
- **Embedding Provider**: `VOYAGE_API_KEY` primary, fallback OpenAI.
- **Secret Manager**: script/cron rotates webhook secret + private keys; integration placeholder for AWS Secrets Manager or Doppler.
- **Monitoring**: optional Sentry DSN, DataDog/OTel exporters via `METRICS_ENDPOINT` env.

## State Management
- Server state resides in Convex (EventFacts, reports, jobs). All mutations via Convex actions/mutations.
- Client state limited to transient UI (selected scope, time range). Use React state + server components to fetch authoritative data.
- Caching: report cache at backend; client uses SWR/React cache keyed by reportId.
- Invalidation: new fact touching scope → mark cached reports dirty (store `dirtyWindows` per scope). On ingest, call `reports.invalidate({scope, window})` to drop cache entries.
- Concurrency: idempotent writes via `contentHash`, queue ordering ensures per-repo serialism when needed.

## Error Handling Strategy
- **Validation errors**: return 4xx to caller, log `validation_error`, no retries.
- **Rate-limit/Abuse**: mark job blocked, schedule resume at `resetAt`, notify via alert metric.
- **Provider failures (LLM/embedding)**: retry w/ exponential backoff up to 3 times, then fallback provider, else synthetic summary; log severity WARN.
- **System faults**: log structured error, push to DLQ with payload reference.
- Response format for UI queries includes `status`, `warnings[]`, `coverageScore` for transparency.

## Testing Strategy
- **Unit**: `lib/canonicalizeEvent.test.ts`, `lib/contentHash.test.ts`, `lib/coverage.test.ts`, `lib/llm/cache.test.ts`. Cover edge payloads, hash determinism, coverage math.
- **Integration**: Fake webhook payload → Convex action → EventFact inserted; ensures idempotency + coverage candidate creation. Another test ensures report cache reuse + invalidation.
- **LLM contract tests**: golden prompts/responses with mock LLM to validate heading/citation enforcement.
- **E2E**: Playwright/Cypress flow: connect repo, ingest sample data, generate report, verify coverage meter + citations clickable.
- Commands: `pnpm lint`, `pnpm typecheck`, `pnpm exec jest --runInBand`, `pnpm e2e` (custom script) prior to PR.

## Performance & Security Notes
- Target throughput: ≥5 repos/min backfill, 50 webhook events/sec bursts. Use batch writes + conditional requests.
- Report latency: cache hit <5 s, miss <60 s incl embedding gating.
- Security: Webhook signature + dual-secret rotation, GitHub App short-lived tokens, least-privilege scopes, store secrets in manager not repo.
- Data access: scope enforcement—report queries verify user/tenant membership before returning facts.
- Rate-limit telemetry logged to detect approaching limits; auto-pauses backfill before exhaustion.

## Alternative Architectures Considered
| Option | Pros | Cons | Rubric (Simplicity 40 / Module depth 30 / Explicitness 20 / Robustness 10) | Verdict | Revisit Trigger |
| --- | --- | --- | --- | --- | --- |
| Dual-Stream Fact Graph (chosen) | Works with current Convex stack, shared canonicalizer, deterministic caching | Requires queue discipline + new tables | S:4.5 M:4.2 E:4.0 R:4.0 → **4.23** | Build now | Revisit if Convex limits hit (>10M facts) |
| Nightly Batch Summarizer | Minimal infra, single cron | Slow feedback, duplicates work on retries, can’t meet ≤60 s | S:3.8 M:2.5 E:2.5 R:3.0 → 3.15 | Reject | Only if product pivots to weekly-only insights |
| Warehouse-First (Aurora/pgvector + dbt) | Strong analytics, SQL governance | Heavy migration, new skillset, more ops | S:2.5 M:3.5 E:3.0 R:3.5 → 3.05 | Defer | Consider when enterprise tenants require warehouse export primary |
| Event Bus + Microservices (Kafka, Temporal) | Max scale, language freedom | Overkill now, slower iteration, more infra | S:2.8 M:3.8 E:3.2 R:4.5 → 3.35 | Defer | When sustained >100 events/sec real-time load |

## Open Questions / Assumptions
1. Pilot scale (repos/users) still unknown → needed for queue sizing. *Owner: Product, Due Nov 12 2025.*
2. Non-GitHub sources (Jira/Slack) excluded for MVP? assumed yes. *Owner: Product, Nov 12.*
3. Delivery channels limited to in-app + copy/export for MVP? *Owner: Design, Nov 10.*
4. Gemini hosting path (Vertex vs direct) pending security review. *Owner: Security, Nov 14.*
5. Temporal adoption allowed in Q1? assumption: optional, confirm. *Owner: Platform, Nov 18.*
6. PagerFit scoring out of scope? assumed future iteration. *Owner: Exec, Nov 15.*
7. Billing exports not Day 1? assumed telemetry only. *Owner: Finance, Nov 20.*

