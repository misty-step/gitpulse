# BACKLOG

Last groomed: 2025-12-13
Analyzed by: 15 perspectives (8 domain specialists + 7 master personas) via Opus direct analysis + Gemini competitive intelligence + external consultant audit
**Architectural Audit**: 2025-12-09 — Council score 7.6/10, verdict: KEEP
**Consultant Audit**: 2025-12-13 — Full codebase review, risk register, GTM analysis

**Strategic Context**: GitPulse occupies a unique "High-Trust Niche" - combining the *automation* of standup assistants (Spinach/Standuply) with the *rigor* of enterprise platforms (LinearB/Waydev). Citation-backed reporting directly addresses the #1 user complaint: **distrust of AI-generated content**.

---

## Now (Sprint-Ready, <2 weeks)

### [PRODUCT] see reports by day, by week, *and* by repo or by org
- sometimes i want to see my activity for the day
- sometimes i want to see my activity for the week
- sometimes i want to see my activity for a specific repo or set of repos across an arbitrary time period
- sometimes i want to see my activity for a specific org across an arbitrary time period
- we should support all of these flows
** this maybe speaks to a need to define and design around our core primitives -- in this case, the github event
** all of these actions -- reports with various filters / contexts, essentially -- are just llm-enhanced operations on these primitives

### [Performance] N+1 Query in KPI Calculations
**File**: `convex/kpis.ts:46-52`
**Perspectives**: performance-pathfinder, ousterhout, fowler, carmack
**Impact**: getUserKPIsInternal fetches ALL events then filters in JS. O(n) full table scan for every KPI query.
**Fix**: Use Convex index range filtering before `.collect()`:
```typescript
// Current: Fetches all, filters in JS (BAD)
const allEvents = await ctx.db.query("events")
  .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id))
  .collect();
const eventsInRange = allEvents.filter(e => e.ts >= startDate && e.ts <= endDate);

// Fixed: Filter in query (GOOD)
const eventsInRange = await ctx.db.query("events")
  .withIndex("by_actor_and_ts", (q) =>
    q.eq("actorId", user._id).gte("ts", startDate).lte("ts", endDate)
  )
  .collect();
```
**Effort**: 30m | **Risk**: LOW | **Speedup**: 10-100x for active users
**Acceptance**: KPI queries use index filtering, no JS post-filter on timestamps

---

### [Bug] Event Type Mismatch - Reviews Show Zero
**File**: `convex/kpis.ts:58` vs `convex/lib/canonicalizeEvent.ts:4-11`
**Perspectives**: maintainability-maven, fowler, beck
**Impact**: KPIs filter for `type === "review"` but canonicalizer produces `"review_submitted"`. **Review KPIs will always show 0.**
**Fix**: Align event type string: `"review"` → `"review_submitted"`
**Effort**: 15m | **Risk**: LOW
**Acceptance**: Review KPIs populate correctly, event types are consistent

---

### [Performance] N+1 Mutation Loop in ingestRepo
**File**: `convex/actions/ingestRepo.ts:82-137`
**Perspectives**: performance-pathfinder, carmack, torvalds
**Impact**: Sequential mutations in loops - one roundtrip per PR, per review, per commit. 100 PRs × 5 reviews = 600 sequential mutations (14s → 50ms potential).
**Fix**: Batch mutations using `Promise.all` with deduplication:
```typescript
// Collect all actors, dedupe, batch upsert
const allActors = [...prs.map(pr => pr.user), ...reviews.flatMap(r => r.user)];
const uniqueActors = [...new Map(allActors.map(a => [a.id, a])).values()];
const actorMap = new Map(await Promise.all(uniqueActors.map(async actor =>
  [actor.id, await ctx.runMutation(api.users.upsert, {...})]
)));
```
**Effort**: 2h | **Risk**: MEDIUM | **Speedup**: 280x ingestion speed
**Acceptance**: Ingestion uses batched mutations, no sequential loops

---

### [Infrastructure] Missing Lefthook Configuration
**File**: `lefthook.yml` (missing - package installed but never configured)
**Perspectives**: architecture-guardian, beck
**Impact**: No pre-commit quality gates - lint/typecheck run only in CI (after push)
**Fix**: Create lefthook.yml:
```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: pnpm lint --fix
    typecheck:
      run: pnpm typecheck
```
**Effort**: 30m | **Risk**: LOW
**Acceptance**: `lefthook install` runs, pre-commit checks fire on commit

