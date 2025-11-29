# Test Coverage Infrastructure

## Executive Summary

Build comprehensive test coverage infrastructure for GitPulse with **GitHub Actions native** solution (zero cost), **Playwright E2E** framework, and **strict coverage enforcement** (80% patch, 70% overall). Deliver deploy-on-Friday confidence through systematic testing of critical paths: webhook security, event canonicalization, report generation, and core user journeys.

**User Value:** Prevent production incidents, enable confident deploys, eliminate manual QA overhead, provide instant PR feedback on code quality.

**Success Criteria:**
- ✅ Coverage visible in every PR (comment + badge)
- ✅ Build fails if patch coverage < 80%
- ✅ 3 critical E2E flows passing (auth, webhook, report)
- ✅ P0 + P1 critical paths tested (20+ new test files)

## User Context

**Who Uses This:**
- **Developers** - Need instant feedback on test coverage in PRs, catch regressions before merge
- **Project Maintainers** - Require confidence in deploy safety, visibility into code quality trends
- **Future Contributors** - Understand testing patterns, see coverage gaps to prioritize

**Problems Being Solved:**
1. **Blind Deployments** - Currently no automated testing of critical flows (webhooks, auth, reports)
2. **Regression Risk** - Changes to event canonicalization or content hashing could silently corrupt data
3. **Coverage Invisibility** - Coverage runs locally but isn't tracked, compared, or enforced
4. **Manual QA Overhead** - Every PR requires manual testing of user journeys

**Measurable Benefits:**
- **Deploy Confidence:** Ship to production Friday 5pm without fear
- **Incident Prevention:** Catch security issues (webhook signature bypass) before production
- **Development Velocity:** Refactor with confidence, no manual regression testing
- **Code Quality:** Enforce 80%+ coverage on new code, prevent quality decay

## Requirements

### Functional Requirements

**FR1: Coverage Reporting**
- Generate coverage reports in CI/CD for every PR and push
- Display overall coverage (lines, branches, functions, statements)
- Calculate patch coverage (new code only) separately from total coverage
- Support filtering coverage by path (`convex/lib/`, `app/`, `components/`)

**FR2: PR Coverage Comments**
- Post coverage summary as PR comment (overall + patch coverage)
- Show file-level breakdown for changed files only
- Include visual indicators (🟢 passing thresholds, 🔴 below thresholds)
- Update existing comment on new pushes (no spam)

**FR3: README Coverage Badges**
- Dynamic SVG badge showing current coverage percentage
- Badge updates automatically on merge to master
- Clickable badge linking to detailed coverage report (GitHub Actions artifact)

**FR4: Coverage Enforcement**
- **Fail CI** if patch coverage < 80% (new code)
- **Fail CI** if overall coverage drops > 1% from base branch
- **Pass CI** if overall coverage ≥ 70% (informational threshold)

**FR5: E2E Testing Framework**
- Playwright installed and configured for Next.js 16 + React 19
- Test runner integrated with pnpm scripts (`pnpm test:e2e`)
- Tests run in CI/CD on every PR (chromium only for speed)
- Screenshots/videos on failure for debugging

**FR6: E2E Critical Flows (Minimum Viable)**
- **Auth Flow:** Sign in with GitHub → OAuth callback → Dashboard load
- **Webhook Flow:** GitHub sends webhook → Signature verification → Event processing
- **Report Flow:** Generate report → LLM processing → Citation rendering

**FR7: Unit/Integration Test Expansion (P0 + P1)**
- **P0 Tests (Critical Security/Data Integrity):**
  - Webhook signature verification (`/api/webhooks/github`)
  - Event canonicalization (`convex/lib/canonicalizeEvent.ts`)
  - Content hash determinism (`convex/lib/contentHash.ts`)
  - Webhook processing action (`convex/actions/github/processWebhook.ts`)

- **P1 Tests (Core Business Logic):**
  - GitHub backfill orchestration (`convex/actions/github/startBackfill.ts`)
  - Report generation pipeline (`convex/lib/reportGenerator.ts`)
  - LLM fallback logic (`convex/lib/llmOrchestrator.ts`)
  - GitHub API client (`convex/lib/GitHubClient.ts`)

### Non-Functional Requirements

**Performance:**
- Coverage report generation completes in < 30 seconds (part of existing test run)
- E2E tests complete in < 5 minutes for critical flows
- PR comment posted within 60 seconds of test completion

