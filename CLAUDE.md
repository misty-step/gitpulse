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

**5. SyncService** (`convex/actions/sync/SyncService.ts`)

- **Hides**: One-job-per-installation invariant, incremental cursor-based fetching, rate-limit coordination
- **Exposes**: `startSync()`, `getStatus()`

**6. Time Windows** (`convex/lib/timeWindows.ts`)

- **Hides**: Timezone calculations, UTC hour mapping, DST handling
- **Exposes**: `isLocalSunday()`, `getTimezoneOrDefault()`, `getMidnightUtcHour()`

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
  kind, // "daily" | "weekly"
  userId,
  startDate,
  endDate,
  contentHashAgg, // hash of all selected event hashes (sorted)
  promptVersion,
});

// Cache hit: <5s response
// Cache miss: LLM generation ≤60s
```

### Vocabulary Layering

Each abstraction layer changes vocabulary:

- **Acquisition**: GitHub payloads, webhook events, installation IDs
- **Normalization**: EventFact, contentHash, canonicalText, metrics
- **Intelligence**: Report sections, citations, coverage score
- **Experience**: Cards, tables, charts, UI components

### Scheduled Report Pattern

Weekly and daily reports use timezone-aware scheduling:

```typescript
// User preferences stored as UTC hour when midnight occurs in their timezone
// e.g., America/Chicago (UTC-6) → midnightUtcHour = 6

// Cron runs every hour, queries users by midnightUtcHour
const users = await ctx.runQuery(internal.users.getUsersByMidnightHour, {
  midnightUtcHour: currentHour,
  weeklyEnabled: true,
});

// Filter to only users where it's actually Sunday in their timezone
const eligible = users.filter((u) =>
  isLocalSunday(Date.now(), getTimezoneOrDefault(u.timezone))
);
```

Key files: `convex/crons.ts`, `convex/actions/runWeeklyReports.ts`, `convex/lib/timeWindows.ts`

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

**Complete testing guide**: See [docs/TESTING.md](docs/TESTING.md)

**Test Framework**: Jest 29 + ts-jest (ESM preset) for unit/integration, Playwright for E2E

### Coverage Targets

- **Patch coverage**: ≥80% for new code (enforced in CI via GitHub Actions)
- **Overall coverage**: ≥70% project-wide
- **Critical paths**: 90%+ (auth, webhooks, content hashing, payment)

### Test File Locations

```
app/api/__tests__/          # Next.js route tests
convex/lib/__tests__/       # Library/utility tests
convex/actions/__tests__/   # Convex action tests
e2e/                        # Playwright E2E tests
tests/utils/                # Shared test utilities
  ├── factories.ts          # Test data factories (13 factories)
  └── assertions.ts         # Custom assertions (23 helpers)
```

### Test Philosophy

**Test behavior, not implementation**:
```typescript
// Good: Test what the code does
it("generates report with citations when events exist", async () => {
  const result = await generateReport(context);
  expect(result.citations.length).toBeGreaterThan(0);
});

// Bad: Test how the code does it
it("calls buildPrompt with correct arguments", () => {
  expect(buildPrompt).toHaveBeenCalledWith(...); // Don't test internals
});
```

**Use AAA pattern** (Arrange-Act-Assert):
```typescript
it("computes deterministic hash", () => {
  // Arrange
  const input = { canonicalText: "PR #1", sourceUrl: "..." };

  // Act
  const hash1 = computeContentHash(input);
  const hash2 = computeContentHash(input);

  // Assert
  expectIdenticalHashes(hash1, hash2);
});
```

**Minimize mocks** - prefer real implementations:
```typescript
// Good: Use real pure functions
const hash = computeContentHash(data);

// Good: Use factories for test data
const user = createMockUser({ ghLogin: "alice" });

// Necessary: Mock external APIs
global.fetch = jest.fn(() => createMockResponse({ ... }));
```

### Test Utilities

**Factories** (`tests/utils/factories.ts`) - Create test data with defaults:
```typescript
import { createMockUser, createMockEvent, createMockReportContext } from "../../../tests/utils/factories";

const user = createMockUser(); // With defaults
const alice = createMockUser({ ghLogin: "alice" }); // Override fields
const prEvent = createMockEvent("pr_opened", { metadata: { prNumber: 42 } });
```

Available factories: `createMockUser`, `createMockRepo`, `createMockEvent`, `createMockReport`, `createMockInstallation`, `createMockGitHubUser`, `createMockWebhookPayload`, `createMockReportContext`, `createMockPrompt`, `createMockResponse`, `createMockErrorResponse`, `createMockActionCtx`

**Custom Assertions** (`tests/utils/assertions.ts`) - Clear error messages:
```typescript
import { expectValidContentHash, expectIdenticalHashes, expectValidCitation } from "../../../tests/utils/assertions";