---

### [Security] Console.log Statements in Production
**Files**: 18 occurrences across 10 files (lib/errors.ts, AuthLoadingBoundary.tsx, etc.)
**Perspectives**: security-sentinel, maintainability-maven
**Impact**: Can leak sensitive data in production logs; Pino already installed but not used everywhere
**Fix**: Replace with `logger.info/warn/error` or remove
**Effort**: 1h | **Risk**: LOW
**Acceptance**: No console.log in production code, use structured logger

---

### [Testing] Coverage Thresholds Below Target
**File**: `jest.config.cjs:35-40`
**Perspectives**: beck, architecture-guardian
**Impact**: Global thresholds at 60% but CLAUDE.md targets 80% patch coverage. CI doesn't enforce patch coverage.
**Fix**: Add coverage report to PR comments, enforce 80% patch threshold
**Effort**: 2h | **Risk**: LOW
**Acceptance**: PR coverage comments enabled, patch threshold enforced

---

### [UX] Report Loading State Lacks Skeleton
**File**: `app/dashboard/reports/[id]/page.tsx:168-173`
**Perspectives**: user-experience-advocate, jobs
**Impact**: "Loading report..." text feels janky vs skeleton shimmer (other pages use skeletons)
**Fix**: Use existing `<Skeleton>` components for report loading state
**Effort**: 30m | **Risk**: LOW
**Acceptance**: Report page shows skeleton during load, matches other pages

---

### [Architecture P0] Split canonicalizeEvent.ts — 1,159 lines
**File**: `convex/lib/canonicalizeEvent.ts`
**Perspectives**: ousterhout (8/10), grug (7/10), fowler (7/10)
**Impact**: Giant switch dispatcher with 7 branches × 100+ lines inline. Largest file in codebase, complexity debt accumulating.
**Fix**: Extract to separate files:
```
convex/lib/canonicalizeEvent/
├── index.ts          # Router only (50 lines)
├── pullRequest.ts    # Pure normalizer
├── issue.ts
├── commit.ts
├── review.ts
└── timeline.ts
```
**Effort**: 4h | **Risk**: LOW | **Benefit**: Each file <200 lines; changes isolated; easier to test
**Acceptance**: Each normalizer file <200 LOC, main router <100 LOC, all tests pass

---

### [Architecture P0] Fix LLMClient Abstraction Violation
**File**: `convex/lib/generateReport.ts:192-228`
**Perspectives**: ousterhout (8/10), metz (7/10)
**Impact**: Implements own `callGemini()` instead of using `LLMClient.ts`. Two places to update if Gemini API changes. LLMClient's fallback logic and provider abstraction are unused.
**Fix**: Replace direct Gemini call with LLMClient:
```typescript
const client = new LLMClient({ provider: "google", model: "gemini-2.5-flash" });
const result = await client.generate({ systemPrompt, userPrompt });
```
**Effort**: 1h | **Risk**: LOW | **Benefit**: Single source of truth for LLM logic; easier to add fallback providers
**Acceptance**: generateReport.ts uses LLMClient, no direct fetch to Gemini API

---

### [Reliability] Integration Status Index Migration
**File**: `convex/integrations.ts:38`
**Perspectives**: consultant audit (Risk 5), maintainability-maven
**Impact**: Uses deprecated `by_clerkUserId` index. Status logic may diverge from reality.
**Fix**: Query `userInstallations` table as canonical source:
```typescript
// Current: Deprecated index
const installations = await ctx.db
  .query("installations")
  .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
  .collect();

// Fixed: Use canonical userInstallations table
const userInstalls = await ctx.db
  .query("userInstallations")
  .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
  .collect();
const installationIds = userInstalls.map(ui => ui.installationId);
```
**Effort**: 1h | **Risk**: LOW | **Benefit**: Single source of truth for installation mapping
**Acceptance**: integrations.ts queries userInstallations, no deprecated index usage

---