**Security:**
- No coverage data uploaded to external services (privacy)
- GitHub Actions token permissions scoped minimally (pull-requests: write)
- E2E tests use mock auth tokens (no real GitHub credentials in CI)

**Reliability:**
- Coverage calculation deterministic (same code → same coverage)
- E2E tests isolated (no shared state, idempotent)
- Flaky test detection (retry logic, timeouts)

**Maintainability:**
- Test utilities centralized (`tests/utils/`, `tests/mocks/`)
- Clear patterns documented in existing `reportOrchestrator.test.ts` (857 lines)
- E2E page objects for reusable element selectors

## Architecture Decision

### Selected Approach: **GitHub Actions Native + Playwright E2E**

**Rationale:**
1. **User Value:** Zero cost for bootstrapped MVP, instant PR feedback, future-proof (easy Codecov migration)
2. **Simplicity:** Single GitHub Actions workflow, no external service configuration, fast setup
3. **Explicitness:** Coverage data stored as GitHub Actions artifacts (transparent, auditable)

### Module Boundaries

**Module 1: Coverage Collection Service**
- **Interface:** `collectCoverage()` → Coverage report (lcov, json-summary, html)
- **Responsibility:** Run Jest with coverage flags, generate multiple formats
- **Hidden Complexity:** Jest configuration, instrumentation overhead, path mapping for monorepos

**Module 2: Coverage Reporting Service**
- **Interface:** `reportCoverage(prNumber, coverageData)` → PR comment created/updated
- **Responsibility:** Format coverage data, post GitHub comment, compare to base branch
- **Hidden Complexity:** GitHub API authentication, comment deduplication, markdown formatting, delta calculation

**Module 3: Coverage Enforcement Service**
- **Interface:** `enforceCoverageThresholds(coverage, baseCoverage)` → Pass/Fail + reason
- **Responsibility:** Compare patch/overall coverage to thresholds, determine CI status
- **Hidden Complexity:** Threshold logic (absolute vs relative), exemption rules (test files, generated code)

**Module 4: E2E Testing Framework**
- **Interface:** `runE2ETests(environment)` → Test results + artifacts (screenshots, videos)
- **Responsibility:** Execute Playwright tests, capture failures, generate reports
- **Hidden Complexity:** Browser lifecycle, test isolation, mock service setup, authentication simulation

**Module 5: Badge Generation Service**
- **Interface:** `generateBadge(coverage)` → SVG badge + markdown snippet
- **Responsibility:** Create dynamic shields.io badge, update README
- **Hidden Complexity:** Badge URL construction, color thresholds (red/yellow/green), artifact linking

### Alternatives Considered

| Approach | User Value | Simplicity | Explicitness | Risk | Why Not Chosen |
|----------|------------|------------|--------------|------|----------------|
| **Codecov SaaS** | High (trends, analytics) | High (turnkey) | Medium (external service) | Low | $12/user/month cost, overkill for MVP |
| **GitHub Actions Native** ⭐ | High (free, fast) | High (one workflow) | High (artifacts) | Low | **SELECTED** |
| **Self-Hosted (artifact only)** | Medium (basic) | Medium (manual badges) | High (full control) | Medium | No PR comments, manual effort |
| **Coveralls** | Medium (trends) | High (turnkey) | Medium (external) | Low | $25/mo (10 repos), worse than Codecov |
| **Manual coverage only** | Low (local only) | High (no setup) | Low (invisible) | High | No enforcement, no visibility |

### Abstraction Layers

**Layer 1: CI/CD Orchestration** (GitHub Actions Workflow)
- Vocabulary: Jobs, steps, artifacts, secrets
- Concepts: Workflow triggers, matrix builds, caching
- Hides: Runner provisioning, environment setup, cleanup

**Layer 2: Coverage Tooling** (Jest + Coverage Reporters)
- Vocabulary: Coverage data, thresholds, reporters, instrumentation
- Concepts: Line/branch/function coverage, include/exclude patterns
- Hides: V8 coverage engine, source map resolution, file system traversal

**Layer 3: Test Execution** (Jest + Playwright)
- Vocabulary: Test suites, assertions, mocks, fixtures
- Concepts: Test isolation, lifecycle hooks, async handling
- Hides: Test discovery, module resolution, parallel execution

