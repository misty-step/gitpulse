# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GitPulse** is an AI-powered GitHub activity analytics platform that generates trusted, citation-backed reports (daily standups, weekly retrospectives) from GitHub events. Every claim links to a GitHub URL for verification.

**Core Architecture**: Dual-stream content-addressed fact graph
- **Webhooks** (real-time) + **Backfills** (historical) → Single canonical fact store
- **Content hashing** (SHA-256) prevents duplicate embeddings/LLM calls
- **Deterministic caching** by (scope, window, contentHashAgg, promptVersion)
- **Deep modules**: GitHub Service, Canonical Fact Service, Embedding Service, Report Orchestrator

**Tech Stack**:
- Frontend: Next.js 16 (App Router) + React 19 + TypeScript 5.7 + Tailwind CSS 4
- Backend: Convex (serverless functions + database + vector search)
- Auth: Clerk (session management + GitHub OAuth)
- AI: Gemini 2.5 Flash (reports) + Voyage AI (embeddings 1024-dim)

## Essential Commands

### Development
```bash
pnpm dev              # Start Next.js (port 3000) + Convex dev server concurrently
pnpm build            # Production build (Next.js only)
pnpm start            # Start production server
```

### Quality Checks
```bash
pnpm typecheck        # TypeScript type checking (tsc --noEmit)
pnpm lint             # ESLint check
pnpm format           # Prettier format all .ts/.tsx/.md files
pnpm test             # Run Jest test suite
```

### Convex Operations
```bash
npx convex dev        # Start Convex dev server (auto-syncs schema + functions)
npx convex dashboard  # Open Convex dashboard (view data, logs, run functions)
npx convex deploy     # Deploy to production Convex environment
```

### Testing
```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test convex/lib/contentHash.test.ts

# Run tests in watch mode (not configured by default, run jest directly)
npx jest --watch

# Run tests with coverage
npx jest --coverage
```

## Architecture Patterns

### Module Boundaries (Deep Modules Philosophy)

**1. GitHub Integration Service** (`convex/lib/githubApp.ts`)
- **Hides**: GitHub App OAuth, webhook HMAC verification, token minting, rate-limit state
- **Exposes**: `verifyAndEnqueueWebhook()`, `startBackfill()`, `reconcileInstallation()`

**2. Canonical Fact Service** (`convex/lib/canonicalFactService.ts`)
- **Hides**: Payload normalization, SHA-256 hashing, deduplication logic, user/repo upsertion
- **Exposes**: `upsertFromWebhook()`, `upsertFromBackfill()`

**3. Embedding Service** (`convex/actions/embeddings/ensureBatch.ts`)
- **Hides**: Voyage/OpenAI batch API calls, retry logic, spend tracking, provider fallback
- **Exposes**: `ensureEmbeddings(contentHashes[])`

**4. Report Orchestrator** (`convex/lib/reportOrchestrator.ts`)
- **Hides**: LLM prompting, citation validation, coverage computation, cache key generation
- **Exposes**: `generateReport()`, `computeCoverage()`

### Content-Addressed Fact Pattern

```typescript
// Events deduplicated via deterministic hash
contentHash = sha256(canonicalText + sourceUrl + JSON.stringify(metrics))

// Check before insert (idempotent upserts)
const existing = await ctx.runQuery(api.events.getByHash, { hash })
if (!existing) {
  await ctx.runMutation(internal.events.create, { ... })
}
```

### Report Caching Strategy

```typescript
// Cache key ensures deterministic generation
cacheKey = sha256({
  kind,           // "daily" | "weekly"
  userId,
  startDate,
  endDate,
  contentHashAgg, // hash of all selected event hashes (sorted)
  promptVersion
})

// Cache hit: <5s response
// Cache miss: LLM generation ≤60s
```

### Vocabulary Layering

