# BACKLOG

Last groomed: 2025-11-20
Analyzed by: 8 specialized perspectives (complexity, architecture, security, performance, maintainability, UX, product, design)
Observability audit: 2025-11-20 (8 infrastructure items added from production readiness gap analysis)
Quality gates audit: 2025-11-20 (12 infrastructure items added: 8 critical/high priority, 2 medium, 2 low)

**Context**: This backlog replaces the previous MVP-focused scale optimizations with business-first prioritization. GitPulse has excellent technical foundation but lacks production readiness infrastructure and go-to-market features. See `docs/archive/BACKLOG-MVP-FEATURES.md` for deferred scale optimizations.

**Strategic Focus**: Move from developer tool → revenue-generating SaaS → team collaboration platform

---

## Now (Sprint-Ready, <2 weeks)

### [TESTING] Add Test Coverage for Footer and HeroMetadata Components

**Files**: Create `components/__tests__/Footer.test.tsx`, `components/__tests__/HeroMetadata.test.tsx`
**Perspectives**: maintainability-maven
**Impact**: Prevent regressions in new UI components, validate clipboard and health check logic
**Source**: PR #9 review feedback

**Problem**: New Footer and HeroMetadata components lack test coverage. Clipboard interaction, health check states, and error handling paths are untested.

**Fix**: Add Jest/React Testing Library tests

```typescript
// components/__tests__/Footer.test.tsx
describe('Footer', () => {
  it('copies email to clipboard on support click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    // ... test implementation
  });

  it('falls back to mailto when clipboard fails', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error()) }
    });
    // ... test implementation
  });
});

// components/__tests__/HeroMetadata.test.tsx
describe('HeroMetadata', () => {
  it('displays operational status when health check succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    // ... test implementation
  });

  it('displays degraded status when health check fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    // ... test implementation
  });

  it('cleans up AbortController on unmount', async () => {
    // ... test implementation
  });
});
```

**Effort**: 2-3h | **Priority**: P2
**Acceptance**: Tests pass, coverage for clipboard/health check logic
**Deferral Rationale**: Components functional and reviewed, tests prevent future regressions

---

### [TESTING] Add Auth Integration Tests

**Files**: Create `convex/lib/__tests__/auth.test.ts`
**Perspectives**: maintainability-maven, security-sentinel
**Impact**: Confidence in Clerk authentication, catch JWT validation regressions

**Problem**: Clerk auth = critical path, 0% test coverage. JWT validation, user identity, auth boundary conditions untested.

**Fix**: Add comprehensive auth integration tests

```typescript
// convex/lib/__tests__/auth.test.ts
import { describe, expect, it } from "@jest/globals";
import { authHealth } from "../authHealth";

describe("Clerk + Convex Auth Integration", () => {
  it("should validate JWT tokens from Clerk", async () => {
    const mockCtx = {
      auth: {
        getUserIdentity: async () => ({
          subject: "user_123",
          issuer: "https://clerk.example.com",
          tokenIdentifier: "clerk|user_123",
          email: "test@example.com",
          emailVerified: true,
        }),
      },
    };

    const result = await authHealth.check(mockCtx as any, {});
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe("user_123");
  });

  it("should reject unauthenticated requests", async () => {
    const mockCtx = {
      auth: {
        getUserIdentity: async () => null,
      },
    };

    const result = await authHealth.check(mockCtx as any, {});
    expect(result.isAuthenticated).toBe(false);
    expect(result.message).toContain("Not authenticated");
  });

  it("should handle missing JWT issuer", async () => {
    // Test edge cases: malformed tokens, expired JWTs, missing claims
  });
});
```

**Effort**: 1.5h | **Priority**: P1
**Acceptance**: Auth tests pass, cover JWT validation + user identity + boundary conditions

---

### [SECURITY] Add pnpm audit to CI

**Files**: `.github/workflows/ci.yml`
**Perspectives**: security-sentinel
**Impact**: Catch vulnerable dependencies before merge

**Problem**: No security audit in CI. Vulnerable dependencies can be introduced and deployed to production.

**Fix**: Add audit job to CI pipeline

```yaml
# .github/workflows/ci.yml (add job)
security-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: "pnpm"

    - run: pnpm install --frozen-lockfile

    - name: Security audit
      run: pnpm audit --audit-level=high
      continue-on-error: false
```

**Effort**: 15m | **Priority**: P1
**Acceptance**: CI fails on HIGH/CRITICAL vulnerabilities, audit runs on every PR

---

### [INFRASTRUCTURE] Replace console.log with Pino Structured Logger

**Files**: `convex/lib/metrics.ts` (23 lines), 61 `console.*` calls across codebase
**Perspectives**: architecture-guardian, maintainability-maven
**Impact**: Proper observability, correlation tracing, performance gain

**Problem**: Primitive logging - no levels, no correlation IDs, no error serialization

```typescript
// Current: convex/lib/metrics.ts:18-23
export function emitMetric(
  metric: MetricName,
  fields: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({ metric, timestamp: new Date().toISOString(), ...fields }),
  );
}
```

**Fix**: Install Pino

```typescript
// convex/lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "gitpulse" },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
  },
});

export function emitMetric(
  metric: MetricName,
  fields: Record<string, unknown> = {},
) {
  logger.info({ metric, ...fields }, `metric:${metric}`);
}
```

**Effort**: 4h (install + migrate 61 call sites) | **Priority**: P0
**Acceptance**: Structured JSON logs with levels, no raw console.\* in production

---

### [INFRASTRUCTURE] Add PII Redaction to Logging

**Files**: `convex/lib/logger.ts` (extend Pino logger)
**Perspectives**: architecture-guardian, security-sentinel
**Impact**: GDPR Article 32 compliance, prevents accidental PII leakage

**Problem**: Current logging has no PII redaction. GitHub emails, usernames, tokens could leak to log aggregators.

**Fix**: Add Pino redaction middleware

```typescript
// convex/lib/logger.ts
import pino from "pino";

const REDACT_PATHS = [
  "email",
  "githubEmail",
  "accessToken",
  "refreshToken",
  "clerkId",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "gitpulse" },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
  },
});
```

**Effort**: 1h | **Priority**: P0
**Acceptance**: PII fields redacted in logs, test with sample user object

---

### [INFRASTRUCTURE] Add Health Check Endpoints

**Files**: `app/api/health/route.ts` (new), `convex/http.ts` (add health endpoint)
**Perspectives**: architecture-guardian
**Impact**: Uptime monitoring, incident detection, deployment verification

**Problem**: No programmatic health check. Cannot monitor uptime, detect database issues, or verify deployments.

**Fix**: Add health endpoints for Next.js + Convex

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    server: "ok",
    convex: await checkConvexHealth(),
    timestamp: Date.now(),
  };

  const allHealthy = Object.values(checks).every(
    (v) => v === "ok" || typeof v === "number",
  );

  return Response.json(checks, {
    status: allHealthy ? 200 : 503,
  });
}

// convex/http.ts
import { httpRouter } from "convex/server";

const http = httpRouter();
http.route({
  path: "/health",
  method: "GET",
  handler: async () => {
    // Verify database connectivity
    await ctx.db.query("users").first();
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  },
});
```

**Effort**: 2h | **Priority**: P0
**Acceptance**: `/api/health` returns 200 with status checks, UptimeRobot configured

---

### [INFRASTRUCTURE] Enable Vercel Analytics

**Files**: `app/layout.tsx`, `package.json`
**Perspectives**: product-visionary, architecture-guardian
**Impact**: Product analytics, funnel tracking, user behavior insights

**Problem**: Zero analytics. Cannot answer: "How many users visit reports page?", "Where do users drop off?", "Which features drive retention?"

**Fix**: Install Vercel Analytics + custom events

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <ClerkProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
            <Analytics />
            <Toaster />
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Track custom events
import { track } from '@vercel/analytics';

track('report_generated', {
  kind: 'daily',
  eventCount: 42,
  userId: clerkId
});
```