### [UX] Coverage Meter + Trust Warning
**File**: `app/dashboard/reports/[id]/page.tsx`
**Perspectives**: consultant audit, user-experience-advocate, product-visionary
**Impact**: Coverage score exists but not surfaced. Users can't tell if report is trustworthy.
**Fix**: Display coverage meter; if < 0.7, show warning + "Sync now" CTA
**Effort**: 2h | **Risk**: LOW | **Strategic Value**: HIGH (trust differentiation)
**Acceptance**: Report page shows coverage meter, warning shown below threshold

---

### [Security] Reduce OAuth Scopes
**File**: `app/api/auth/github/route.ts`
**Perspectives**: consultant audit (Risk 3), security-sentinel
**Impact**: Current scopes `repo,user,read:org` are broad. Spooks users, fails security reviews.
**Fix**: Reduce to minimum: `repo` for private access, `read:user` for identity
```typescript
// Current
scope: "repo,user,read:org"

// Fixed
scope: "repo,read:user"
```
**Effort**: 30m | **Risk**: LOW | **Benefit**: Higher conversion, easier security reviews
**Acceptance**: OAuth scope minimized, no user-facing functionality lost

---

### [Reliability] Non-hourly Timezone Support for Weekly Reports
**File**: `convex/actions/runWeeklyReports.ts:59`
**Perspectives**: Codex PR review (P1)
**Impact**: Users in half-hour offset timezones (Asia/Kolkata UTC+05:30, Nepal UTC+05:45, etc.) may miss weekly reports. Current cron runs on the hour, but midnight for these timezones occurs at :30 or :45.
**Options**:
1. Expand cron to every 30 minutes (336 jobs vs 168)
2. Round `midnightUtcHour` to nearest hour, accept ±30min error
3. Store minute offset in user preferences
**Effort**: 2h | **Risk**: LOW | **Impact**: ~1.5B people in affected timezones
**Acceptance**: Users in half-hour offset timezones receive weekly reports on local Sunday

---

### [Observability] Log Warning for Invalid Timezone Fallback
**File**: `convex/lib/timeWindows.ts:313-318`
**Perspectives**: CodeRabbit PR review
**Impact**: `getTimezoneOrDefault()` silently falls back to UTC for invalid timezones. Users with invalid TZ data get UTC-based scheduling without warning.
**Fix**: Add structured log warning when falling back
**Effort**: 15m | **Risk**: LOW

---

### [API Hygiene] Deprecate getUsersByWeeklySchedule Export
**File**: `convex/users.ts:571`
**Perspectives**: CodeRabbit PR review
**Impact**: Old query still exported but unused at runtime. Could confuse future developers.
**Fix**: Add `@deprecated` JSDoc or remove export
**Effort**: 10m | **Risk**: LOW

---

### [Reliability] Runtime clerkId Validation Before Report Generation
**File**: `convex/actions/runWeeklyReports.ts:108`
**Perspectives**: CodeRabbit PR review
**Impact**: Uses `!` assertion without runtime check. DB constraints should prevent null, but defense-in-depth.
**Fix**: Add `.filter(u => u.clerkId != null)` before processing
**Effort**: 10m | **Risk**: LOW

---

### Kill List (after TODO.md Phase 4 complete)

Delete once SyncService is wired to all callers:
- `convex/lib/githubIngestionService.ts` — old ingestion service
- `convex/lib/continuousSync.ts` — old continuous sync
- Legacy backfill paths in `convex/actions/github/startBackfill.ts`
- Deprecated schema fields: `reportHourUTC`, `weeklyDayUTC`, `by_weeklySchedule` index

---

## Next (This Quarter, <3 months)

### [Product] Interactive Citation Drawer (Competitive Moat)
**File**: `components/CitationDrawer.tsx`
**Perspectives**: product-visionary, jobs, user-experience-advocate, Gemini competitive analysis
**Why**: Gemini analysis confirms citation prominence is GitPulse's moat vs competitors. "No other tool offers this level of auditability for AI text."
**Approach**:
- Show code diff preview inline when clicking citation
- Link to specific lines changed
- Group citations by category (PR, commit, review)
- Add "Copy citation" button
**Effort**: 8h | **Strategic Value**: HIGH (competitive differentiation)

---

### [Product] "Invisible Work" Report Mode
**Perspectives**: product-visionary (from Gemini competitive analysis)
**Why**: Developers complain metrics ignore complex debugging, research, PR reviews
**Approach**:
- Highlight PR reviews, issue discussions, complex refactors
- Treat `deletions` as positive ("debt reduction")
- Tune prompts for "Maintenance Hero" narrative
**Effort**: 4h | **Strategic Value**: HIGH (developer advocacy angle, attacks "manager surveillance" perception)