**Layer 4: Business Logic** (Application Code)
- Vocabulary: Events, reports, repositories, users
- Concepts: Webhooks, backfills, embeddings, citations
- Hides: GitHub API, Convex DB, LLM providers, vector search

## Test Scenarios

### Unit Test Scenarios (P0 + P1)

#### **P0-1: Webhook Signature Verification**
**File:** `app/api/webhooks/github/__tests__/route.test.ts`

1. ✅ **Valid HMAC-SHA256 signature** → Webhook accepted, payload enqueued
2. ❌ **Invalid signature** → 401 Unauthorized, payload rejected
3. ❌ **Missing X-Hub-Signature-256 header** → 400 Bad Request
4. ✅ **Dual-secret rotation** → Old OR new secret validates successfully
5. ❌ **Malformed JSON payload** → 400 Bad Request, error logged
6. ❌ **Missing X-GitHub-Event header** → 400 Bad Request
7. ✅ **Timing attack resistance** → Constant-time comparison
8. ❌ **Replay attack** → Same payload twice (future: nonce validation)

#### **P0-2: Event Canonicalization**
**File:** `convex/lib/__tests__/canonicalizeEvent.test.ts`

1. ✅ **Pull request opened** → EventFact with PR metadata, GitHub URL, actor, repo
2. ✅ **Pull request merged** → EventFact with merged_at timestamp, merge commit SHA
3. ✅ **Pull request closed (not merged)** → EventFact with closed_at, no merge commit
4. ✅ **Issue opened** → EventFact with issue metadata, labels
5. ✅ **Push event (commits)** → EventFact per commit with additions/deletions/changed_files
6. ✅ **Pull request review (approved)** → EventFact with review state, comments
7. ✅ **Installation created** → EventFact with installation ID, repositories
8. ❌ **Null/undefined fields** → Graceful handling, default values
9. ❌ **Missing required fields** → Validation error, logged
10. ✅ **URL normalization** → Various GitHub URL formats → canonical form
11. ✅ **Unicode in commit messages** → Preserved correctly in canonicalText
12. ✅ **Large payloads (10KB+)** → Processed without truncation

#### **P0-3: Content Hash Determinism**
**File:** `convex/lib/__tests__/contentHash.test.ts`

1. ✅ **Same input → same hash** → Idempotent hashing
2. ✅ **Different inputs → different hashes** → Collision resistance
3. ✅ **Object key ordering** → `{a: 1, b: 2}` === `{b: 2, a: 1}` (sorted keys)
4. ✅ **Null vs undefined** → Different hashes
5. ✅ **Empty string vs missing field** → Different hashes
6. ✅ **Unicode characters** → Handled correctly
7. ✅ **Large inputs (100KB+)** → Hash generated successfully
8. ✅ **Nested objects** → Deep equality check
9. ✅ **Array ordering** → `[1, 2]` !== `[2, 1]` (order matters)
10. ✅ **SHA-256 format** → 64-character hex string

#### **P0-4: Webhook Processing Action**
**File:** `convex/actions/github/__tests__/processWebhook.test.ts`

1. ✅ **Valid PR webhook** → Event canonicalized, persisted, user/repo upserted
2. ✅ **Duplicate event (same hash)** → Skipped, no DB write
3. ✅ **New event (unique hash)** → Persisted with contentHash index
4. ❌ **Repository not found** → Error logged, webhook envelope marked failed
5. ❌ **Malformed payload** → Error logged, DLQ (dead letter queue)
6. ✅ **Installation event** → Installation metadata updated
7. ✅ **Multiple events in single webhook** → All processed
8. ❌ **Rate limit hit (429)** → Exponential backoff, retry
9. ❌ **Network timeout** → Retry with backoff
10. ✅ **Unsupported event type** → Logged, ignored gracefully

#### **P1-1: GitHub Backfill Orchestration**
**File:** `convex/actions/github/__tests__/startBackfill.test.ts`

1. ✅ **Timeline pagination** → Cursor advances, all pages fetched
2. ✅ **Rate limit pause** → Job pauses when budget low, resumes when reset
3. ✅ **Progress tracking** → eventsIngested, totalEvents, percentComplete updated
4. ✅ **Event deduplication** → Existing events skipped via contentHash
5. ✅ **Completion detection** → Job marked `completed` when no more events
6. ❌ **Network failure mid-backfill** → Job resumes from last cursor
7. ❌ **Budget exhausted** → Job paused, scheduled for retry
8. ❌ **Concurrent backfill prevention** → Second backfill for same repo rejected
9. ✅ **Error recovery** → Failed API calls retried with exponential backoff
10. ✅ **Empty repository** → Job completes immediately (0 events)

