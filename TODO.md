# TODO

## Phase 1 – Ingestion Foundation
- [x] Scaffold Convex schema updates for installations + webhook envelopes
  ```
  Files: convex/schema.ts, convex/installations.ts (new helpers)
  Goal: add `installations`, `webhookEvents`, `coverageCandidates`, new indexes on `events.contentHash`/`reports.cacheKey` per DESIGN §Module boundaries.
  Success: Convex schema compiles (`pnpm convex typecheck`), new tables accessible via generated API.
  Tests: `pnpm typecheck`, ad-hoc Convex query smoke via dashboard.
  Estimate: 1h
  Completed: b359f76 - 9 new indexes added, TypeScript + Convex validation passed
  ```
- [x] Implement `/api/webhooks/github` route with dual-secret verification
  ```
  Files: app/api/webhooks/github/route.ts, lib/github/verifySignature.ts (new)
  Goal: accept GitHub App webhooks, verify signature using current+prior secret, store envelope via Convex mutation `webhookEvents.enqueue`.
  Success: Sending sample webhook returns 200 <200ms; invalid signature 401.
  Tests: Unit for `verifySignature`, integration via mocked Next.js request handler.
  Dependencies: Convex schema from previous task.
  Estimate: 1.5h
  Completed: 9e87c51 - HMAC-SHA256 verification with timing-safe comparison, idempotent enqueue, middleware configured
  ```
- [x] Build GitHub Integration actions (enqueue + process)
  ```
  Files: convex/actions/github/processWebhook.ts, convex/actions/github/scheduler.ts, convex/actions/github/startBackfill.ts (stub)
  Goal: enqueue envelopes in high-priority queue, process per DESIGN pseudocode (idempotency, push forced flag, DLQ).
  Success: Convex action logs webhook processing, DLQ path reachable.
  Tests: Convex simulation with mock payloads; unit tests for canonicalization dependencies.
  Dependencies: schema + webhook route ready.
  Estimate: 2h
  Completed: 02e9580 - Queue mechanics with DLQ, batch scheduler, Phase 2 TODOs for canonicalization
  ```
- [ ] Extend ingestion job flow for GitHub App installations
  ```
  Files: convex/actions/github/startBackfill.ts, convex/lib/githubApp.ts, convex/ingestionJobs.ts
  Goal: support BackfillRequest structure, rate-limit-aware loop with etag/cursor storage.
  Success: Ingestion job records progress, pauses when rate limit low, resume works.
  Tests: Unit tests for githubApp helper (token mint, etag headers), integration mock hitting GitHub fixture.
  Dependencies: GitHub actions scaffolding.
  Estimate: 2h
  ```

## Phase 2 – Canonical Facts & Embeddings
- [ ] Implement `canonicalizeEvent` helper + contentHash utilities
  ```
  Files: convex/lib/canonicalizeEvent.ts, convex/lib/contentHash.ts, convex/events.ts (index additions)
  Goal: convert webhook/backfill payloads into EventFact per DESIGN; compute deterministic hashes.
  Success: Unit tests confirm consistent output for commits/PRs/reviews/issues; duplicates skipped.
  Tests: `pnpm exec jest convex/lib/canonicalizeEvent.test.ts` (new file).
  Dependencies: schema ready.
  Estimate: 1.5h
  ```
- [ ] Wire Canonical Fact Service into actions
  ```
  Files: convex/actions/github/processWebhook.ts, convex/actions/github/startBackfill.ts
  Goal: reuse canonicalizer for both paths, write facts, enqueue embeddings for new hashes.
  Success: Running action on fixture writes EventFact with `contentHash` + triggers embedding queue entry.
  Tests: Convex integration test using mock payloads.
  Dependencies: canonicalizeEvent helper.
  Estimate: 1h
  ```
- [ ] Build Embedding & Cache service
  ```
  Files: convex/actions/embeddings/ensureBatch.ts, convex/lib/embeddingQueue.ts, convex/embeddings.ts
  Goal: batch Voyage/OpenAI calls for pending hashes, store vectors + cost metadata.
  Success: ensureBatch processes queued hashes, handles 429 retry.
  Tests: Unit tests mocking Voyage API, integration verifying batching + Convex writes.
  Dependencies: canonical facts producing queue entries.
  Estimate: 2h
  ```