---

### [Product] Context-Aware Activity Grouping
**Perspectives**: product-visionary, Gemini competitive analysis
**Why**: "I did X, Y, Z" lists are boring. Semantic clustering adds intelligence.
**Approach**: Group standups by Intent (Feature/Fix/Chore) using Voyage AI embeddings already in place
**Effort**: 4h | **Strategic Value**: MEDIUM

---

### [Performance] Report Streaming
**Perspectives**: performance-pathfinder, user-experience-advocate
**Why**: Current reports wait for full LLM response (up to 60s). Competitors batch-process. GitPulse can leverage edge for real-time feel.
**Approach**: Use Gemini streaming API, render report progressively
**Effort**: 8h | **Impact**: Perceived latency from 60s to <5s

---

### [Architecture] Extract Report Orchestrator Stages
**File**: `convex/lib/reportOrchestrator.ts` (371 lines)
**Perspectives**: ousterhout, complexity-archaeologist, fowler
**Why**: Single file handles context building, LLM calls, caching, validation, metrics - too many responsibilities.
**Approach**: Extract to 4 focused modules:
- `reportContext.ts` - context assembly
- `reportCache.ts` - cache key + lookup
- `reportValidator.ts` - coverage validation
- `reportOrchestrator.ts` - coordination only
**Effort**: 4h | **Impact**: Improved testability, clearer boundaries

---

### [Security] Token Encryption at Rest
**File**: `convex/schema.ts:25-27` (githubAccessToken, githubRefreshToken)
**Perspectives**: security-sentinel
**Why**: OAuth tokens stored plaintext in Convex. Defense-in-depth requires encryption.
**Approach**: Encrypt with Convex-managed key before storage, decrypt on use
**Effort**: 4h | **Risk**: MEDIUM (key management complexity)

---

### [Infrastructure] E2E Test Coverage for Critical Paths
**Perspectives**: beck, architecture-guardian
**Why**: 39 unit tests but minimal E2E. Auth flow, report generation, webhook processing need E2E.
**Approach**: Add Playwright tests for:
- OAuth flow completion
- Report generation + citation verification
- Dashboard data loading
**Effort**: 8h | **Impact**: Deployment confidence ("Friday afternoon deploy with phone off")

---

### [MONETIZATION] Stripe Payment Infrastructure
**Scope**: Subscription management, usage limits, plan upgrade flows
**Perspectives**: product-visionary (CRITICAL for business viability), consultant audit
**Business Case**: With 1000 free users, 10% conversion = 100 Pro users × $15 = **$1500 MRR**
**Pricing Tiers** (validated by consultant analysis against LinearB/Waydev benchmarks):
- Free: 1 user, 3 repos, daily reports only
- Pro ($15/mo): Unlimited repos, daily+weekly, Slack+email
- Team ($40/user/mo): Everything + team dashboards, workspaces
**Effort**: 2 weeks | **Impact**: Creates revenue stream (currently $0)
**Consultant note**: Per-seat pricing aligns with competitor norms; consider usage-based add-on for heavy LLM users later

---

### [DISTRIBUTION] Slack Integration
**Scope**: Slack bot posts reports to channels, slash commands
**Perspectives**: product-visionary (CRITICAL for retention), consultant audit
**Why**: Users who receive Slack reports have 5x higher retention. Reports trapped in web app = low engagement.
**Consultant note**: Primary retention driver; creates daily habit + viral loop (report posted -> teammates click -> new installs)
**Effort**: 1 week | **Impact**: 5x retention lift, viral growth

---

### [COLLABORATION] Team Workspaces
**Scope**: Shared workspaces, team dashboards, permissions
**Perspectives**: product-visionary (CRITICAL for B2B revenue)
**Why**: Table-stakes for B2B sales. $40/user/month for 10-person team = $400/mo vs $15 individual.
**Effort**: 2 weeks | **Impact**: Foundation for B2B revenue

---

