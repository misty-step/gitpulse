## 1. Executive Summary
- GitPulse must turn GitHub activity into trustworthy daily standups and weekly retros, yet current ingestion + reporting stack is brittle, duplicative, and slow when repos or users scale.
- Ship a content-addressed fact graph fed by dual streams (GitHub App webhooks + bounded backfills) plus a two-pass report generator that enforces citations, coverage, and deterministic caching.
- Users win faster answers (≤60 s render), clearer accountability (PagerFit-style ownership later), and verifiable narratives they can click through in one UI tab.
- Success metrics: p95 report latency ≤60 s for 10 repos × 10 users, ≥90 % sentences with citations, coverage score ≥75 % of eligible events, ≤$0.02 LLM spend per active user-day, zero 403/429 under pilot load.
- Guardrails: rate-limit aware queueing, automated secret/webhook rotation, deterministic hashes to prevent double billing, observability for ingestion lag + hallucination rate.

## 2. User Context & Outcomes
| Persona | Pain today | Desired outcome | KPI |
| --- | --- | --- | --- |
| Individual dev | Manual standups or stale “yesterday” recap, no proof links | 6–10 bullet standup generated in <1 min with clickable GitHub URLs | p95 standup latency, % bullets edited |
| Team lead | Weekly retro requires spelunking across PRs/issues | Auto retro w/ shipped themes, risks, staffing hints | Retro completion rate, coverage %, NPS |
| Eng director/exec | Wants 3 a.m. ownership answers | Scoped “who touched X” scorecard with citations | PagerFit accuracy proxy, citation CTR |
| RevOps/Finance (future) | Need usage proof for billing | Source-of-truth fact log + cost telemetry | Cost per user-day, data export availability |

## 3. Requirements
### Functional
1. GitHub integration: support existing PAT/OAuth now; add GitHub App install + webhook receiver that stores installation ids, shared secret, etag cursors per repo.
2. Ingestion modes:
   - Real-time: enqueue webhook payloads (push, pull_request, pull_request_review, issue, issue_comment) → canonicalizer.
   - Backfill: user-triggered or scheduled incremental jobs per repo/org with resumable cursors + rate-limit aware pacing.
3. Event canonicalization: normalize into `EventFact` (type enum, actor, repo, ts, canonicalText, sourceUrl, metrics, contentHash SHA-256). Reject malformed payloads; dedupe via (scope, contentHash).
4. Embeddings service: ensure Voyage embeddings for new facts by batching `contentHash` misses; store metadata for repo/user/type filters.
5. Report engine:
   - Stage C (fact selection): query events per user/team/timebox, enforce coverage target, compute allowed URL list.
   - Stage D (LLM call): prompts require citations, fail if sections missing; fallback synthetic summary when providers fail.
   - Cache results keyed by (reportKind, scope, timeframe, contentHashAgg, promptVersion, model) so re-runs skip LLM spend when inputs identical.
6. Coverage meter + citation drawer in dashboard: show % of candidate events referenced, list all GitHub links with status badges.
7. Scheduling + automation: maintain cron/hourly jobs for daily/weekly runs, storing schedule preferences per user; expose job history.
8. Cost + quota tracking: log token spend, GitHub API headers, and ingestion lag per repo for future billing.

### Non-functional
- Performance: ingest ≥5 repos/minute during backfill without starving webhooks; report generation ≤60 s at pilot scale, ≤5 s cache hit.
- Reliability: exactly-once semantics via idempotent upserts + content hashes; webhook receiver ACK within 2 s; DLQ for poison events.
- Security: least-privilege tokens (GitHub App installs), signed webhook verification, secrets in manager with dual-secret rotation, zero-retention LLM tenancy.
- Cost: max $0.02/user-day LLM, ≤$1 per 10k events in storage, background jobs auto-pause when rate-limit budget low.
- Operability: structured logs for ingestion, metrics (events/sec, coverage, hallucination rate), alerts when coverage <70 % or report latency >60 s.

## 4. Architecture Decision
### Selected approach — Dual-stream content-addressed fact graph
- Two ingestion paths feed a single Convex-owned fact store: webhooks (high-priority queue) and backfills (low-priority). Workers consult shared rate-limit cache + repo etags before GitHub calls, per 2025 GitHub App best practices (queue-first, conditional requests, DLQ, secret rotation).
- Canonicalizer hides GitHub payload variance; it creates deterministic hashes so embeddings + LLM caching key off content, not schedule. Convex actions remain thin interfaces; complexity stays inside dedicated modules (deep-module rule).
- Report engine pulls only needed facts, enforces coverage + citations before formatting UI. Cache hits bypass LLM spend; misses pass through multi-provider LLMClient w/ validation + fallback.
- This layout maximizes user value (fast, verified output) while keeping interfaces tiny: UI only asks for reports + coverage, never touches ingestion details.