#### **P1-2: Report Generation Pipeline**
**File:** `convex/lib/__tests__/reportGenerator.test.ts`

1. ✅ **Daily report generation** → Summary + highlights for 24h window
2. ✅ **Weekly report generation** → Summary + highlights for 7d window
3. ✅ **Citation extraction** → Markdown links `[text](https://github.com/...)` → Citation objects
4. ❌ **Invalid citation URLs** → Non-GitHub links filtered out, logged
5. ✅ **Markdown to HTML** → Proper heading/list/link rendering
6. ❌ **XSS in LLM output** → HTML sanitized (DOMPurify), scripts stripped
7. ❌ **Empty event list** → "No activity" message, no LLM call
8. ✅ **Coverage score calculation** → (citations / total events) * 100
9. ❌ **LLM timeout** → Fallback to cached report or error message
10. ✅ **Duplicate citations** → Deduplicated in final report

#### **P1-3: LLM Orchestrator**
**File:** `convex/lib/__tests__/llmOrchestrator.test.ts`

1. ✅ **Primary provider success (Gemini)** → Report generated, cost tracked
2. ✅ **Gemini failure → OpenAI fallback** → Report generated with secondary provider
3. ✅ **Both providers fail** → Error returned, logged with context
4. ✅ **Token budget enforcement** → Request rejected if exceeds budget
5. ✅ **Retry logic** → 3 retries with exponential backoff (1s, 2s, 4s)
6. ❌ **API key invalid** → Provider marked unavailable, fallback triggered
7. ❌ **Rate limit (429)** → Exponential backoff, retry after reset time
8. ✅ **Streaming response** → Chunks aggregated correctly
9. ✅ **Cost tracking** → tokens_used, cost_usd persisted
10. ❌ **Timeout (60s)** → Request aborted, fallback triggered

#### **P1-4: GitHub API Client**
**File:** `convex/lib/__tests__/GitHubClient.test.ts`

1. ✅ **API request construction** → Proper headers (User-Agent, Authorization, Accept)
2. ✅ **Rate limit header parsing** → X-RateLimit-Remaining, X-RateLimit-Reset extracted
3. ✅ **Exponential backoff retry** → 1s → 2s → 4s → 8s on 5xx errors
4. ❌ **404 Not Found** → Error thrown with context (repo, endpoint)
5. ❌ **403 Forbidden** → Rate limit check, error logged
6. ❌ **Network timeout** → Retry with backoff
7. ✅ **Response pagination** → Link header parsed, next page fetched
8. ✅ **Conditional requests** → ETag caching, 304 Not Modified handling
9. ❌ **Invalid JSON response** → Parse error logged, retry
10. ✅ **Token refresh** → Installation token renewed before expiry

### Integration Test Scenarios

#### **API Route End-to-End**
**File:** `app/api/webhooks/github/__tests__/integration.test.ts`

1. ✅ **Webhook POST → Verify → Enqueue → Process** → Event appears in DB
2. ✅ **OAuth callback → State validation → Token exchange → User creation** → User in DB
3. ✅ **Health check** → Returns auth status, DB connectivity, API health

### E2E Test Scenarios (Playwright)

#### **E2E-1: Authentication Flow**
**File:** `e2e/auth.spec.ts`

1. User visits `/` landing page
2. Clicks "Sign In with GitHub" button
3. **Mock:** GitHub OAuth authorization page → Auto-approve
4. **Mock:** OAuth callback with valid code → Token exchange
5. User redirected to `/dashboard`
6. Dashboard loads with user profile (name, avatar)
7. Session persists across page refresh

**Assertions:**
- ✅ User document created in Convex
- ✅ Clerk session active
- ✅ GitHub OAuth token stored

#### **E2E-2: Webhook Processing Flow**
**File:** `e2e/webhook.spec.ts`