### [Architecture P1] Consolidate Cron Jobs — 192 → Fan-Out
**File**: `convex/crons.ts`
**Perspectives**: grug (7/10), carmack (8/10)
**Impact**: 24 daily + 168 weekly cron jobs (one per UTC hour/day). Convex soft limit ~500 concurrent; at 50% utilization.
**Fix**: Single daily cron that queries users by `midnightUtcHour` and fans out
**Effort**: 3h | **Risk**: MEDIUM | **Benefit**: Simpler cron management, room to grow
**Acceptance**: Single daily cron, single weekly cron, fan-out queries

---

### [Architecture P1] Extract BackfillContext Object
**File**: `convex/actions/github/startBackfill.ts:27-37`
**Perspectives**: fowler (7/10), ousterhout (8/10)
**Impact**: `BackfillInternalArgs` has 9 parameters (3 required, 6 optional). Hard to extend, callers must understand state machine.
**Fix**: Wrap in `BackfillContext { installation, repos, window, state }` object
**Effort**: 2h | **Risk**: LOW | **Benefit**: Cleaner interface, easier to extend
**Acceptance**: Parameters grouped into context object, callers simplified

---

### [Architecture P2] Event-Driven Embedding Trigger
**File**: `convex/crons.ts` (embedding queue polling)
**Perspectives**: carmack (8/10), performance-pathfinder
**Impact**: 5-minute cron interval for embedding processing. 1000 pending events × 5min wait = backlog spike.
**Fix**: Trigger embedding batch when sync completes (event-driven)
**Effort**: 4h | **Risk**: MEDIUM | **Benefit**: Near-instant embedding after sync
**Acceptance**: Embeddings generated within 30s of sync completion

---

### [Architecture P2] Extract Actor/Repo Normalization
**File**: `convex/lib/canonicalizeEvent.ts` (5 instances)
**Perspectives**: metz (7/10), fowler (7/10)
**Impact**: Actor/repo normalization repeated 5x with slightly different field fallback chains. Inconsistent, hard to maintain.
**Fix**: Extract `selectActor(candidates)` and `normalizeRepo(payload)` pure functions
**Effort**: 2h | **Risk**: LOW | **Benefit**: Single source of truth for normalization
**Acceptance**: Single normalizeActor(), single normalizeRepo() used everywhere

---

### [Architecture P2] Remove Deprecated Schema Fields
**File**: `convex/schema.ts:57-77`
**Perspectives**: maintainability-maven, ousterhout (8/10)
**Impact**: `reportHourUTC`, `weeklyDayUTC`, `weeklySchedule` index marked DEPRECATED but still in schema.
**Fix**: Backfill migration to remove fields and indexes
**Effort**: 2h | **Risk**: LOW | **Benefit**: Cleaner schema, less confusion
**Acceptance**: Deprecated fields removed, indexes dropped, migration verified

---

## Soon (Exploring, 3-6 months)

- **[Product] Personal-Only Insights Dashboard** - Private productivity patterns for ICs (anti-surveillance positioning per Gemini)
- **[Product] Semantic Activity Search** - "When did we last touch auth?" using Voyage embeddings
- **[Product] Hallucination-Proof Mode** - Interactive citation drawer showing exact code lines that support claims
- **[Distribution] Email Delivery** - Daily/weekly digest emails, SMTP integration
- **[Distribution] Export Functionality** - PDF, Markdown, CSV exports for offline/sharing
- **[Architecture] OpenTelemetry Integration** - Replace Pino + Sentry with unified observability
- **[Performance] Edge Caching for Reports** - Cache generated reports at edge
- **[Design] Migrate Hardcoded Colors to Semantic Tokens** - 47 instances bypass @theme system

---

## Later (Someday/Maybe, 6+ months)

- **[Platform] CLI Tool** - Generate reports from terminal
- **[Platform] REST API + Developer Docs** - Programmatic access, enterprise requirement
- **[Product] AI-Powered Code Review Summaries** - Analyze diffs, auto-categorize PRs
- **[Integration] Jira/Linear Linkage** - Connect issues to code activity
- **[Differentiation] GitHub Actions CI/CD** - Deployment tracking, DORA metrics
- **[Scale] Map-Reduce Batching** - When users exceed 20k events/week

---

## Competitive Intelligence (Gemini Analysis 2025-11-29)