Each abstraction layer changes vocabulary:
- **Acquisition**: GitHub payloads, webhook events, installation IDs
- **Normalization**: EventFact, contentHash, canonicalText, metrics
- **Intelligence**: Report sections, citations, coverage score
- **Experience**: Cards, tables, charts, UI components

## Key Database Tables

**12 Convex tables** (see `convex/schema.ts`):

1. **users** - GitHub profiles + Clerk linkage + OAuth tokens + schedule preferences
2. **repos** - Repository metadata (stars, language, etc.)
3. **events** - GitHub activity facts (PR, commit, review, issue) with contentHash deduplication
4. **embeddings** - 1024-dim Voyage vectors with native vector index
5. **reports** - Generated AI reports with coverage + citation metadata
6. **ingestionJobs** - Background job tracking (status, progress, rate-limit budget)
7. **installations** - GitHub App installation metadata (etag, cursor, rate-limit state)
8. **webhookEvents** - Raw webhook envelopes for processing + DLQ
9. **coverageCandidates** - Fact-to-report scope/window relations
10. **embeddingQueue** - Pending embedding jobs with retry logic
11. **reportJobHistory** - Audit log for daily/weekly scheduler runs

**Key Indexes**:
- `by_contentHash` on events (deduplication)
- `by_actor_and_ts`, `by_repo_and_ts` on events (report queries)
- Native vector index on embeddings (cosine similarity)

## Critical File Organization

### Backend Logic (`convex/`)

```
convex/
├── schema.ts                    # Database schema (12 tables)
├── auth.config.ts               # Clerk JWT validation
│
├── actions/                     # External API calls
│   ├── github/
│   │   ├── processWebhook.ts       # Process webhook payloads
│   │   ├── startBackfill.ts        # Repo backfill orchestration
│   │   └── scheduler.ts            # Automated report generation
│   ├── embeddings/
│   │   └── ensureBatch.ts          # Batch embedding generation
│   ├── reports/
│   │   ├── generateDaily.ts        # Daily standup generation
│   │   └── generateWeekly.ts       # Weekly retro generation
│   └── generateScheduledReport.ts  # Scheduled report driver
│
├── lib/                         # Shared utilities (deep modules)
│   ├── types.ts                    # ActionResult<T> standard response
│   ├── githubApp.ts                # GitHub App token + webhook handling
│   ├── canonicalizeEvent.ts        # Payload normalization → EventFact
│   ├── contentHash.ts              # SHA-256 hashing
│   ├── canonicalFactService.ts     # EventFact upsert orchestration
│   ├── embeddings.ts               # Voyage/OpenAI embedding calls
│   ├── reportOrchestrator.ts       # Report generation orchestration
│   ├── coverage.ts                 # Coverage score computation
│   ├── prompts.ts                  # LLM prompt templates
│   └── metrics.ts                  # Structured logging
│
├── queries/                     # Read operations (manual, not auto-generated)
├── mutations/                   # Write operations (manual)
└── crons.ts                     # Convex cron task definitions
```

### Frontend (`app/`)

```
app/
├── page.tsx                     # Landing page
├── layout.tsx                   # Root layout with Clerk + theme providers
├── middleware.ts                # Auth middleware (public: /, /api/webhooks/*)
├── dashboard/                   # Protected routes
│   ├── page.tsx                    # Main dashboard
│   ├── reports/
│   │   ├── page.tsx                # Report list & generation UI
│   │   └── [id]/page.tsx           # Individual report view with citations
│   └── settings/
│       └── repositories/[id]/      # Repo details & ingestion tracking
└── api/
    └── webhooks/github/            # GitHub webhook receiver (PUBLIC route)
```

## Testing Strategy

**Test Framework**: Jest 29 + ts-jest (ESM preset)

**Test Locations**:
- **Unit tests**: Alongside source (`.test.ts` pattern)
  - `convex/lib/contentHash.test.ts` - Hash determinism
  - `convex/lib/coverage.test.ts` - Coverage math
  - `convex/lib/canonicalizeEvent.test.ts` - Event normalization