### Alternatives rubric (ratings 1–5; risk score is inverted where 5 = lowest risk)
| Approach | Description | User Value (40 %) | Simplicity (30 %) | Explicitness (20 %) | Risk (10 %) | Weighted |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Dual-stream fact graph (chosen)** | Webhooks + resumable backfills feed content-addressed store + cached reports | 4.5 | 4.0 | 4.0 | 4.0 | **4.20** |
| B. Nightly bulk summarizer | Single nightly job scans raw events, writes markdown, no hashes/cache | 3.0 | 4.5 | 2.5 | 3.0 | 3.35 |
| C. Warehouse-first (Snowflake + dbt + LLM) | ETL into warehouse then query via SQL before LLM | 3.5 | 2.0 | 2.5 | 2.0 | 2.70 |
- B rejected: slow feedback, can’t power near-real-time standups, double-spend when retries rerun entire night.
- C rejected: heavy infra, leaks Convex/Next simplicity, increases compliance blast radius before hitting scale.

### Module boundaries
1. **GitHub Integration Service** (actions/github/*): handles token minting, webhook verification, queueing, rate-limit/etag cache. Interface: `enqueueWebhook(payload)`, `startBackfill({installationId, repo, cursor})`.
2. **Canonical Fact Service** (convex/lib/canonicalizeEvent.ts + mutations): upsert-only writer that outputs `EventFact`, sets `contentHash`, records source metadata. Interface: `upsertFact(input) => factId`.
3. **Embedding Service** (`actions/generateEmbeddings`): consumes facts missing embeddings, batches Voyage/OpenAI calls, stores by `contentHash`. Interface: `ensureEmbeddings(contentHashes[])`.
4. **Report Orchestrator** (`actions/reports.generate*`): selects facts, enforces coverage, calls `LLMClient`, writes report doc w/ coverage + citation arrays. Interface: `generateReport({scope, kind, window}) => reportId`.
5. **Experience Layer** (`app/dashboard/reports/*`): fetches finalized reports + metrics through Convex queries only; no data munging client-side.

### Layering vocabulary
- **Acquisition Layer**: GitHub transports, webhook receiver, ingestion queues (talks in GitHub payload terms).
- **Normalization Layer**: Canonical Fact Service + Embedding Service (talks in EventFact, contentHash, coverage).
- **Intelligence Layer**: Report Orchestrator, PagerFit scoring, cost tracker (talks in narratives, sections, risk flags).
- **Experience Layer**: Next.js pages/components (talks in UI primitives: cards, tables, charts).

## 5. Data & API Contracts
### Core tables (Convex)
```ts
export type EventType =
  | "pr_opened" | "pr_merged" | "pr_closed" | "review_submitted"
  | "commit" | "issue_opened" | "issue_closed" | "issue_comment";

interface EventFact {
  _id: Id<"events">;
  type: EventType;
  actorId: Id<"users">;
  repoId: Id<"repos">;
  ts: number;
  canonicalText: string;      // title + summary string, ≤512 chars
  metrics?: { additions?: number; deletions?: number; filesChanged?: number };
  sourceUrl: string;
  contentHash: string;        // sha256(canonicalText + sourceUrl)
  contentScope: "event" | "timeslice";
  metadata: Record<string, unknown>;
  createdAt: number;
}

interface EmbeddingVector {
  scope: "event";
  refId: string;              // EventFact._id
  contentHash: string;
  provider: "voyage" | "openai";
  model: string;
  vector: number[];           // 1024 dims
  createdAt: number;
}

interface ReportDoc {
  userId: string;             // Clerk subject
  scope: { kind: "user" | "team" | "repo"; ids: string[] };
  kind: "daily" | "weekly" | "ad-hoc";
  startDate: number;
  endDate: number;
  markdown: string;
  html: string;
  sections: Array<{ title: string; bullets: string[]; citations: string[] }>;
  citations: string[];
  coverageScore: number;      // referencedFacts / candidateFacts
  coverageBreakdown: Array<{ repoId: Id<"repos">; used: number; total: number }>;
  cacheKey: string;           // hash of inputs
  promptVersion: string;
  provider: string;
  model: string;
  costUsd: number;
  generatedAt: number;
  createdAt: number;
  updatedAt: number;
}

interface IngestionJob {
  userId: string;
  scope: { type: "repo" | "org" | "installation"; value: string };
  since: number;
  until?: number;
  cursor?: string;            // GraphQL cursor or timestamp
  status: "pending" | "running" | "blocked" | "completed" | "failed";
  progress: number;           // 0–100
  eventsIngested: number;
  embeddingsCreated: number;
  errorMessage?: string;
  rateLimitBudget?: number;   // remaining calls
  createdAt: number;
  updatedAt: number;
}
```

### APIs / actions
- `actions/github.enqueueWebhook({ installationId, deliveryId, payload })` → `202` after validation + queue.
- `internal.actions.ingestInstallation({ installationId, repoFullNames[], sinceISO, cursor })` returns stats, updates `ingestionJobs`.
- `internal.mutations.events.upsertFact({ ghNodeId?, type, repoId, actorId, ts, canonicalText, contentHash, sourceUrl, metadata })` → fact id.
- `internal.actions.reports.generateDaily|Weekly({ scopeIds, timeframe })` → `reportId` within 60 s.
- `queries/reports.get(reportId)` returns `ReportDoc` + coverage; `queries/reports.list({ scope, kind, limit })` for UI pagination.
- `mutations/reports.requestGeneration({ kind, scopeIds, timeframe, notify })` triggers asynchronous job for manual generation.

## 6. Implementation Phases
### MVP (Weeks 0–3)
- Build webhook receiver + queue stub (Convex action + durable storage) with signature verification + immediate ACK.
- Implement canonicalization + content hashing on write path (REST ingestion + future webhooks share code).
- Extend reports table/schema per above; add coverage computation + citation drawer UI.
- Add cache key + `coverageScore` wiring in `actions/generateScheduledReport` and store cost metadata from `LLMClient`.
- Instrument ingestion jobs with status/progress + UI surface.

### Hardening (Weeks 4–7)
- Ship GitHub App install flow, installation token minting, shared rate-limit cache, and ETag-aware GraphQL fetch (feature-flagged `FEATURE_GRAPHQL_COMMITS`).
- Introduce DLQ + replay tooling for webhook events, plus Temporal (or Convex cron queue) wrappers for retries.
- Add secret rotation automation (dual secret verification window) and audit logs for report generation + data access.
- Integrate Voyage embeddings batching w/ content-hash cache + monitoring.

### Future Iterations (Quarter+)
- PagerFit ownership scoring service reading from fact graph.
- Slack/email distribution + schedule overrides per team.
- External warehouse export (Parquet) for enterprise customers; optional pgvector/Qdrant when Convex limits hit.
- Multi-tenant cost governance + billing events.

## 7. Testing & Observability
- **Unit tests**: canonicalization (input → canonicalText/hash), citation extraction, cache key builder (`pnpm exec jest`).
- **Integration tests**: mocked GitHub payload → webhook → fact insert; report generation against golden datasets with required headings/citations; embeddings queue ensures batching/backoff.
- **E2E smoke**: ingest sample repos, run daily + weekly flows, assert coverage ≥70 %, citations valid (HTTP 200), copy/export works.
- **Observability**:
  - Structured logs for every ingestion job, webhook ACK, report generation (include cache hit/miss + token spend).
  - Metrics: `events_ingested_per_min`, `webhook_lag_ms`, `coverage_score`, `citation_coverage`, `report_latency_ms`, `rate_limit_remaining`, `llm_cost_usd`.
  - Alerts: coverage <70 %, report latency >60 s, webhook DLQ >5 events, Voyage/OpenAI failures >3 consecutive.
  - Dashboards inside Convex + optional Sentry for Next.js UI errors.

## 8. Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Missed or duplicate GitHub events | Medium | High | Webhook ACK + queue + nightly reconciliation using etags + idempotent contentHash upserts | Backend |
| LLM hallucinations / uncited claims | Medium | High | Prompt enforces citations, validator rejects missing headings/citations, coverage metric + golden tests | AI Platform |
| Rate-limit exhaustion during org backfills | Medium | Medium | Central rate-limit cache, priority queues, GraphQL w/ cost estimator, auto-pausing low-priority jobs | Backend |
| Secret/key leakage | Low | High | Secret manager integration, dual-secret rotation, zero secrets in repo, audit logs | Security |
| Cost overruns | Low | Medium | Cache hits before LLM call, cost meter per report, alerts when spend/user-day > target | Finance Ops |
| Vendor/regulatory changes (LLM, GitHub API) | Medium | Medium | LLMClient abstraction, feature flags, fail-safe synthetic reports, contract review cadence | Product |

## 9. Open Questions / Assumptions
1. **Scale target** – Need confirmation on pilot size (repos/users per tenant) to tune queue + storage defaults. *Owner: Product, Due: Nov 12 2025.*
2. **Data scope** – Are issues/discussions beyond GitHub (Jira, Linear, Slack) in MVP or deferred? Assume GitHub-only → confirm. *Owner: Product, Due: Nov 12.*
3. **UI delivery** – Do daily/weekly reports stay in-app only for MVP, or must Slack/email ship now? Assuming in-app + copy/export only. *Owner: Design, Due: Nov 10.*
4. **LLM tenancy** – Are we cleared to use Google-hosted Gemini with zero-retention flag, or must we deploy via Vertex/Azure? *Owner: Security, Due: Nov 14.*
5. **Temporal adoption** – Is adopting Temporal acceptable in Q1, or must Convex cron cover retries? Assuming Temporal optional (flag). *Owner: Platform, Due: Nov 18.*
6. **PagerFit priority** – Should ownership scoring be part of MVP definition? Assuming “future iteration”. *Owner: Exec, Due: Nov 15.*
7. **Billing needs** – Is per-user billing required Day 1? Assuming cost telemetry only, billing export later. *Owner: Finance, Due: Nov 20.*