1. **Setup:** User authenticated, repo added
2. **Trigger:** POST webhook to `/api/webhooks/github` (PR opened event)
3. **Verify:** Webhook signature validated
4. **Process:** Event canonicalized, persisted to DB
5. **UI:** Event appears in dashboard (if user online)
6. **Assert:** Event visible in events table with correct metadata

**Assertions:**
- ✅ Event in `events` table with correct contentHash
- ✅ User/repo upserted
- ✅ UI updates reactively (Convex subscription)

#### **E2E-3: Report Generation Flow**
**File:** `e2e/reports.spec.ts`

1. User navigates to `/dashboard/reports`
2. Clicks "Generate Report" button
3. Selects date range (last 7 days)
4. Enters GitHub usernames (comma-separated)
5. Clicks "Generate" → Loading state displayed
6. **Mock:** LLM returns report markdown with citations
7. Report rendered as HTML
8. Citations clickable, link to GitHub URLs
9. Coverage score displayed (e.g., "85% coverage")

**Assertions:**
- ✅ Report document created in Convex
- ✅ Citations extracted correctly
- ✅ Markdown → HTML conversion successful
- ✅ Coverage score calculated accurately

## Dependencies & Assumptions

### External Dependencies

**New Dependencies:**
- `@playwright/test` (^1.41.0) - E2E testing framework
- `ArtiomTr/jest-coverage-report-action@v2` - GitHub Actions coverage comment bot
- (Optional) `msw` (^2.0.0) - API mocking for E2E tests

**Existing Dependencies (No Changes):**
- `jest` (29) - Test runner
- `@testing-library/react` (16) - Component testing
- `ts-jest` (29) - TypeScript integration

### Assumptions

**Scale:**
- Solo developer or small team (2-3 devs)
- ~10 PRs per week
- Coverage reports < 50MB (GitHub Actions artifact size)

**Environment:**
- GitHub Actions available (free tier sufficient)
- Node.js 22.15+ in CI
- pnpm 9.0+ as package manager

**Integration:**
- Convex dev environment accessible in CI (for E2E tests)
- Mock auth tokens available (E2E_MOCK_AUTH_ENABLED)
- GitHub API rate limits not exceeded in CI

**Team:**
- Developers familiar with Jest testing patterns
- Playwright learning curve acceptable (3-5 hours onboarding)
- Test-first mindset (TDD encouraged but not required)

## Implementation Phases

### Phase 1: Coverage Infrastructure (MVP - Week 1)

**Goal:** Coverage visible in every PR, enforced thresholds

**Tasks:**
1. Update `jest.config.cjs` to generate `json-summary` reporter
2. Create `.github/workflows/coverage.yml`:
   - Run `pnpm test:coverage` on every PR
   - Use `ArtiomTr/jest-coverage-report-action@v2`
   - Enforce thresholds: 80% patch, 70% overall
3. Add coverage badge to `README.md` (shields.io dynamic badge)
4. Test on sample PR (create feature branch, verify comment + badge)

**Deliverables:**
- ✅ GitHub Actions workflow running
- ✅ PR coverage comments working
- ✅ README badge updating
- ✅ CI fails on coverage drop

**Acceptance Criteria:**
- Coverage comment appears within 60 seconds of test completion
- Badge shows accurate percentage (±1%)
- Build fails if patch coverage < 80%

### Phase 2: P0 Critical Tests (Week 1-2)

**Goal:** Security and data integrity paths tested

**Tasks:**
1. `app/api/webhooks/github/__tests__/route.test.ts` (8 scenarios)
2. `convex/lib/__tests__/canonicalizeEvent.test.ts` (12 scenarios)
3. `convex/lib/__tests__/contentHash.test.ts` (10 scenarios)
4. `convex/actions/github/__tests__/processWebhook.test.ts` (10 scenarios)

**Deliverables:**
- ✅ 40+ new test cases
- ✅ P0 files at 90%+ coverage
- ✅ Overall coverage jumps to ~65%

**Acceptance Criteria:**
- All P0 scenarios passing
- No regressions in existing tests
- Test execution time < 45 seconds

### Phase 3: E2E Framework Setup (Week 2)

**Goal:** Playwright installed, 3 critical flows passing

**Tasks:**
1. Install Playwright: `pnpm add -D @playwright/test`
2. Run `npx playwright install chromium`
3. Create `playwright.config.ts`:
   - Base URL: `http://localhost:3000`
   - Workers: 1 (CI), 4 (local)
   - Retries: 2 (CI), 0 (local)