- **Integration tests**: `convex/lib/__tests__/` directory
  - `githubApp.test.ts` - Webhook + GitHub App integration
  - `reportOrchestrator.test.ts` - Report generation flow
  - `canonicalFactService.test.ts` - Fact upsertion pipeline

**Test Coverage Areas**:
1. Event canonicalization + hash determinism
2. Content-addressed upserts + deduplication
3. Coverage scoring (fact-to-report mapping)
4. LLM integration (citation extraction, prompt validation)
5. Embedding batch processing + fallback logic
6. GitHub App (signature verification, token handling)

## Common Development Tasks

### Adding a New GitHub Event Type

1. Update `EventType` enum in `convex/schema.ts`
2. Add normalization logic in `convex/lib/canonicalizeEvent.ts`
3. Add test cases in `convex/lib/canonicalizeEvent.test.ts`
4. Update webhook handler in `convex/actions/github/processWebhook.ts`

### Creating a New Report Type

1. Add prompt template in `convex/lib/prompts.ts`
2. Create action in `convex/actions/reports/generate*.ts`
3. Add cron schedule in `convex/crons.ts` if automated
4. Update `ReportDoc` type in schema if needed
5. Add UI components in `app/dashboard/reports/`

### Modifying Database Schema

1. Update `convex/schema.ts`
2. Run `npx convex dev` (auto-syncs schema)
3. Update TypeScript types (regenerated in `convex/_generated/`)
4. Add migration logic if needed (Convex handles additive changes automatically)
5. Test queries/mutations with new schema

### Adding a New Component

1. Create component in `components/` directory
2. Follow ShadCN conventions for UI primitives (`components/ui/`)
3. Use Tailwind CSS 4 for styling
4. Import Convex hooks (`useQuery`, `useMutation`) for data
5. Ensure responsive design (mobile-first)

## Error Handling Patterns

### Standardized Action Response

All actions return `ActionResult<T>`:

```typescript
interface ActionResult<T> {
  success: boolean
  data?: T
  error?: ActionError
  timestamp: number
}
```

### Error Categories

1. **Validation Errors** → 4xx status, log, no retries
2. **Rate-Limit/Abuse** → Mark job `blocked`, retry at reset time
3. **Provider Failures (LLM/Embeddings)** → 3x retry + exponential backoff → fallback provider → synthetic
4. **System Faults** → DLQ for manual inspection, emit severity WARN

## Security & Authentication

### Authentication Flow

1. **Frontend**: Clerk sign-in/sign-up (GitHub OAuth enabled)
2. **Middleware** (`middleware.ts`): Public routes: `/`, `/sign-in/*`, `/sign-up/*`, `/api/webhooks/*`
3. **Backend**: Clerk JWT validation in `convex/auth.config.ts`
4. **GitHub App**: OAuth tokens (short-lived), webhook HMAC-SHA256 verification

### Secrets Management

All secrets stored in Convex environment (NOT in code):

```bash
# Set via Convex dashboard or CLI
npx convex env set GITHUB_APP_ID "123456"
npx convex env set GITHUB_APP_PRIVATE_KEY "-----BEGIN RSA PRIVATE KEY-----..."
npx convex env set GITHUB_WEBHOOK_SECRET "your-webhook-secret"
npx convex env set VOYAGE_API_KEY "pa-..."
npx convex env set GOOGLE_API_KEY "AIza..."
npx convex env set OPENAI_API_KEY "sk-..."
```

## Performance Targets

- **Ingestion**: ≥5 repos/minute during backfill without webhook starvation
- **Report Latency**:
  - Cache hit: <5 seconds
  - Cache miss: ≤60 seconds (including embedding wait)
- **Webhook ACK**: <200 ms
- **Coverage Score**: Computed in <1 second

## Observability & Metrics

**Structured Logging** (`convex/lib/metrics.ts`):

```typescript
emitMetric({
  name: "fact.upserted",
  properties: { contentHash, repoId, actorId }
})
```

