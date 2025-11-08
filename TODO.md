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
- [x] Extend ingestion job flow for GitHub App installations
  ```
  Files: convex/actions/github/startBackfill.ts:1-43, convex/lib/githubApp.ts (new), convex/ingestionJobs.ts:110-183, convex/schema.ts:280-333, convex/installations.ts:7-95, convex/webhookEvents.ts:1-70
  Pattern: Follow the deep-module encapsulation used in convex/lib/GitHubClient.ts:1-147 for token minting/fetch retries and reuse the status/progress mutation style already present in convex/ingestionJobs.ts:110-183.

  Approach:
  1. Helper module — Add convex/lib/githubApp.ts exporting:
     - `buildAppJwt(appId, privateKey)` that signs RS256 JWTs (replacing literal "\n" with newlines) and caches for ≤8 minutes.
     - `mintInstallationToken(installationId)` that POSTs to `https://api.github.com/app/installations/{id}/access_tokens`, returns `{ token, expiresAt }`, and throws when `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` envs missing.
     - `fetchRepoTimeline({ token, repoFullName, sinceISO, cursor, etag })` that hits GitHub GraphQL Search API with query `repo:{fullName} (is:pr OR is:issue) updated:>=${since}` plus optional commits request (`FEATURE_GRAPHQL_COMMITS` flag). Include `If-None-Match` header when caller passes `etag`, and return `{ nodes, endCursor, hasNextPage, etag, rateLimit }`.
     - `parseRateLimit(headers)` + `shouldPause(remaining: number)` (threshold constant `MIN_BACKFILL_BUDGET = 200`).
     Write Jest unit tests (`convex/lib/githubApp.test.ts`) that mock `global.fetch` to assert headers/body shape for token mint + timeline fetch.
  2. Persistence + bookkeeping — Extend Convex schema/mutations so jobs can resume mid-stream:
     - `convex/schema.ts:280-333`: add `installationId`, `cursor`, `reposRemaining` (string array), `blockedUntil`, `rateLimitRemaining`, `rateLimitReset` fields to `ingestionJobs`.
     - Update `internal.ingestionJobs.create/updateProgress/complete/fail` plus a new `markBlocked` mutation in convex/ingestionJobs.ts: create must accept the new fields, `updateProgress` should optionally persist `cursor` + `reposRemaining`, and `markBlocked` sets `status: "blocked"` + `blockedUntil`.
     - Add `installations.updateSyncState` mutation in convex/installations.ts: patches `lastCursor`, `etag`, `rateLimitRemaining`, `rateLimitReset`, and `status` so future backfills share the same metadata (reuse existing index logic at lines 48-90).
  3. Action implementation — Replace the stub in convex/actions/github/startBackfill.ts with real logic:
     - Validate auth (`ctx.auth.getUserIdentity`) and ensure the requesting Clerk user matches the installation’s `clerkUserId`; bail with a typed error if not.
     - Resolve repo list: use `args.repositories`, falling back to `installation.repositories`; clamp to ≤10 repos per invocation to respect GitHub budgets.
     - For each repo: create an ingestion job via `ctx.runMutation(internal.ingestionJobs.create, { userId, repoFullName, installationId, since, status: "running", progress: 0, reposRemaining })`, then loop:
       a. Mint/refresh installation token via the helper when missing or expiring within 60s.
       b. Call `fetchRepoTimeline` with the repo, `sinceISO = new Date(args.since).toISOString()`, `cursor` from job/installation, and `etag` from installation metadata.
       c. If response is 304, record `updateProgress` (progress unchanged) and break.
       d. For each node (PR, Issue, Review, Commit) create a deterministic `deliveryId` (`backfill:${repo}:${node.__typename}:${node.id}`), enqueue it through `ctx.runMutation(internal.webhookEvents.enqueue, { deliveryId, event: node.__typename, installationId, payload: node })`, and immediately schedule `ctx.scheduler.runAfter(0, internal.actions.github.processWebhook.processWebhook, { webhookEventId })` so canonicalization stays centralized.
       e. After each page, update job progress (`processedCount / totalEstimated`) plus `cursor`, `eventsIngested`, and write `installations.updateSyncState` with the new cursor + etag. When `hasNextPage` is false, mark job complete.
       f. Inspect `rateLimit.remaining`: if below `MIN_BACKFILL_BUDGET`, call `internal.ingestionJobs.markBlocked` (status `blocked`, `blockedUntil = rateLimit.reset * 1000`), persist the cursor, and schedule a resume via `ctx.scheduler.runAt(rateLimit.reset * 1000, internal.actions.github.startBackfill.startBackfill, {...args, repositories: [repo], since: cursorTs })`.
     - Wrap the whole action in try/catch; on error, invoke `internal.ingestionJobs.fail` with the message and bubble a sanitized error to the caller.

  Success criteria:
  - Running `pnpm typecheck` + `pnpm exec jest convex/lib/githubApp.test.ts` passes; GitHub App env vars missing throws `"GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured"` before any fetch call.
  - Calling `startBackfill` on a seeded installation writes/updates an `ingestionJobs` document with `status` transitions (`pending → running → blocked|completed`), persists `cursor`/`rateLimit*`/`etag`, and schedules resume work when remaining calls < `MIN_BACKFILL_BUDGET`.
  - Every timeline node enqueued for backfill results in a corresponding record in `webhookEvents` plus a scheduled `processWebhook`, proving that backfills reuse the same canonicalization path as live webhooks.

  Edge cases: missing/unauthorized installation, repo arrays containing repositories not granted to the installation, `since >= until`, GitHub returning 304 (no new data), rate-limit 403/429 responses, installation tokens expiring mid-loop, and Convex action timeouts (split work across multiple scheduler invocations when `hasNextPage` is still true after ~200 nodes).
  Dependencies: requires GitHub App credentials in Convex env, installations table populated via the install webhook, and the webhook processing action (Task 3) already deployed; canonicalization wiring (Phase 2) will consume the enqueued envelopes next.
  ```

## Phase 2 – Canonical Facts & Embeddings
- [x] Implement `canonicalizeEvent` helper + contentHash utilities
  ```
  Files: convex/lib/canonicalizeEvent.ts (new), convex/lib/canonicalizeEvent.test.ts (new), convex/lib/contentHash.ts (new), convex/events.ts:1-210
  Pattern: Follow the deep-module style and defensiveness used in convex/lib/githubApp.ts:1-250 (pure helpers, cached values, typed inputs) and reuse the querying style from convex/events.ts:120-210 for new internal helpers.

  Approach:
  1. Canonical data contracts
     - Define `EventType` union + `CanonicalActor`, `CanonicalRepo`, and `CanonicalEvent` interfaces inside `canonicalizeEvent.ts`, mirroring the EventFact structure in TASK.md §3 and reusing repo/user fields from `convex/actions/ingestRepo.ts:35-125`.
     - Export discriminated input shapes for each GitHub source we support now: `pull_request`, `pull_request_review`, `issues`, `issue_comment`, `commit` (from push/backfill), and `timeline` items (search API result shaped like `RepoTimelineNode` in DESIGN.md §Module Allocation).
  2. Canonicalization helpers
     - Implement `canonicalizeEvent(input)` that dispatches to specialized helpers (PR, review, commit, issue, issue_comment, timeline). Each helper must:
       a. Validate required fields (`repository.full_name`, actor login/id, timestamps). Return `null` if anything essential is missing so callers can DLQ the payload later.
       b. Build a ≤512-character `canonicalText` string per type (e.g., `PR #123 opened by devin: Add feature – 3 files changed`) and a `metrics` object populated from GitHub payload stats (additions/deletions/filesChanged when available).
       c. Derive the `EventType` (`pr_opened`, `pr_closed`, `pr_merged`, `review_submitted`, `commit`, `issue_opened`, `issue_closed`, `issue_comment`), `ts` (pick `merged_at`/`closed_at`/`created_at`/commit author date as appropriate), `sourceUrl`, and a trimmed metadata object (PR number, issue number, commit SHA, review state, etc.).
       d. For push payloads iterate per commit outside later; here we accept a normalized commit input (`{ type: "commit", commit, repository }`) to produce a single `CanonicalEvent`.
       e. For timeline backfills accept `RepoTimelineNode` (constructed in previous task) and map PR vs Issue nodes to the same canonical schema.
     - Add tiny utilities for string truncation and html/url fallbacks, and ensure actor/login casing is preserved.
  3. Content hash utility
     - Create `convex/lib/contentHash.ts` exporting `computeContentHash({ canonicalText, sourceUrl, metrics })` that SHA-256 hashes a deterministic string: `${canonicalText}::${sourceUrl}::${stableMetrics}` where `stableMetrics` comes from a helper that JSON-stringifies metric objects with sorted keys. Use Node’s `crypto.createHash("sha256")` and return lowercase hex.
     - Provide `stableStringify(value)` that sorts object keys recursively so `metrics` order never impacts the hash; include unit tests within `canonicalizeEvent.test.ts` verifying identical inputs produce identical hashes regardless of property ordering.
  4. Event queries for dedupe
     - In `convex/events.ts`, add `internalQuery getByContentHash` leveraging the existing `by_contentHash` index (line ~150). Also expose `internalMutation upsertCanonical` that writes a fully-canonical EventFact (type, ghId/nodeId optional, actorId, repoId, ts, canonicalText, sourceUrl, metrics, contentHash, metadata, createdAt) so Task 2 can call it after looking up/creating user + repo docs.

  Success criteria:
  - Running `pnpm exec jest convex/lib/canonicalizeEvent.test.ts` passes; tests cover at least PR opened, PR merged, review submitted, issue comment, and commit inputs plus hash determinism + 512-char truncation.
  - `canonicalizeEvent` returns `null` on malformed payloads (missing repo, actor, or timestamp) instead of throwing, and provides enough metadata (number/state/url) for downstream coverage/citation logic.
  - `computeContentHash` yields identical hashes for logically-equal events regardless of metric key ordering or whitespace, ensuring duplicates are detectable via `events.by_contentHash`.
  - `convex/events.ts` exposes `internal.events.getByContentHash` and `internal.events.upsertCanonical` for later tasks, and lint/typecheck succeed for the new helpers.

  Edge cases: PR closed events where `pull_request.merged` is true (emit `pr_merged` with `merged_at` timestamp), push commits lacking `author.id` (skip or return null), issue comments on PRs (classify as `issue_comment` but include `isPullRequest: true` in metadata), timeline nodes missing `html_url` (fallback to `url`), overly long titles/bodies (truncate canonical text to 512 chars without breaking multi-byte chars). Treat missing `repository.full_name` or actor login/id as invalid -> `null`.
  Dependencies: relies on schema fields already landed (events.contentHash + indexes) and the GitHub timeline types returned by `convex/lib/githubApp.ts`.
  ```
- [x] Wire Canonical Fact Service into actions
  ```
  Files: convex/actions/github/processWebhook.ts, convex/actions/github/startBackfill.ts
  Goal: reuse canonicalizer for both paths, write facts, enqueue embeddings for new hashes.
  Success: Running action on fixture writes EventFact with `contentHash` + triggers embedding queue entry.
  Tests: Convex integration test using mock payloads.
  Dependencies: canonicalizeEvent helper.
  Estimate: 1h
  ```
- [x] Build Embedding & Cache service
  ```
  Files: convex/actions/embeddings/ensureBatch.ts, convex/lib/embeddingQueue.ts, convex/embeddings.ts
  Goal: batch Voyage/OpenAI calls for pending hashes, store vectors + cost metadata.
  Success: ensureBatch processes queued hashes, handles 429 retry.
  Tests: Unit tests mocking Voyage API, integration verifying batching + Convex writes.
  Dependencies: canonical facts producing queue entries.
  Estimate: 2h
  ```

## Phase 3 – Report Orchestrator & Coverage
- [~] Add report cache fields + coverage tables
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