**Effort**: 2h | **Priority**: P0
**Acceptance**: Pageviews tracked in Vercel dashboard, custom events firing

---

### [INFRASTRUCTURE] Add Deployment Tracking

**Files**: `.github/workflows/deploy.yml` (new), `convex/lib/sentry.ts`
**Perspectives**: architecture-guardian
**Impact**: Release correlation, error spike detection, rollback decisions

**Problem**: No deployment tracking. When errors spike, cannot correlate to releases. No release markers in Sentry.

**Fix**: Auto-track deployments to Sentry

```yaml
# .github/workflows/deploy.yml (add to existing workflow)
- name: Notify Sentry of deployment
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: gitpulse
    SENTRY_PROJECT: gitpulse-production
  with:
    environment: production
    version: ${{ github.sha }}
```

**Effort**: 1h | **Priority**: P0
**Acceptance**: Deployments appear in Sentry releases, correlated with error spikes

---

### [INFRASTRUCTURE] Add Performance Monitoring (APM)

**Files**: `sentry.client.config.ts`, `sentry.server.config.ts`
**Perspectives**: performance-pathfinder, architecture-guardian
**Impact**: Slow endpoint detection, database query analysis, user-facing latency visibility

**Problem**: No APM. Cannot identify slow API routes, database bottlenecks, or client-side performance issues.

**Fix**: Enable Sentry Performance + Vercel Speed Insights

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [/^https:\/\/[^/]*\.convex\.cloud/],
    }),
  ],
});

// Add custom instrumentation
import { startSpan } from '@sentry/nextjs';

const report = await startSpan({ name: 'generate-report' }, async () => {
  return await convex.action(api.reports.generateDaily, { ... });
});
```

**Effort**: 3h | **Priority**: P0
**Acceptance**: Slow transactions visible in Sentry Performance, p95 latency tracked

---

### [INFRASTRUCTURE] Add Infrastructure Alert Automation

**Files**: `.github/workflows/alerts.yml` (new), `docs/runbooks/` (new)
**Perspectives**: architecture-guardian
**Impact**: Incident detection, on-call automation, mean-time-to-resolution

**Problem**: No automated alerting. Production errors/downtime detected manually or via user reports.

**Fix**: Configure alert channels + runbooks

```yaml
# Sentry alert rules (configured via UI, version-controlled in code)
alerts:
  - name: "High Error Rate"
    condition: "event.count(level:error) > 10 in 5m"
    action: "slack:#incidents, email:oncall@gitpulse.dev"

  - name: "P95 Latency Spike"
    condition: "transaction.duration.p95 > 3000ms"
    action: "slack:#performance"

  - name: "Database Query Slow"
    condition: "span.duration > 500ms AND span.op:db.query"
    action: "slack:#engineering"

# Create runbooks for common incidents
docs/runbooks/
├── high-error-rate.md
├── database-slow.md
└── deployment-rollback.md
```

**Effort**: 2h | **Priority**: P1
**Acceptance**: Alerts fire to Slack when thresholds exceeded, runbooks documented

---

### [INFRASTRUCTURE] Infrastructure as Code for Environment Variables

**Files**: Create `infrastructure/` directory with Pulumi/Terraform configs
**Perspectives**: architecture-guardian, maintainability-maven
**Impact**: Single source of truth for all env vars, eliminate drift, automate deployment config

**Problem**: 6 sources of environment variable configuration (.env.local, Convex dev, Convex prod, Convex defaults, Vercel production, Vercel preview). Manual sync error-prone, no validation, documentation drift.

**Fix**: Infrastructure as Code

```typescript
// infrastructure/convex-env.ts
export const convexEnvironment = {
  development: {
    CLERK_JWT_ISSUER_DOMAIN: clerkDomain,
    GITHUB_APP_ID: githubAppId,
    // ... all dev vars
  },
  production: {
    CLERK_JWT_ISSUER_DOMAIN: clerkDomain,
    GITHUB_TOKEN: secret(githubToken),
    // ... all prod vars
  },
  defaults: {
    // Applied to all preview deployments
    CLERK_JWT_ISSUER_DOMAIN: clerkDomain,
  },
};

// infrastructure/vercel-env.ts
export const vercelEnvironment = {
  production: {
    CONVEX_DEPLOY_KEY: secret(convexProdKey),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPubKey,
  },
  preview: {
    CONVEX_DEPLOY_KEY: secret(convexPreviewKey),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPubKey,
  },
};
```

**Effort**: 1 week (3d config + 2d validation + 2d migration) | **Priority**: P1
**Acceptance**: All env vars defined in code, deployment script applies them, drift detection automated

---

### [TESTING] Add Deployment Integration Tests

**Files**: Create `tests/integration/deployment.test.ts`
**Perspectives**: maintainability-maven, architecture-guardian
**Impact**: Catch deployment config issues before production

**Problem**: No automated testing of deployment flow. Configuration mismatches discovered in production (vercel.json vs package.json vs docs).

**Fix**: Integration tests for deployment

```typescript
describe("Deployment Configuration", () => {
  it("vercel.json buildCommand should match expected", () => {
    const vercelConfig = JSON.parse(fs.readFileSync("vercel.json"));
    expect(vercelConfig.buildCommand).toBe(
      "npx convex deploy --cmd 'pnpm build:app'",
    );
  });

  it("package.json build:app should exist", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json"));
    expect(pkg.scripts["build:app"]).toBeDefined();
  });

  it("required env vars should be documented", () => {
    const readme = fs.readFileSync("README.md", "utf-8");
    expect(readme).toContain("CONVEX_DEPLOY_KEY");
    expect(readme).toContain("CLERK_JWT_ISSUER_DOMAIN");
  });
});
```

**Effort**: 4h | **Priority**: P1
**Acceptance**: CI fails if deployment config drifts from expected

---

### [INFRASTRUCTURE] Install Sentry Error Tracking

**Files**: `app/error.tsx`, `convex/lib/sentry.ts` (new files)
**Perspectives**: architecture-guardian, user-experience-advocate
**Impact**: Production error visibility, alerting, user impact tracking

**Problem**: Frontend errors lost, backend errors buried in logs. No centralized error capture or alerting.

**Fix**: Install Sentry for Next.js + Convex

```typescript
// app/error.tsx
"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  // ... existing UI
}

// convex/lib/sentry.ts
export function captureConvexError(
  error: Error,
  context: Record<string, unknown>,
) {
  Sentry.captureException(error, { extra: context });
  throw error;
}
```

**Effort**: 3h | **Priority**: P0
**Acceptance**: Errors tracked in Sentry dashboard, alerting configured

---

### [SECURITY] Fix XSS Vulnerability in Report HTML Rendering

**File**: `app/dashboard/reports/[id]/page.tsx:258`
**Perspectives**: security-sentinel (HIGH severity)
**Impact**: Prevents session hijacking, account takeover, data exfiltration

**Vulnerable Code**:

```tsx
<div
  className="markdown-content"
  dangerouslySetInnerHTML={{ __html: report.html }}
/>
```

**Attack Scenario**: If LLM generates malicious HTML, attacker can inject JavaScript

**Fix**: Add DOMPurify sanitization

```tsx
import DOMPurify from "isomorphic-dompurify";