## Phase 3 – Report Orchestrator & Coverage
- [ ] Add report cache fields + coverage tables
  ```
  Files: convex/schema.ts, convex/reports.ts, convex/lib/coverage.ts (new)
  Goal: store `cacheKey`, `coverageScore`, coverage breakdown structure per DESIGN.
  Success: existing report writes compile, new fields default safely.
  Tests: Typecheck, unit tests for coverage math.
  Dependencies: ingestion schema updates.
  Estimate: 1h
  ```
- [ ] Refactor report generation actions into orchestrator
  ```
  Files: convex/actions/reports/generateDaily.ts, generateWeekly.ts, generateAdhoc.ts, convex/lib/reportOrchestrator.ts (new)
  Goal: implement Stage C/D flow, cache lookup, coverage calculation, fallback handling.
  Success: Generating report for seeded data yields coverage >=70% and cache hits bypass LLM.
  Tests: Unit for cache key builder, integration with mocked LLM client.
  Dependencies: canonical facts, embeddings, schema.
  Estimate: 2.5h
  ```
- [ ] Expose coverage + report queries to UI
  ```
  Files: convex/queries/reports.ts (new methods), app/dashboard/reports/page.tsx, components/CoverageMeter.tsx, components/CitationDrawer.tsx, hooks/useReportGeneration.ts
  Goal: show coverage meter, citations drawer, manual generation flow listening to job status.
  Success: UI displays coverage %, warnings <70%, citations list clickable.
  Tests: React component unit tests, Playwright smoke for report page.
  Dependencies: report orchestrator writes coverage data.
  Estimate: 2h
  ```

## Phase 4 – Scheduler, Automation, Observability
- [ ] Update scheduler actions + cron wiring
  ```
  Files: convex/actions/runDailyReports.ts, runWeeklyReports.ts, convex/crons.ts, convex/lib/queues.ts
  Goal: use new orchestrator, track job history, add reconciliation/secret rotation cron placeholders.
  Success: Cron dry-run triggers orchestrator and records metrics/logs.
  Tests: Convex test harness verifying hourly scheduling, job status updates.
  Dependencies: orchestrator finished.
  Estimate: 1.5h
  ```
- [ ] Implement metrics & logging helpers
  ```
  Files: lib/metrics.ts, convex/lib/metrics.ts
  Goal: structured logging for events_ingested, report_latency_ms, llm_cost_usd.
  Success: actions emit metrics, viewable via Convex logs / console.
  Tests: Unit tests ensuring formatter outputs JSON, integration verifying logs.
  Dependencies: ingestion/report modules instrumentation points.
  Estimate: 1h
  ```

## Phase 5 – Validation & QA
- [ ] Add automated test suites per module
  ```
  Files: tests/ (new) or existing structure per repo convention
  Goal: ensure canonicalization, coverage, embedding batching, report cache, webhook verifier all have unit/integration coverage per DESIGN.
  Success: `pnpm exec jest --runInBand` passes with new suites; coverage target documented.
  Dependencies: feature code implemented.
  Estimate: 2h
  ```
- [ ] Run end-to-end smoke & document release checklist
  ```
  Files: scripts/e2e.sh (optional), README.md (update with webhook/GitHub App setup), TODO reference cleanup
  Goal: ingest sample repos, generate reports, verify coverage meter, citations, cache hits; document steps for QA + deployment.
  Success: QA log attached, README instructions updated, all commands passing.
  Tests: manual + automated e2e run, capture artifacts.
  Dependencies: all prior tasks.
  Estimate: 1.5h
  ```

## Questions / Follow-ups
- ? Pilot tenant scale still unknown; placeholder tasks assume medium load. Need confirmation before final queue sizing (Owner: Product, due Nov 12).
- ? Non-GitHub sources scope (Jira/Slack) deferred; confirm to avoid over-building ingestion adapters (Owner: Product, Nov 12).
- ? Delivery channels (Slack/Email) not in MVP; revisit once comms decision made (Owner: Design, Nov 10).
```