**Market Position**: GitPulse occupies unique "High-Trust Niche"
- Enterprise tools (LinearB/Waydev/Jellyfish): Focus on DORA metrics, suffer "big brother" perception
- AI Assistants (Spinach/Standuply): Automation but shallow/hallucination-prone
- **GitPulse Advantage**: RAG + Citation Verification = "Proof of work" tool

**Key Competitor Moves (2025)**:
- LinearB: Launching "Model Context Protocol" for natural language queries
- Waydev: Rebranding as "AI-native" with "AI Coach"
- GitClear: Positioning against AI, publishing anti-AI research

**Strategic Recommendations**:
1. Double down on citations - this is the moat
2. Attack the "Black Box" - market transparency vs competitors
3. Leverage content addressing for "Zero Duplication" reports

---

## Learnings

**From architectural audit (2025-12-09):**

- **Council verdict: KEEP** — 7.6/10 average score from 7 master perspectives
- **Deep modules working** — syncPolicy.ts, syncService.ts, canonicalFactService.ts, githubApp.ts exemplify Ousterhout's principles
- **canonicalizeEvent.ts complexity debt** — 1,159 lines, largest file in codebase, needs extraction into router + normalizers
- **LLMClient abstraction violation** — generateReport.ts bypasses existing abstraction, duplicates Gemini call logic
- **Cron job explosion** — 192 jobs approaching 50% of Convex soft limit, needs fan-out consolidation
- **Scaling path clear** — production-ready for 0-100k events, add vector DB at 500k, consider Postgres+Bull at 1M

**From grooming session (2025-11-29):**

- **Event type mismatch** - `"review"` vs `"review_submitted"` causes silent data gaps in KPIs. Quick fix, high impact.
- **KPI query O(n)** - Convex indexes support range filtering but code fetches full table. 10-100x speedup available.
- **Console.log leakage** - 18 occurrences despite Pino installed. Need lint rule to enforce.
- **Lefthook gap** - Package installed but config file never created.

**Cross-validation signals (15 perspectives converged):**
- **Performance + Ousterhout + Carmack** → N+1 patterns as critical
- **Security + Maintainability** → Console.log cleanup
- **Product + Jobs + UX** → Citation drawer as high-value enhancement
- **Beck + Architecture-guardian** → Test infrastructure gaps
- **Grug + Carmack + Jobs** → Report orchestrator needs simplification

**Competitive insight** (Gemini):
- Citation is the moat - no competitor offers citation-backed AI reports
- "Invisible Work" mode addresses developer advocacy gap
- Personal-only insights avoid surveillance optics

**From consultant audit (2025-12-13):**

- **Dual ingestion confirmed** — `syncJobs/syncBatches` + `ingestionJobs` both active. TODO.md SyncService overhaul addresses this.
- **Weekly cron legacy** — Uses deprecated `weeklyDayUTC + reportHourUTC` schedule fields. Migration to `midnightUtcHour` added to Now.
- **Integration status deprecated index** — `by_clerkUserId` still in use, should migrate to `userInstallations`. Added to Now.
- **Path A chosen** — Commit-first ingestion strategy; PR/review ingestion deferred until commit loop stable. See STRATEGY.md.
- **Trust is the moat** — Citation-backed reporting differentiates from competitors; double down on coverage scoring.
- **OAuth scope drag** — Broad scopes (`repo,user,read:org`) hurt adoption; minimize to `repo,read:user`.
- **Kill list codified** — Legacy ingestion files queued for deletion after SyncService Phase 4.

**Key risks (inline with relevant items):**
- Commit-only gap: Users may notice missing PR/review work → Label reports clearly until expanded
- LLM costs: Mitigated by existing caching + cacheKey design
- GitHub native summaries: Differentiate on trust + workflow integration

---

**Backlog Health Check:**
- Forward-only (no completed/archived section)
- Ruthlessly curated (business justification required)
- Time-organized (detail matches proximity)
- Value-first (business case for features, velocity case for technical)
- 80/20 applied (payments, Slack, citations as high-leverage)
- Cross-validation signals from 15 perspectives
- Strategic mix (fixes + velocity unlocks + revenue drivers + differentiation)

**Next Grooming:** Q1 2026 or when strategic priorities shift

**Related Docs:**
- `STRATEGY.md` — Positioning, north star metrics, ICP, pricing, GTM channels, moats
- `TODO.md` — Current sprint work (Sync Architecture Overhaul)