expectValidContentHash(hash); // Checks SHA-256 format
expectIdenticalHashes(hash1, hash2); // For idempotency tests
expectValidCitation("https://github.com/owner/repo/pull/123");
expectValidCoverageScore(0.85, { min: 0.8 });
```

Available assertions: Hash validation, citation validation, coverage validation, report validation, event validation, HTTP validation, Convex document validation

### Running Tests

```bash
# Unit/integration tests
pnpm test                              # Run all tests
pnpm test contentHash.test.ts          # Run specific file
pnpm test --watch                      # Watch mode
pnpm test:coverage                     # With coverage report

# E2E tests
pnpm test:e2e                          # Run all E2E tests
pnpm test:e2e --headed                 # See browser
pnpm test:e2e --ui                     # Interactive debugging
```

### CI/CD Integration

Tests run automatically on every PR:

1. **Unit/Integration** (`.github/workflows/ci.yml`) - Runs `pnpm test`
2. **Coverage Report** (`.github/workflows/coverage.yml`) - Posts coverage comment, enforces 80% patch threshold
3. **E2E Tests** (`.github/workflows/e2e.yml`) - Runs Playwright tests, uploads screenshots on failure

### Key Test Patterns

**Testing Convex Actions**:
```typescript
import { createMockActionCtx } from "../../../tests/utils/factories";

it("creates event when payload is valid", async () => {
  const ctx = createMockActionCtx({
    runQuery: jest.fn().mockResolvedValue(null),
    runMutation: jest.fn().mockResolvedValue("event_123"),
  });

  await processWebhook(ctx, { payload: mockPayload });
  expect(ctx.runMutation).toHaveBeenCalled();
});
```

**Testing GitHub API calls**:
```typescript
import { createMockResponse, createMockErrorResponse } from "../../../tests/utils/factories";

it("handles rate limit errors", async () => {
  const resetTime = Math.floor(Date.now() / 1000) + 3600;
  global.fetch = jest.fn(() =>
    createMockErrorResponse(429, "Too Many Requests",
      { message: "Rate limit exceeded" },
      { "x-ratelimit-reset": String(resetTime) }
    )
  );

  await expect(getRepository("token", "repo")).rejects.toThrow(RateLimitError);
});
```

**Testing E2E flows**:
```typescript
import { test, expect } from '@playwright/test';

test('user can sign in and access dashboard', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('/dashboard', { timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Best Practices

1. **Test Independence** - Each test runs in isolation, no shared state
2. **Clear Names** - Describe what and why: `"throws RateLimitError when API returns 429 with reset header"`
3. **One Assertion Per Concept** - Test one thing, use multiple tests for multiple concepts
4. **Test Error Cases** - Don't just test happy paths
5. **Flaky Test Zero Tolerance** - Fix or delete flaky tests immediately
6. **Keep Tests DRY** - Use factories and shared setup, avoid duplication

### Debugging Tests

```bash
# Debug failing test
pnpm test contentHash.test.ts --verbose

# Run specific test by name
pnpm test -t "produces deterministic hashes"

# Debug E2E test
pnpm test:e2e --headed --debug
pnpm test:e2e --trace on  # Generate trace for viewer
```

For complete testing guide with examples, troubleshooting, and advanced patterns, see **[docs/TESTING.md](docs/TESTING.md)**

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
  success: boolean;
  data?: T;
  error?: ActionError;
  timestamp: number;
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
  properties: { contentHash, repoId, actorId },
});
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
- Sentry for Next.js error tracking (client, server, edge configs in `sentry.*.config.ts`)

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

**Recent Commits** (as of Dec 2025):

```
fc4f184 fix(cron): address PR feedback - cache formatters, fix test comments
9b9b686 feat(cron): migrate weekly reports to midnightUtcHour + Sunday filter
753c85e Sync architecture overhaul: deep modules with comprehensive testing (#16)
cfe4da4 feat(sync): add SyncService orchestrator with one-job-per-installation invariant
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
- ✅ SyncService architecture (one-job-per-installation)
- ✅ Timezone-aware weekly scheduling (midnightUtcHour pattern)
- 🚧 GitHub App webhook integration
- 🚧 Embedding service optimization
- 📋 Planned: Secret rotation, observability dashboards, Stripe integration

---

**Philosophy**: Simplicity through deep modules. Every interface should be minimal; every implementation should hide complexity. Fight accumulating dependencies and obscurity with ruthless information hiding.