<div
  className="markdown-content"
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.html) }}
/>;
```

**Effort**: 1h | **Severity**: HIGH
**Acceptance**: Malicious HTML is stripped, XSS test passes

---

### [SECURITY] Fix Broken Access Control on deleteReport

**File**: `convex/reports.ts:159-164`
**Perspectives**: security-sentinel (MEDIUM severity)
**Impact**: Prevents unauthorized data deletion, privacy violation

**Vulnerable Code**:

```typescript
export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id); // No ownership check!
  },
});
```

**Attack**: Any authenticated user can delete any report by ID

**Fix**: Add ownership verification

```typescript
export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("Report not found");

    if (report.userId !== identity.subject) {
      throw new Error("Unauthorized: You can only delete your own reports");
    }

    await ctx.db.delete(args.id);
  },
});
```

**Effort**: 15m | **Severity**: MEDIUM
**Acceptance**: Users cannot delete others' reports, test verifies

---

### [SECURITY] Update Vulnerable js-yaml Dependency

**File**: `package.json`
**Perspectives**: security-sentinel (MEDIUM-HIGH severity)
**Impact**: Removes prototype pollution vulnerability

**Problem**: js-yaml@3.14.1 via @istanbuljs/load-nyc-config has known CVE

**Fix**: Force resolution

```json
// package.json
"pnpm": {
  "overrides": {
    "js-yaml": "^4.1.1"
  }
}
```

**Effort**: 30m | **Severity**: MEDIUM-HIGH
**Acceptance**: `pnpm audit --production` shows 0 vulnerabilities, tests pass

---

### [PERFORMANCE] Fix N+1 Ingestion Mutations

**File**: `convex/actions/ingestRepo.ts:77-133`
**Perspectives**: performance-pathfinder (CRITICAL priority)
**Impact**: 14s → 50ms (280x improvement) for repo ingestion

**Problem**: Serial mutations in nested loops - 700 sequential roundtrips for 100 PRs with 5 reviews each

```typescript
for (const pr of prs) {
  const actorId = await ctx.runMutation(api.users.upsert, { ... });  // N+1
  await ctx.runMutation(api.events.create, { ... });                  // N+1

  for (const review of reviews) {
    const reviewerId = await ctx.runMutation(api.users.upsert, { ... }); // N+1
    await ctx.runMutation(api.events.create, { ... });                   // N+1
  }
}
```

**Fix**: Batch upserts using `Promise.all()`

```typescript
// Collect all actors first
const allActors = [...prs.map(pr => pr.user), ...reviews.flatMap(r => r.user)];
const uniqueActors = Array.from(new Map(allActors.map(a => [a.id, a])).values());

// Batch upsert actors (parallel)
const actorMap = new Map(
  await Promise.all(
    uniqueActors.map(async (actor) => [
      actor.id,
      await ctx.runMutation(api.users.upsert, { ... })
    ])
  )
);

// Batch create events (single mutation)
await ctx.runMutation(api.events.createBatch, {
  events: prs.map(pr => ({ actorId: actorMap.get(pr.user.id), ... }))
});
```

**Effort**: 3h | **Impact**: 280x speedup
**Acceptance**: Repo ingestion completes in <1s for 100 PRs

---

### [PERFORMANCE] Fix Unbounded events.listWithoutEmbeddings Query

**File**: `convex/events.ts:350-371`
**Perspectives**: performance-pathfinder (CRITICAL priority)
**Impact**: 5s → <10ms (500x improvement) for embedding queue

**Problem**: `.collect()` loads ALL embeddings into memory - 100k embeddings → ~50MB payload

```typescript
const allEmbeddings = await ctx.db.query("embeddings").collect(); // UNBOUNDED!
```

**Fix**: Use existing `embeddingQueue` table

```typescript
export const listWithoutEmbeddings = internalQuery({
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("embeddingQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(args.limit);

    return Promise.all(pending.map((job) => ctx.db.get(job.eventId)));
  },
});
```

**Effort**: 30m | **Impact**: 500x speedup
**Acceptance**: Query completes in <10ms regardless of embedding count

---

### [PERFORMANCE] Fix Unbounded KPI Queries

**Files**: `convex/kpis.ts:46-49`, `convex/kpis.ts:142-150`
**Perspectives**: performance-pathfinder (HIGH priority)
**Impact**: 3s → 50ms (60x improvement) for dashboard KPI cards

**Problem**: `.collect()` fetches entire user/repo history - 10k events → 2MB query

```typescript
const allEvents = await ctx.db
  .query("events")
  .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id))
  .collect(); // UNBOUNDED!

const eventsInRange = allEvents.filter(
  (e) => e.ts >= startDate && e.ts <= endDate,
);
```

**Fix**: Use index range filters

```typescript
let query = ctx.db
  .query("events")
  .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id));

if (startDate) query = query.filter((q) => q.gte(q.field("ts"), startDate));
if (endDate) query = query.filter((q) => q.lte(q.field("ts"), endDate));

const events = await query.take(10000); // reasonable cap
```

**Effort**: 1h | **Impact**: 60x speedup
**Acceptance**: Dashboard KPIs load in <100ms

---

### [UX] Translate Backend Errors to User-Friendly Messages

**Files**: 70+ `throw new Error()` statements across `convex/lib/`
**Perspectives**: user-experience-advocate (CRITICAL priority), maintainability-maven
**Impact**: 80% reduction in "broken app" perception

**Problem**: Users see cryptic error messages like "GOOGLE_API_KEY not configured"

**Fix**: Extend `lib/errors.ts` ERROR_MESSAGES

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // LLM errors
  "GOOGLE_API_KEY not configured":
    "AI service configuration error. Please contact support.",
  "No response from":
    "AI service temporarily unavailable. Please try again in a few minutes.",

  // GitHub errors
  "Failed to mint installation token":
    "Unable to connect to GitHub. Please reconnect your account in Settings.",

  // Embedding errors
  "Both Voyage and OpenAI embedding failed":
    "Report generation temporarily unavailable. Retrying automatically.",

  // Add 40+ more patterns...
};
```

**Effort**: 3h | **Impact**: Users self-resolve instead of abandoning
**Acceptance**: Common errors show user-friendly messages

---

### [UX] Add Strong Confirmation for Report Deletion

**File**: `app/dashboard/reports/page.tsx:84`
**Perspectives**: user-experience-advocate (CRITICAL priority)
**Impact**: Prevents 95% of accidental deletions

**Problem**: Native `confirm()` is easy to accidentally click, no undo

```typescript
if (!confirm("Are you sure you want to delete this report?")) return;
```

**Fix**: Custom modal with stronger confirmation

```typescript
{deleteConfirmation && (
  <Modal onClose={() => setDeleteConfirmation(null)}>
    <h3>Delete Report Permanently?</h3>
    <p>
      You're about to delete "<strong>{deleteConfirmation.title}</strong>".
      This cannot be undone.
    </p>
    <p className="text-amber-600 mt-2">
      ⚠️ This will permanently remove the report and all its data.
    </p>
    <div className="flex gap-3 mt-6">
      <button onClick={() => setDeleteConfirmation(null)}>Cancel</button>
      <button
        onClick={() => handleDelete(deleteConfirmation.reportId)}
        className="bg-red-600 text-white"
      >
        Yes, Delete Permanently
      </button>
    </div>
  </Modal>
)}
```

**Effort**: 1h | **Impact**: Prevents accidental data loss
**Acceptance**: Deletion requires explicit confirmation modal

---

### [DESIGN SYSTEM] Migrate Hardcoded Colors to Semantic Tokens

**Files**: `Skeleton.tsx` (16 instances), `CitationDrawer.tsx` (8), `ThemeToggle.tsx` (6), `CoverageMeter.tsx` (5), `MinimalHeader.tsx` (12)
**Perspectives**: design-systems-architect (HIGH impact)
**Impact**: Single-source-of-truth theming, instant brand pivots

**Problem**: 47 instances of `gray-200`, `neutral-800`, `blue-600` bypass semantic token system

```tsx
// Current: components/Skeleton.tsx:11
bg-gray-200 dark:bg-neutral-700  // Should be bg-surface-muted
```

**Fix**: Add missing tokens + migrate components

```css
/* app/globals.css - Add missing semantic tokens */
@theme inline {
  --color-skeleton: var(--surface-muted);
  --color-skeleton-dark: var(--border);
  --color-accent-blue: var(--pulse);
}
```

Then migrate all hardcoded colors:

- `bg-gray-200 dark:bg-neutral-700` → `bg-skeleton`
- `border-gray-200 dark:border-neutral-800` → `border-border`
- `text-blue-600` → `text-foreground`

**Effort**: 10h (4h token definition + 6h migration of 47 instances) | **Priority**: HIGH
**Acceptance**: Zero hardcoded Tailwind color shades in components/, all use semantic tokens