4. Create `e2e/` directory structure
5. Implement E2E-1 (auth flow)
6. Implement E2E-2 (webhook flow)
7. Implement E2E-3 (report flow)
8. Add `test:e2e` script to `package.json`
9. Integrate in `.github/workflows/e2e.yml`

**Deliverables:**
- ✅ Playwright configured
- ✅ 3 E2E tests passing locally
- ✅ E2E tests running in CI

**Acceptance Criteria:**
- E2E tests complete in < 5 minutes
- Screenshots on failure saved as artifacts
- No flaky tests (3 consecutive runs pass)

### Phase 4: P1 Business Logic Tests (Week 2-3)

**Goal:** Core business logic tested, overall coverage > 70%

**Tasks:**
1. `convex/actions/github/__tests__/startBackfill.test.ts` (10 scenarios)
2. `convex/lib/__tests__/reportGenerator.test.ts` (10 scenarios)
3. `convex/lib/__tests__/llmOrchestrator.test.ts` (10 scenarios)
4. `convex/lib/__tests__/GitHubClient.test.ts` (10 scenarios)

**Deliverables:**
- ✅ 40+ new test cases (P1)
- ✅ Overall coverage ≥ 70%
- ✅ Patch coverage enforced at 80%

**Acceptance Criteria:**
- All P1 scenarios passing
- Overall coverage meets 70% threshold
- No coverage regressions in Phase 1-3

### Phase 5: Test Utilities & Documentation (Week 3)

**Goal:** Reusable test infrastructure, clear patterns

**Tasks:**
1. Create `tests/utils/factories.ts`:
   - `createMockEvent(type, overrides)`
   - `createMockReport(kind, overrides)`
   - `createMockWebhookPayload(event)`
   - `createMockUser(overrides)`
2. Create `tests/utils/assertions.ts`:
   - `expectCoverageScore(events, citations, expected)`
   - `expectValidCitation(citation)`
   - `expectContentHash(event, hash)`
3. Create `docs/TESTING.md`:
   - Testing philosophy
   - How to write tests (patterns from `reportOrchestrator.test.ts`)
   - E2E best practices
   - Debugging flaky tests
4. Update `CLAUDE.md` with testing guidelines

**Deliverables:**
- ✅ Test utilities library
- ✅ Testing documentation
- ✅ Examples for contributors

**Acceptance Criteria:**
- New developers can write tests using factories
- Documentation covers 80% of common scenarios
- Test utilities have their own tests

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **E2E tests flaky in CI** | High | Medium | Retry logic (2x), increase timeouts, mock external APIs |
| **Coverage calculation slow** | Medium | Low | Parallel test execution, exclude large test files from coverage |
| **GitHub Actions minutes exhausted** | Low | Medium | Optimize E2E runs (chromium only), cache node_modules |
| **Playwright learning curve** | Medium | Low | Provide examples in docs, start with 3 simple flows |
| **Coverage enforcement blocks urgent fixes** | Low | High | Emergency bypass via `[skip ci]` or workflow_dispatch override |
| **Mock auth breaks in CI** | Medium | Medium | Use `E2E_MOCK_AUTH_ENABLED` flag, test mock separately |
| **Coverage badge stale** | Low | Low | Badge auto-updates on push to master, verify in Phase 1 |
| **Test maintenance overhead** | Medium | Medium | Invest in utilities (Phase 5), keep tests simple, avoid over-mocking |

## Key Decisions

### **Decision 1: GitHub Actions Native vs Codecov**

**What:** Coverage reporting service
**Alternatives:** Codecov ($12/user/mo), Coveralls ($25/mo), self-hosted
**Rationale:**
- **User Value:** Zero cost for MVP, future-proof (easy migration to Codecov later)
- **Simplicity:** Single GitHub Actions workflow, no external tokens/accounts
- **Explicitness:** Coverage data stays in GitHub (artifacts), no third-party privacy concerns

**Tradeoffs:**
- ❌ No historical trend charts (Codecov strength)
- ✅ Faster (no external upload delay)
- ✅ Privacy (data never leaves GitHub)

### **Decision 2: Playwright vs Cypress**