**Key Metrics**:
- `events_ingested_per_min`
- `webhook_lag_ms`
- `coverage_score`
- `citation_coverage`
- `report_latency_ms`
- `rate_limit_remaining`
- `llm_cost_usd`

**Monitoring Locations**:
- Convex Dashboard → Logs tab (structured JSON logs)
- Convex Dashboard → Functions tab (function execution traces)
- Optional: Sentry for Next.js UI errors

## Cost Optimization

**Target**: ≤$0.02/user-day LLM spend

**Strategies**:
1. Cache hits bypass LLM (deterministic cache keys)
2. Content-addressed deduplication (no double embeddings)
3. Token budgeting (monitor via `costUsd` field)
4. Batch embedding API calls (Voyage/OpenAI)
5. Metrics dashboard for spend tracking

## Design Philosophy

**Informed by John Ousterhout's "A Philosophy of Software Design":**

1. **Deep Modules**: Simple interfaces hiding complex implementations
   - GitHub Service: `verifyAndEnqueueWebhook()` hides OAuth + HMAC + queueing
   - Report Orchestrator: `generateReport()` hides LLM + caching + citation validation

2. **Information Hiding**: Implementation details stay internal
   - Content hashing logic hidden in Canonical Fact Service
   - Embedding provider fallback logic hidden in Embedding Service

3. **Deterministic Caching**: Content-addressed design prevents double-spending
   - Reports cached by input hash
   - Embeddings cached by content hash

4. **Layered Vocabulary**: Each layer changes concepts
   - Acquisition → Normalization → Intelligence → Experience
   - Prevents leakage, enforces boundaries

5. **Zero Complexity Tolerance**: Fight accumulating complexity
   - Avoid shallow modules, pass-through methods, config overload
   - Watch for `Manager`/`Util`/`Helper` anti-patterns

## Git Workflow

**Conventional Commits** (enforced):
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance

**Recent Commits** (as of Nov 9, 2025):
```
e2bd3d8 feat(metrics): add structured logging
3ff448b feat(cron): log report job history
a8fd873 feat(app): surface report coverage
2e77a81 feat(reports): introduce orchestrator
60dcc6d feat(reports): add coverage helpers
```

## Important Constraints

1. **Node.js**: ≥22.15.0 required
2. **Package Manager**: pnpm ≥9.0.0 (enforced via `.github/workflows/enforce-pnpm.yml`)
3. **TypeScript**: Strict mode enabled
4. **ESM**: All modules use ES modules (not CommonJS)
5. **Path Alias**: `@/*` maps to project root

## Troubleshooting

### Database Issues
```bash
npx convex dashboard  # Check logs tab for errors
```

### Build Errors
```bash
rm -rf .next node_modules
pnpm install
pnpm build
```

### GitHub Rate Limits
- Automatic exponential backoff (1s → 2s → 4s → 8s)
- Jobs auto-pause when budget low
- Logs show `rate_limit_remaining` metric

### Report Generation Fails
1. Verify API keys in Convex Dashboard → Settings → Environment Variables
2. Check Convex logs for LLM errors
3. Ensure data ingested for users/date range (check `events` table)

## Key Documentation Files

- **DESIGN.md** - Comprehensive architecture document (module design, data flow)
- **TASK.md** - Requirements document (user stories, success metrics, risks)
- **TODO.md** - Current sprint tasks & backlog
- **README.md** - User-facing setup guide & quick start

## Development Status

**Current Phase**: MVP functional, active hardening
- ✅ Core ingestion pipeline (REST API)
- ✅ Report generation with citations
- ✅ Coverage scoring
- 🚧 GitHub App webhook integration
- 🚧 Embedding service optimization
- 🚧 Daily/weekly automation
- 📋 Planned: Secret rotation, observability dashboards

---

**Philosophy**: Simplicity through deep modules. Every interface should be minimal; every implementation should hide complexity. Fight accumulating dependencies and obscurity with ruthless information hiding.