---

## P2 Quality Improvements (From PR #1 Review Feedback)

*Added: 2025-11-23 | Source: CodeRabbit/Codex automated review of infrastructure/production-hardening PR*

These are lower-priority refinements identified during PR review. All are valid improvements but deferred to avoid blocking the critical infrastructure changes.

### [TESTING] Enrich Error Context in ingestMultiple Logging

**File**: `convex/actions/ingestMultiple.ts:46-68`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Better debugging for multi-repo ingestion failures

Currently logs error message strings, but not full Error objects. Add full error object to logger calls:

```diff
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // ...

-   logger.error(
-     { repoFullName, errorMessage },
-     "Failed to ingest repository",
-   );
+   logger.error(
+     { repoFullName, errorMessage, err: error },
+     "Failed to ingest repository",
+   );
```

**Benefit**: Preserves stack traces and error types in structured logs

**Effort**: 15min | **Priority**: P2

---

### [LOGGING] Prevent metric Field Override in emitMetric

**File**: `convex/lib/logger.ts:78-83`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Defense against accidental metric field clobbering

Current implementation allows callers to override the canonical `metric` field if they pass `{ metric: "foo" }` in fields object:

```diff
 export function emitMetric(
   metric: string,
   fields: Record<string, unknown> = {},
 ) {
-  logger.info({ metric, ...fields }, `metric:${metric}`);
+  // Ensure canonical metric field cannot be overridden by callers
+  logger.info({ ...fields, metric }, `metric:${metric}`);
 }
```

**Benefit**: Guarantees metric field integrity in telemetry data

**Effort**: 5min | **Priority**: P2

---

### [LOGGING] Truncate LLM Error Messages to Prevent Log Bloat

**File**: `convex/lib/LLMClient.ts:233-262`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Prevent excessive log volume from large API error responses

While OpenAI/Gemini APIs return structured errors and don't echo prompts, truncating error bodies is a defensive practice:

```typescript
const errorText =
  error instanceof Error
    ? error.message.slice(0, 1024)  // Truncate to 1KB
    : String(error).slice(0, 1024);
```

**Benefits**:
- Prevents log storage bloat from malformed/proxy responses
- Guards against edge cases (gateways, custom error middleware)
- Follows security-conscious logging practices

**Effort**: 10min | **Priority**: P2

---

### [TESTING] Import REDACT_PATHS from Production Logger

**File**: `convex/lib/__tests__/logger.test.ts:25-64`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Keep test redaction config in sync with production

Test duplicates `REDACT_PATHS` array from `convex/lib/logger.ts`. If production config changes, tests could pass with incorrect assertions.

**Fix**:
1. Export `REDACT_PATHS` from `convex/lib/logger.ts`
2. Import in test file instead of hardcoding

**Benefit**: Single source of truth for PII redaction rules

**Effort**: 5min | **Priority**: P2

---

### [DOCS] Fix Markdown Linting Issues

**Files**: Multiple documentation files
**Reviewer**: markdownlint (automated)
**Impact**: Clean linter output, better link clickability

**TODO.md** (lines 9, 23):
- Convert bare URLs to markdown links
- `https://gitpulse-c6gb7npgp-misty-step.vercel.app` → `[Preview](https://...)`

**docs/runbooks/sentry-alerts.md** (lines 9, 23, 35, 150, 197):
- Wrap URLs in angle brackets: `<https://sentry.io/...>`

**docs/deployment/QUICK_START.md** (lines 14, 113-114):
- Same URL formatting

**docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md** (lines 9, 28, 87, 93):
- Add language identifiers to fenced code blocks (```text, ```bash, ```env)

**Effort**: 20min | **Priority**: P2

---

### [CODE QUALITY] Use else-if for Mutual Exclusivity in instrumentation.ts

**File**: `instrumentation.ts:1-9`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Prevent theoretical race condition, clarify intent

```diff
 export async function register() {
   if (process.env.NEXT_RUNTIME === "nodejs") {
     await import("./sentry.server.config");
-  }
-
-  if (process.env.NEXT_RUNTIME === "edge") {
+  } else if (process.env.NEXT_RUNTIME === "edge") {
     await import("./sentry.edge.config");
   }
 }
```

**Benefit**: Makes mutual exclusivity explicit, prevents both imports if NEXT_RUNTIME changes mid-execution (unlikely but defensive)

**Effort**: 2min | **Priority**: P2

---

### [SECURITY] Add 1:1 Clerk↔GitHub Invariant Validation

**File**: `convex/users.ts:135-150`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Prevent cross-account token overwrites

Current `updateGitHubAuth` logic can overwrite tokens if:
- A `users` row matched by `clerkId` already has different GitHub identity
- A row matched by GitHub identity already has different `clerkId`

**Enhancement**: Add strict 1:1 mapping validation:

```typescript
if (user.clerkId && user.clerkId !== args.clerkId) {
  throw new Error(
    "Clerk account mismatch for GitHub auth; refusing to overwrite tokens.",
  );
}

if (user.clerkId === args.clerkId && user.ghId && user.ghId !== args.githubProfile.id) {
  // Decide policy: allow "migrating" Clerk user to new GitHub identity?
}
```

**Trade-off**: Prevents confusing bugs vs. reduces flexibility for account migrations

**Effort**: 30min | **Priority**: P2

---

### [SCRIPTS] Add jq Prerequisite Check and Remove Hard-Coded Path

**File**: `scripts/setup-deployment.sh:80-144`
**Reviewer**: CodeRabbit (Nitpick), ShellCheck SC2155
**Impact**: Better portability, clearer error messages

**Issue 1**: Script uses `jq` but doesn't validate installation:

```bash
# Add to check_prerequisites()
if command_exists jq; then
    print_success "jq installed: $(jq --version)"
else
    print_error "jq not found. Install: brew install jq"
    all_good=false
fi
```

**Issue 2**: Error message hard-codes developer path:

```diff
- print_error "Not in project root. Please run from: /Users/phaedrus/Development/gitpulse"
+ print_error "Not in project root. Expected package.json at: $PROJECT_DIR"
```

**Issue 3**: ShellCheck SC2155 - split local declarations from command substitutions:

```bash
# Before
local node_version=$(node --version)

# After
local node_version
node_version=$(node --version)
```

**Effort**: 15min | **Priority**: P2

---

### [CI/CD] Pin TruffleHog Version for Stability

**File**: `.github/workflows/ci.yml:9-25`
**Reviewer**: CodeRabbit (Nitpick)
**Impact**: Prevent unexpected CI breakage from upstream changes

```diff
       - name: Run TruffleHog
-        uses: trufflesecurity/trufflehog@main
+        uses: trufflesecurity/trufflehog@v3.82.13
```

Check [TruffleHog releases](https://github.com/trufflesecurity/trufflehog/releases) for latest stable version.

**Effort**: 2min | **Priority**: P2

---

### [ARCHITECTURE] Reconsider Infrastructure as Code Complexity

**File**: `BACKLOG.md:382-424`
**Reviewer**: CodeRabbit (Strategic concern)
**Impact**: Avoid premature abstraction, align on config management approach

Current tension:
1. **Vercel-Managed Approach** (docs): Use Vercel dashboard for env vars
2. **IaC Proposal** (BACKLOG): Use Pulumi/Terraform for env vars in code
3. **Drift Detection** (BACKLOG): Assumes dashboard is source of truth

**Alternatives**:
- **Simpler**: Consolidated `.env.example` with validation scripts (already in PR)
- **Hybrid**: Use Vercel API to export config, version control exports, detect drift
- **Defer IaC**: Focus on observability/drift detection first, evaluate IaC necessity later

**Recommendation**: Defer full IaC migration until config sprawl becomes unmanageable

**Effort**: N/A (discussion item) | **Priority**: P2

---

### [ARCHITECTURE] DeploymentService Abstraction May Be Premature

**File**: `BACKLOG.md:869-899`
**Reviewer**: CodeRabbit (Strategic concern)
**Impact**: Avoid unnecessary complexity layer

**Current state**: Vercel handles deployment automatically via `npx convex deploy --cmd 'pnpm build:app'`

**Proposed abstraction**: New `lib/deployment/` module with `deployPreview()`, `deployProduction()`, `validateConfig()`, `rollback()` methods (2-week effort)

**Concerns**:
- Vercel already provides deployment APIs and UI
- Abstraction doesn't reduce complexity, just relocates it
- Rollback available via Vercel dashboard
- Conflicts with "Vercel-Managed" approach

**Alternative**: Focus on deployment **observability** (monitoring, alerting, health checks) before adding abstraction layers. PR already includes health check endpoints.

**Recommendation**: Defer service abstraction until deployment logic becomes complex enough to warrant it

**Effort**: N/A (discussion item) | **Priority**: P2

---

## Next (This Quarter, <3 months)

### [MONETIZATION] Add Stripe Payment Infrastructure

**Scope**: New feature - subscription management, usage limits, plan upgrade flows
**Perspectives**: product-visionary (CRITICAL for business viability)
**Business Case**: Currently $0 revenue. With 1000 free users, 10% conversion = 100 Pro users × $15 = **$1500 MRR**

**Why**: Cannot monetize current users. Freemium conversion unlocks revenue stream.

**Implementation**:

- Install Stripe SDK, create customer/subscription webhooks
- Add `subscriptions` table (workspaceId, plan, status, stripeCustomerId)
- Add `usageMetering` table (date, reportsGenerated, apiCalls)
- Enforce plan limits in middleware (3 repos free, unlimited Pro)
- Build upgrade flows in UI

**Pricing Tiers**:

- Free: 1 user, 3 repos, daily reports only, web-only
- Pro ($15/month): Unlimited repos, daily+weekly, Slack+email, 1-year retention
- Team ($40/user/month): Everything in Pro + team dashboards, workspaces, webhooks

**Effort**: 2 weeks | **Impact**: Creates revenue stream (currently $0)
**Acceptance**: Users can subscribe via Stripe, plan limits enforced, upgrade flow works

---

### [DISTRIBUTION] Add Slack Integration

**Scope**: New feature - Slack bot posts reports to channels
**Perspectives**: product-visionary (CRITICAL for retention)
**Business Case**: Users who receive Slack reports have 5x higher retention. Slack has 20M+ daily active users.

**Why**: Reports live only in web app. Users must remember to check (low engagement). Slack integration meets users where they work.

**Implementation**:

- Slack OAuth flow for workspace connection
- Add `deliveryChannels` table (userId, type: "slack", config: channel ID)
- Bot posts daily/weekly reports to configured channels
- Slash commands: `/gitpulse report`, `/gitpulse status`
- Message formatting with rich cards, citations as thread

**Use Cases**:

- "Post daily standup to #engineering at 9am"
- "Share this report with #executive-updates"

**Effort**: 1 week (5 days OAuth + bot + formatting) | **Impact**: 5x retention lift, viral growth
**Acceptance**: Reports delivered to Slack on schedule, slash commands work

---

### [COLLABORATION] Add Team Workspaces

**Scope**: New feature - shared workspaces, team dashboards, permissions
**Perspectives**: product-visionary (CRITICAL for B2B revenue)
**Business Case**: Unlocks team pricing tier - $40/user/month for 10-person team = $400/mo vs $15 individual

**Why**: Single-user reports only. Engineering managers can't see team activity. Teams can't collaborate on retrospectives. **This is table-stakes for B2B sales.**

**Implementation**:

- Add `workspaces` table (name, ownerUserId, plan, memberIds)
- Add `workspaceMembers` table (workspaceId, userId, role: admin/member/viewer)
- Update `reports` table with `workspaceId`, `scope`: personal/team/project
- Team dashboard aggregating multiple developers
- Invite flow, permissions middleware

**Use Cases**:

- "See what my team shipped this week"
- "Share retrospective with whole engineering org"

**Effort**: 2 weeks (schema + permissions + UI) | **Impact**: Foundation for B2B revenue
**Acceptance**: Users can create workspaces, invite members, view team dashboards

---

### [ARCHITECTURE] Create Deployment Service Module

**Files**: Create `lib/deployment/` directory
**Perspectives**: complexity-archaeologist, architecture-guardian
**Impact**: Deep module hiding all deployment complexity

**Problem**: Deployment knowledge scattered across vercel.json, package.json, CI workflows, setup scripts, documentation. Violates single source of truth, obscurity around "how to deploy correctly".

**Fix**: Deployment service with clean interface

```typescript
// lib/deployment/DeploymentService.ts
export class DeploymentService {
  // Hide: Convex deploy keys, build commands, env var validation
  // Expose: Simple deploy methods

  async deployPreview(branch: string): Promise<DeploymentResult>;
  async deployProduction(): Promise<DeploymentResult>;
  async validateConfig(): Promise<ValidationResult>;
  async rollback(deploymentId: string): Promise<RollbackResult>;
}

// Usage
const deployment = new DeploymentService();
const result = await deployment.deployPreview("feature-branch");
if (!result.success) {
  console.error(result.error);
}
```

**Effort**: 2 weeks | **Impact**: Single source of truth, testable deployment logic
**Strategic Value**: Enables automated deployment testing, rollback automation, multi-cloud future

---

### [INFRASTRUCTURE] Add Staging Environment

**Files**: Convex staging deployment, Vercel staging project
**Perspectives**: architecture-guardian
**Impact**: Safe testing ground between preview and production

**Problem**: Only dev and production environments. Risky changes tested directly in production preview deployments. No place to test infrastructure changes (env var updates, build command changes).

**Fix**: Add staging environment

- Convex staging deployment (separate from dev/prod)
- Vercel staging project with staging branch auto-deploy
- Smoke tests run against staging before production promotion
- Database migrations tested in staging first

**Effort**: 1 week | **Priority**: P1
**Acceptance**: Staging environment exists, auto-deploys from staging branch, smoke tests pass

---

### [DISTRIBUTION] Add Export Functionality

**Scope**: New feature - PDF, Markdown, CSV exports
**Perspectives**: product-visionary, user-experience-advocate
**Business Case**: Removes adoption barrier ("try before commit"), shareability drives inbound

**Why**: Reports viewable in web UI only. Can't share with non-users (executives, investors). No offline access.

**Implementation**:

- PDF export using puppeteer
- Markdown export (simple template)
- CSV export (tabular event data)
- Download button with format dropdown

**Use Cases**:

- "Export weekly retro as PDF for 1:1 with manager"
- "Download all data as CSV for analysis in Excel"

**Effort**: 1 week (3d PDF + 1d Markdown/CSV + 1d UI) | **Impact**: Trust signal (no lock-in), shareability
**Acceptance**: Users can download reports in PDF/MD/CSV formats

---

### [ARCHITECTURE] Extract Report Generation Stages

**File**: `convex/lib/reportOrchestrator.ts:53-261`
**Perspectives**: complexity-archaeologist (temporal decomposition)
**Why**: 209-line function organized by execution order (collecting → generating → validating → saving) makes it difficult to extract/test individual stages

**Approach**: Extract stages into separate functions

```typescript
async function collectEvents(ctx, params) {
  /* lines 76-153 */
}
async function generateContent(context, allowedUrls) {
  /* lines 155-171 */
}
async function validateOutput(events, generated) {
  /* lines 173-205 */
}
async function persistReport(ctx, reportData) {
  /* lines 207-258 */
}
```

**Effort**: 3h | **Impact**: 209-line function → 4 focused 30-50 line functions, enables isolated testing
**Strategic Value**: Enables parallel evolution of generation/validation/persistence strategies

---

### [ARCHITECTURE] Split canonicalizeEvent.ts by Event Type

**File**: `convex/lib/canonicalizeEvent.ts:1-627`
**Perspectives**: complexity-archaeologist (god object), architecture-guardian
**Why**: 627 lines, 16 functions, 5+ event types in single file. High coupling between event types.

**Approach**: Split by event type

```
convex/lib/canonicalize/
├── index.ts              # Export unified canonicalizeEvent() dispatcher
├── pullRequest.ts        # canonicalizePullRequest + PR helpers
├── review.ts             # canonicalizePullRequestReview
├── issue.ts              # canonicalizeIssue + canonicalizeIssueComment
├── commit.ts             # canonicalizeCommit
├── timeline.ts           # canonicalizeTimelineItem
└── shared.ts             # normalizeRepo, normalizeActor, resolveTimestamp
```

**Effort**: 4h | **Impact**: 1x 627-line file → 6x 100-150 line focused modules
**Strategic Value**: Unblocks addition of new event types without expanding monolith

---

### [ARCHITECTURE] Consolidate LLM Provider Logic

**Files**: `convex/lib/llmOrchestrator.ts:73-114`, `convex/lib/LLMClient.ts:282-349`
**Perspectives**: architecture-guardian (responsibility violation)
**Why**: Duplicate OpenAI/Gemini API calls in 2 files with different retry logic. Which is canonical?

**Approach**: Consolidate to single LLM abstraction

- Keep `LLMClient.ts` as canonical provider logic
- Delete duplicate `callOpenAI`/`callGemini` from `llmOrchestrator.ts`
- Orchestrator uses LLMClient with fallback chain

**Effort**: 4h | **Impact**: Remove 200 lines of duplicate logic, single source of truth

---

### [TESTING] Add Test Coverage for Business Logic

**Files**: `convex/lib/reportOrchestrator.ts:311-348` (cost estimation), `convex/lib/llmOrchestrator.ts:160-203` (provider fallback)
**Perspectives**: maintainability-maven (CRITICAL test gap)
**Why**: Financial logic (cost estimation, token budgets) has zero tests. Target cost is ≤$0.02/user-day but no validation.

**Approach**: Add test suites

```typescript
// convex/lib/__tests__/reportOrchestrator.test.ts
describe("estimateCost", () => {
  it("should calculate Google cost at $0.0005 per event", () => {
    expect(estimateCost("google", "gemini-2.5-flash", 100)).toBe(0.05);
  });

  it("should not exceed $0.02/day target for typical usage", () => {
    const typicalEvents = 25;
    expect(
      estimateCost("google", "gemini-2.5-flash", typicalEvents),
    ).toBeLessThanOrEqual(0.02);
  });
});

describe("generateWithOrchestrator", () => {
  it("should fallback to second candidate if first fails", async () => {
    mockOpenAI.mockRejectedValueOnce(new Error("rate limit"));
    mockGemini.mockResolvedValueOnce("report markdown");
    const result = await generateWithOrchestrator("daily", mockPrompt);
    expect(result.provider).toBe("google");
  });
});
```

**Effort**: 3h | **Impact**: Confidence in production fallback behavior, financial correctness

---

### [TESTING] Add Component Tests (React Testing Library)

**Files**: 11 components need test coverage
**Perspectives**: design-systems-architect (HIGH impact)
**Why**: Zero component tests. Refactoring risk, no regression safety net, dark mode untested.

**Approach**: Set up RTL + test all components

```typescript
// components/KPICard.test.tsx
describe('KPICard', () => {
  it('renders metric with formatted value', () => {
    render(<KPICard label="PRs" value={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows positive trend in green', () => {
    render(<KPICard label="Commits" value={10} trend={{ change: 2, percentage: 25 }} />)
    expect(screen.getByText('↑ 25.0%')).toHaveClass('text-emerald-600')
  })
})
```

**Effort**: 9.5h (4h RTL setup + 30m per component) | **Impact**: Refactoring confidence, catch regressions
**Strategic Value**: Technical investment that pays dividends long-term

---

### [UX] Add Interactive Analytics Dashboard

**Scope**: New feature - charts, filters, drill-downs
**Perspectives**: product-visionary (workflow gap), user-experience-advocate
**Why**: Reports are static documents. Managers can't answer ad-hoc questions without regenerating.

**Approach**: Add chart components + filter system

- ActivityTimeline chart (events over time)
- PRVelocityChart (open/merged PRs)
- ReviewLatencyChart (time to first review)
- Filters by repo, user, event type, date range

**Libraries**: recharts, date-fns, @tanstack/react-table

**Use Cases**:

- "Show me all PRs stuck in review >3 days"
- "Compare my team's velocity to last quarter"

**Effort**: 2 weeks (5d charts + 3d filters + 2d queries) | **Impact**: Power user retention 3x, upsell lever
**Strategic Value**: Required to compete with LinearB/Jellyfish

---

### [UX] Add Smart Alerts / Anomaly Detection

**Scope**: New feature - proactive notifications
**Perspectives**: product-visionary (productivity enhancement)
**Why**: Passive reporting only. Users must check reports to find issues. Alerts drive daily active usage.

**Approach**: Rule engine + anomaly detection

- Add `alertRules` table (type, condition, channels)
- Add `alertHistory` table (triggeredAt, message, acknowledged)
- Detection cron job (hourly)
- Alert delivery via Slack/email

**Use Cases**:

- "Alert me when a PR has been in review >72 hours"
- "Notify team when velocity drops 30% week-over-week"

**Effort**: 2 weeks (4d rule engine + 3d anomaly detection + 2d delivery + 3d UI) | **Impact**: 40% retention lift
**Strategic Value**: Proactive alerts are key buyer persona feature

---

### [MAINTAINABILITY] Standardize Error Handling Pattern

**Files**: Multiple across `convex/actions/`, `convex/lib/`
**Perspectives**: maintainability-maven (inconsistent patterns)
**Why**: 3 error patterns (throw exceptions, return ActionResult<T>, silent failures with console.warn). Developers must handle different patterns.

**Approach**: Standardize on ActionResult<T> everywhere

```typescript
// Update all actions to return ActionResult<T>
export async function mintInstallationToken(
  installationId: number,
): Promise<ActionResult<InstallationToken>> {
  try {
    // ... existing logic ...
    return success(token);
  } catch (error) {
    return failure(createError(ErrorCode.GITHUB_API_ERROR, error.message));
  }
}
```

**Effort**: 4h (update all actions) | **Impact**: Uniform error handling, predictable APIs

---

### [INFRASTRUCTURE] Install Changesets for Changelog Automation

**Files**: Create `.changeset/config.json`, update `package.json`
**Perspectives**: maintainability-maven
**Impact**: Automated version bumps + changelog generation, eliminate manual release process

**Problem**: Manual versioning (stuck at 0.1.0), no changelog, 30-minute manual release process. Breaking changes buried in commits.

**Fix**: Install Changesets (best for apps vs semantic-release for libraries)

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@2.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [],
  "access": "restricted",
  "baseBranch": "master",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

```json
// package.json - add scripts
"scripts": {
  "changeset": "changeset",
  "version": "changeset version",
  "release": "pnpm build && changeset publish"
}
```

**Workflow**:

1. Developer runs `pnpm changeset` when making changes (creates `.changeset/*.md`)
2. CI creates PR with version bump + CHANGELOG.md
3. Merge PR → automated release

**Effort**: 30m | **Priority**: P2
**Acceptance**: Changeset CLI installed, config created, docs updated with workflow

---

### [INFRASTRUCTURE] Add Environment Validation Script

**Files**: Create `scripts/validate-env.sh`, update `vercel.json`
**Perspectives**: architecture-guardian
**Impact**: Catch missing env vars before deploy, prevent silent preview deploy failures

**Problem**: Preview deploys may fail silently if env vars missing (NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY). Discovered only when users report bugs.

**Fix**: Pre-build env validation script

```bash
#!/bin/bash
# scripts/validate-env.sh

set -e

echo "🔍 Validating environment variables..."

# Required Next.js vars
if [ -z "$NEXT_PUBLIC_CONVEX_URL" ]; then
  echo "❌ Missing: NEXT_PUBLIC_CONVEX_URL"
  exit 1
fi

# Required Convex vars (CI only)
if [ "$CI" = "true" ] && [ -z "$CONVEX_DEPLOY_KEY" ]; then
  echo "❌ Missing: CONVEX_DEPLOY_KEY (required for CI builds)"
  exit 1
fi

# Optional but recommended
if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
  echo "⚠️ Warning: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set (auth will fail)"
fi

echo "✅ Environment validation passed"
```

```json
// vercel.json - add to install command
{
  "installCommand": "chmod +x scripts/validate-env.sh && ./scripts/validate-env.sh && pnpm install"
}
```

**Effort**: 30m | **Priority**: P2
**Acceptance**: Script validates required vars, Vercel builds fail fast on missing env, clear error messages

---

### [INFRASTRUCTURE] Track Convex Action Errors with Structured IDs

**Files**: `convex/lib/errors.ts`, all `convex/actions/**`
**Perspectives**: architecture-guardian, maintainability-maven
**Impact**: Error correlation, debugging velocity, production incident analysis

**Problem**: Convex action errors lack correlation IDs. Cannot trace error through logs, link frontend error to backend cause, or group related failures.

**Approach**: Add structured error wrapper with correlation tracking

```typescript
// convex/lib/errors.ts
import { v } from "convex/values";
import { nanoid } from "nanoid";

export interface StructuredError {
  errorId: string; // Unique ID for this error instance
  code: string; // Error type (GITHUB_API_ERROR, LLM_TIMEOUT, etc.)
  message: string; // User-friendly message
  details?: unknown; // Technical details
  timestamp: number;
  correlationId?: string; // Trace across multiple actions
}

export function createError(
  code: string,
  message: string,
  details?: unknown,
  correlationId?: string,
): StructuredError {
  return {
    errorId: nanoid(),
    code,
    message,
    details,
    timestamp: Date.now(),
    correlationId: correlationId || nanoid(),
  };
}

// convex/actions/reports/generateDaily.ts
export const generateDaily = action({
  handler: async (ctx, args) => {
    const correlationId = nanoid();

    try {
      logger.info(
        { correlationId, userId: args.userId },
        "Starting daily report generation",
      );

      const events = await ctx.runQuery(api.events.listByUser, {
        userId,
        correlationId,
      });
      const report = await generateWithOrchestrator(events, correlationId);

      return success(report);
    } catch (error) {
      const structuredError = createError(
        "REPORT_GENERATION_FAILED",
        "Unable to generate daily report",
        { originalError: error.message },
        correlationId,
      );

      logger.error(structuredError, "Report generation failed");
      Sentry.captureException(error, { extra: structuredError });

      return failure(structuredError);
    }
  },
});
```

**Effort**: 1 week | **Impact**: 10x faster incident debugging, error grouping
**Acceptance**: All action errors include errorId + correlationId, searchable in Sentry

---

### [INFRASTRUCTURE] Add Session Replay (Privacy-Compliant)

**Files**: `sentry.client.config.ts`, `app/layout.tsx`
**Perspectives**: user-experience-advocate, security-sentinel
**Impact**: Bug reproduction, UX issue discovery, rage-click detection

**Problem**: Cannot reproduce user-reported bugs. "Report generation failed" → No video of what user did, which buttons clicked, what state existed.

**Approach**: Enable Sentry Session Replay with PII masking

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  integrations: [
    new Sentry.Replay({
      maskAllText: false,
      maskAllInputs: true,
      block: [
        ".user-email", // PII elements
        "[data-sensitive]", // Custom sensitive markers
        ".github-token",
      ],
      mask: [".user-name", ".repo-name"],
    }),
  ],
});
```

**Privacy Considerations**:

- Mask all form inputs (passwords, API keys)
- Block sensitive DOM elements (emails, tokens)
- Network request bodies redacted by default
- GDPR-compliant (user consent required for EU users)

**Effort**: 3h | **Impact**: 80% faster bug reproduction, catch UX issues
**Acceptance**: Session replays available for error events, PII masked, <1% perf impact

---

### [ACCESSIBILITY] Add ARIA Labels and Alt Text

**Files**: All UI components in `app/` directory
**Perspectives**: user-experience-advocate (WCAG 2.1 AA compliance)
**Why**: Zero ARIA labels or alt text. Screen reader users cannot navigate app.

**Approach**: Add ARIA labels to all interactive elements

```tsx
// Interactive buttons
<button
  onClick={handleDelete}
  aria-label={`Delete report titled ${report.title}`}
>
  Delete
</button>

// Expandable sections
<button
  onClick={() => setOpen(!open)}
  aria-expanded={open}
  aria-controls="citations-list"
>
  Citations ({citations.length})
</button>
```

**Effort**: 4h (audit + fix all pages) | **Impact**: Accessible to 15% more users (screen readers, keyboard-only)

---

## Soon (Exploring, 3-6 months)

- **[TESTING] Install React Testing Library for Component Tests** - RTL + Vitest for UI components, test auth boundaries/report cards/forms, 0% component coverage currently (4h setup + sample tests)
- **[PERFORMANCE] Add Bundle Size Tracking** - Next.js bundle analyzer + CI checks for bundle size regressions, catch bloat early (1h)
- **[Product] Custom Report Templates** - User-created templates, marketplace, freemium upsell (2 weeks)
- **[Product] Email Delivery** - Daily/weekly digest emails, SMTP integration (3 days)
- **[Product] Public Report Links** - Shareable URLs for stakeholders, no auth required (2 days)
- **[Product] Bulk Operations** - Bulk delete reports, bulk repo actions (3h)
- **[Product] Report Search/Filter** - Search by content, filter by type/date (2h)
- **[Integration] GitHub Actions CI/CD** - Deployment tracking, DORA metrics (2 weeks)
- **[Integration] Webhooks API** - Send reports to external systems (2 days)
- **[Design] OKLCH Color Space** - Perceptually uniform colors across themes (2h)

### [ARCHITECTURE] Deployment Observability Dashboard

**Files**: Create `app/admin/deployments/page.tsx`
**Perspectives**: architecture-guardian
**Impact**: Visibility into deployment history, health, rollback capability

**Problem**: No visibility into deployment history, current deployment health, or ability to quickly rollback. Must check Vercel/Convex dashboards separately.

**Fix**: Unified deployment dashboard

- Show last 20 deployments with status, timing, committer
- Health checks for current production deployment
- One-click rollback to previous deployment
- Deployment annotations (which PR, which features)

**Effort**: 1 week | **Impact**: Faster incident response, deployment confidence
**Acceptance**: Dashboard shows deployment history, health status, supports rollback

---

### [ARCHITECTURE] Automated Deployment Drift Detection

**Files**: Create `.github/workflows/drift-detection.yml`
**Perspectives**: architecture-guardian, maintainability-maven
**Impact**: Catch configuration drift before it causes failures

**Problem**: Documentation can drift from actual configuration. No automated way to detect when vercel.json doesn't match docs, or when env vars are missing.

**Fix**: Scheduled drift detection

```yaml
# .github/workflows/drift-detection.yml
name: Configuration Drift Detection
on:
  schedule:
    - cron: "0 0 * * *" # Daily
  workflow_dispatch:

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    steps:
      - name: Check Vercel config matches expected
        run: ./scripts/verify-deployment-config.sh

      - name: Validate documentation matches actual config
        run: ./scripts/validate-docs.sh

      - name: Check env vars exist in all environments
        run: |
          # Query Vercel API for env vars
          # Compare against infrastructure/vercel-env.ts
          # Fail if drift detected
```

**Effort**: 1 week | **Impact**: Proactive drift detection, prevent configuration issues
**Acceptance**: Daily drift detection runs, alerts on mismatches, clear remediation steps

---

## Later (Someday/Maybe, 6+ months)

- **[Reliability] Health deep flag strictness** — Parse `deep` query as `1` only and add edge-case tests (`?deep=0/false/true`); source: PR #7 comment https://github.com/misty-step/gitpulse/pull/7#issuecomment-3568633304
- **[Reliability] Tunable health timeouts** — Make deep health timeout configurable (env + docs) to align with tighter probe SLAs; source: PR #7 comment https://github.com/misty-step/gitpulse/pull/7#issuecomment-3568633304
- **[Platform] REST API + Developer Docs** - Programmatic access, enterprise requirement
- **[Platform] Plugin System** - User-extensible commands, differentiation play
- **[Differentiation] AI-Powered Code Review Summaries** - Analyze diffs, auto-categorize PRs, release notes
- **[Vertical] Open Source Maintainer Tools** - Contributor leaderboards, community health
- **[Scale] Map-Reduce Batching Pipeline** - When users exceed 20k events/week
- **[Scale] Merkle Trees & Coverage Receipts** - Cryptographic proof for compliance

---

## Learnings

**From this grooming session:**

**Observability Insights (Added 2025-11-20):**

- **CRITICAL gap**: Zero production error tracking (no Sentry), zero analytics (no Vercel Analytics), zero health checks
- **121 console.\* calls** across codebase with no structured logging, PII redaction, or log levels
- **Primitive metrics.ts wrapper** (23 lines, console.log only) - need Pino with correlation IDs
- **Error boundary exists** but only logs to console - no Sentry integration
- **No deployment tracking** - cannot correlate error spikes to releases
- **No APM** - cannot identify slow endpoints, database bottlenecks, or client-side latency
- **No infrastructure alerting** - production issues detected manually or via user reports
- **Quick wins**: Enable Vercel Analytics (2h), add health checks (2h), PII redaction (1h)
- **Foundation for scale**: Observability infrastructure must precede team growth (cannot debug distributed issues without structured logging + tracing)
- **Cost optimization**: Free tiers available (Sentry 5k errors/month, Vercel Analytics included, Grafana Cloud 10k series)
- **Privacy compliance**: PII redaction required for GDPR Article 32 (current logging unsafe)

**Quality Infrastructure Insights (Added 2025-11-20):**

- **CRITICAL gap**: Zero CI/CD pipeline, no pre-commit hooks, **broken build command** (missing `npx convex deploy`)
- **Build risk**: `package.json` only runs `next build` → production failures inevitable (Convex types not generated)
- **Test coverage**: 12 files, 76 tests on backend logic but 0% auth coverage (Clerk untested), no coverage tracking configured
- **Security**: No Gitleaks, no Dependabot, no `pnpm audit` in CI, 121 console.\* calls with PII risk
- **Good foundation**: Tests focus on business logic (LLM, reports, coverage math), not just shallow UI tests
- **Lint discipline**: Only 2 `eslint-disable` comments across entire codebase (not abused ✅)
- **Secrets management**: Proper .gitignore, no `NEXT_PUBLIC_` misuse for secrets, env vars correctly scoped
- **Quick wins**: Fix build (5m), Lefthook (2h), CI pipeline (1.5h), Gitleaks (30m) = **4h total**
- **Philosophy**: "Are we testing the right things?" → Yes on business logic, no on critical paths (auth = 0% coverage)
- **Meta-question answer**: Quality gates missing entirely - not testing wrong things, just not enforcing tests at all
- **Why Lefthook**: 3-5x faster than Husky (parallel execution, Go-based), performance budget: <5s pre-commit, <15s pre-push
- **Coverage philosophy**: Google research 60% acceptable, 75% commendable, 90% exemplary - focus on delta not absolute
- **CI/CD gap**: 3 workflows exist (enforce-pnpm, claude, claude-code-review) but none run typecheck/lint/test/build
- **Changesets rationale**: Best for apps (vs semantic-release for libraries), automated changelog + version bumps

**Deployment Infrastructure Insights (Added 2025-11-22):**

- **Root cause of Vercel failure**: `vercel.json` buildCommand was `pnpm build` instead of `npx convex deploy --cmd 'pnpm build'`
- **Why it matters**: Without Convex wrapping the build, `NEXT_PUBLIC_CONVEX_URL` never gets injected, causing deployment to fail
- **Documentation drift**: Docs correctly described `npx convex deploy --cmd 'pnpm build'` but actual config didn't match
- **Quality gate gap**: Pre-push hooks don't run build verification - could push code that won't deploy
- **Configuration sprawl**: 6 different sources of env var configuration (local, Convex dev/prod/defaults, Vercel prod/preview)
- **Shallow module anti-pattern**: Build command defined in 3 places (package.json, vercel.json, docs) with no single source of truth
- **CLI automation limits**: Convex CLI can't set default env vars or generate deploy keys (dashboard only) - hybrid approach required
- **Quick fixes**: Fix vercel.json (5m), add build to pre-push (30m), create verification script (2h)
- **Strategic fixes**: Deployment service module (2w), Infrastructure as Code for env vars (1w), staging environment (1w)
- **Ousterhout violations**: Information leakage (env vars spread across 6 places), shallow modules (build definitions everywhere), obscurity (no config validation)
- **Key learning**: "Can we deploy this?" should be answered before merge, not in production Vercel logs
- **Prevention strategy**: Deployment config integration tests + drift detection + staging environment + build verification in pre-push

**Architecture Insights:**

- Codebase has excellent deep module design (Canonical Fact Service, Report Orchestrator) but lacks production infrastructure
- Content-addressed architecture prevents duplicate work - this is a strategic strength, preserve it
- Temporal decomposition in `reportOrchestrator.ts` is main complexity issue - extract stages before adding features

**Business Model Insights:**

- Current backlog optimized for scale (10k+ events) when MVP needs business viability (revenue, teams, distribution)
- Missing table-stakes B2B features (team collaboration, Slack) blocks team adoption
- No payment infrastructure = $0 revenue with 100% feature-complete product
- 80/20 rule: Team tier (collaboration + distribution) drives 80% of revenue potential

**Performance Insights:**

- N+1 queries in ingestion (14s → 50ms fix) and unbounded `.collect()` calls (5s → 10ms fix) are low-hanging fruit
- Performance issues are user-facing (slow dashboards, slow ingestion) not speculative
- Fix performance bottlenecks before scale optimizations (map-reduce)

**Security Insights:**

- Strong foundation (Clerk auth, Convex type-safety) but missing access control checks
- XSS in report rendering is HIGH severity but easy fix (1h with DOMPurify)
- Secret management is correct (gitignored .env files, no tracked secrets)

**UX/Product Insights:**

- Backend errors lack user-friendly translations (70+ throw statements with jargon)
- Distribution is key gap - reports trapped in web app, need Slack/email
- Users want interactive analytics, not just static reports (LinearB/Jellyfish competitive gap)

**Design System Insights:**

- Intentional "Luminous Precision" aesthetic (not generic AI) - monochrome + pulse red
- Tailwind 4 @theme foundation is excellent but 47 hardcoded colors bypass it
- Component architecture is solid (deep modules) with one acceptable shallow module (ThemeToggle)

**Strategic Recommendation:**

- Phase 1 (2 weeks): Infrastructure + security + critical performance (production-ready)
- Phase 2 (7 weeks): Payments + Slack + teams + exports (revenue-generating SaaS)
- Phase 3 (3 months): Analytics dashboard + alerts + templates (competitive differentiation)
- Defer: Scale optimizations (map-reduce, Merkle trees) until user growth demands them

---

**Backlog Health Check:**

- ✅ Forward-only (no completed/archived section)
- ✅ Ruthlessly curated (every item has business justification)
- ✅ Time-organized (detail matches proximity: rich Now, light Later)
- ✅ Value-first (business case for features, velocity case for technical work)
- ✅ 80/20 applied (emphasis on high-leverage items: payments, Slack, teams)
- ✅ Principle traceability (each issue links to violated principles or opportunity)
- ✅ Cross-validation (multi-agent issues surfaced: XSS, N+1, hardcoded colors)
- ✅ Strategic mix (critical fixes + velocity unlocks + revenue drivers + differentiation)

**Next Grooming:** Q1 2026 or when strategic priorities shift (new funding, team growth, competitive pressure)