**What:** E2E testing framework
**Alternatives:** Cypress, Puppeteer, TestCafe
**Rationale:**
- **User Value:** Cross-browser support (future), faster parallel execution
- **Simplicity:** First-class Next.js support, built-in test runners
- **Explicitness:** Native async/await (no custom commands), trace viewer for debugging

**Tradeoffs:**
- ❌ Steeper learning curve than Cypress
- ✅ Better CI performance (headless chromium)
- ✅ Future-proof (active development, Microsoft backing)

### **Decision 3: 80% Patch Coverage Threshold**

**What:** Minimum coverage for new code
**Alternatives:** 70% (conservative), 90% (aggressive), no enforcement
**Rationale:**
- **User Value:** Enforces quality bar for new code, prevents regression
- **Simplicity:** Clear threshold, automated enforcement
- **Explicitness:** Patch coverage visible in every PR comment

**Tradeoffs:**
- ❌ May block urgent hotfixes (mitigation: bypass flag)
- ✅ Prevents legacy code from dragging down metrics
- ✅ Industry standard for 2025 (80-90% patch coverage)

### **Decision 4: Fail Build on Coverage Drop**

**What:** CI behavior when coverage drops
**Alternatives:** Warn only (flexible), always pass
**Rationale:**
- **User Value:** Forces quality consciousness, prevents "merge and hope"
- **Simplicity:** Binary pass/fail, no ambiguity
- **Explicitness:** Developer sees failure immediately in PR checks

**Tradeoffs:**
- ❌ Requires writing tests before merge (good forcing function)
- ✅ Prevents coverage decay over time
- ✅ Deploy-on-Friday confidence

### **Decision 5: P0 + P1 Scope (Not P2)**

**What:** Which critical paths to test in MVP
**Alternatives:** P0 only (minimal), P0+P1+P2 (comprehensive)
**Rationale:**
- **User Value:** Covers security (P0) + core business logic (P1) = 80% of risk
- **Simplicity:** ~80 new test scenarios (achievable in 3 weeks)
- **Explicitness:** Clear boundary (P2 deferred to future)

**Tradeoffs:**
- ❌ UI components (P2) still untested
- ✅ Critical paths covered (webhooks, backfill, reports)
- ✅ Overall coverage likely 70%+ after P0+P1

## Quality Validation

### Deep Modules Check

**✅ Coverage Collection Service:**
- Simple interface: `collectCoverage()` → reports
- Hides: Jest internals, instrumentation, path mapping

**✅ Coverage Reporting Service:**
- Simple interface: `reportCoverage(pr, data)` → comment
- Hides: GitHub API, markdown formatting, delta math

**✅ E2E Testing Framework:**
- Simple interface: `runE2ETests(env)` → results
- Hides: Browser lifecycle, mock setup, artifact capture

### Information Hiding Check

**✅ No Leakage:**
- Coverage thresholds configurable in single location (`jest.config.cjs`)
- GitHub Actions workflow isolated (changing reporters doesn't break workflow)
- E2E tests don't expose Playwright internals (page objects abstract selectors)

### Abstraction Layer Check

**✅ Vocabulary Changes:**
- **Layer 1 (CI/CD):** Workflows, jobs, artifacts → **Layer 2 (Coverage):** Reports, thresholds, instrumentation → **Layer 3 (Tests):** Suites, assertions, mocks → **Layer 4 (App):** Events, reports, webhooks

Each layer transforms concepts meaningfully, no pass-through.

### Strategic Design Check

**✅ 10-20% Time Investment:**
- Test utilities (Phase 5) = future velocity gain
- E2E framework (Phase 3) = deploy confidence multiplier
- Coverage enforcement = prevents future rework

Not just feature completion, investing in quality infrastructure.

---

## Next Steps

**After Spec Approval:**

1. Run `/plan` to break down into implementation tasks
2. Start with Phase 1 (Coverage Infrastructure) - highest ROI
3. Verify coverage comment in test PR before proceeding
4. Iterate through Phase 2-5 sequentially

**Success Metric:** Merge first PR with 80%+ patch coverage, coverage comment visible, badge updating, E2E tests passing.

---

**Philosophy:** "Coverage is not the goal; confidence is. Tests are not overhead; they are the product." - Kent Beck

This spec balances pragmatism (GitHub Actions native, free) with rigor (80% patch coverage, P0+P1 scope). We're building deploy-on-Friday confidence through systematic testing of critical paths, not chasing 100% coverage vanity metrics.
