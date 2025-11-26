# TODO: Test Coverage Infrastructure

## Context
- **Architecture**: GitHub Actions Native + Playwright E2E (from TASK.md)
- **Module Boundaries**: Coverage Collection → Reporting → Enforcement, E2E Framework, Test Modules
- **Key Files**: `.github/workflows/coverage.yml`, `playwright.config.ts`, test files in `app/api/`, `convex/lib/`, `convex/actions/`, `e2e/`
- **Patterns**: Follow `reportOrchestrator.test.ts` (jest.mock, createMockActionCtx, assertions), existing CI workflow structure
- **Phases**: 5 phases over 3 weeks (Coverage Infra → P0 Tests → E2E → P1 Tests → Utilities)

## Phase 1: Coverage Infrastructure (MVP - Week 1)

### Coverage Collection & Reporting

- [x] Update Jest config to add json-summary reporter
  ```
  Files: jest.config.cjs (modify line 43)
  Architecture: Module 1 - Coverage Collection Service
  Approach: Add "json-summary" to coverageReporters array alongside existing "text", "lcov", "html"
  Success: `pnpm test:coverage` generates coverage/coverage-summary.json file
  Test: Run coverage → verify JSON file exists with {total: {lines, branches, functions, statements}}
  Dependencies: None (modifies existing config)
  Time: 5min
  ```

- [x] Create GitHub Actions coverage workflow
  ```
  Files: .github/workflows/coverage.yml (new)
  Architecture: Module 2 - Coverage Reporting Service
  Pseudocode: TASK.md Phase 1, Task 2 (ArtiomTr action integration)
  Approach: Follow .github/workflows/ci.yml pattern (pnpm setup, node 22, frozen-lockfile)
  Success: Workflow runs on PR, posts comment with coverage summary, fails if patch < 80%
  Test: Create test PR → verify comment appears, badge updates, thresholds enforced
  Dependencies: json-summary reporter (previous task)
  Time: 45min
  Details:
    - Trigger: pull_request, push to master
    - Use ArtiomTr/jest-coverage-report-action@v2
    - Config: package-manager: pnpm, test-script: pnpm test:coverage, threshold: 80
    - Permissions: contents: read, pull-requests: write
  ```

- [x] Add coverage badge to README
  ```
  Files: README.md (modify - add badge near top, line ~8)
  Architecture: Module 5 - Badge Generation Service
  Approach: Use shields.io dynamic badge with GitHub Actions artifact
  Success: Badge displays current coverage percentage, updates on master push, clickable
  Test: Push to master → badge updates within 2 minutes, click badge → links to coverage report
  Dependencies: Coverage workflow running (previous task)
  Time: 15min
  Badge format: [![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/USER/GIST_ID/raw/coverage.json)](https://github.com/misty-step/gitpulse/actions)
  Alternative (simpler): Use codecov.io badge syntax pointing to GitHub Actions artifact
  ```

## Phase 2: P0 Critical Security Tests (Week 1-2)

### P0-1: Webhook Signature Verification

- [x] Implement webhook signature tests (8 scenarios)
  ```
  Files: app/api/webhooks/github/__tests__/route.test.ts (new)
  Architecture: Tests API route handler for GitHub webhooks (security critical)
  Pseudocode: TASK.md P0-1 scenarios (valid signature, invalid, missing header, dual-secret, malformed JSON, timing attack, replay)
  Approach: Follow app/api/health/__tests__/route.test.ts pattern (Next.js route testing with Request/Response mocks)
  Success: All 8 scenarios pass, webhook route achieves 95%+ coverage
  Test: Valid HMAC → 200, invalid → 401, missing header → 400, timing attack resistant (constant-time compare)
  Dependencies: None (tests existing route)
  Time: 90min
  Mock setup:
    - Mock crypto.createHmac for signature generation
    - Mock Convex action call (enqueueWebhook)
    - Create test webhook payloads (PR opened, issue created)
  ```

### P0-2: Event Canonicalization

- [x] Implement event canonicalization tests (12 scenarios)
  ```
  Files: convex/lib/__tests__/canonicalizeEvent.test.ts (new)
  Architecture: Tests EventFact normalization from GitHub payloads (data integrity critical)
  Pseudocode: TASK.md P0-2 scenarios (PR opened/merged/closed, issue opened, push, review, installation, null fields, URL normalization, unicode, large payloads)
  Approach: Follow convex/lib/__tests__/reportOrchestrator.test.ts pattern (jest.mock, pure function tests)
  Success: All 12 scenarios pass, canonicalizeEvent.ts achieves 90%+ coverage
  Test: PR opened payload → EventFact with correct metadata, URLs normalized, unicode preserved
  Dependencies: None (tests existing module)
  Time: 2hr
  Test data:
    - Use real GitHub webhook payload examples (from docs)
    - Test all EventType enum values
    - Verify contentHash consistency
  ```

### P0-3: Content Hash Determinism

- [x] Implement content hash tests (10 scenarios)
  ```
  Files: convex/lib/__tests__/contentHash.test.ts (new)
  Architecture: Tests SHA-256 hashing for event deduplication (data integrity critical)
  Pseudocode: TASK.md P0-3 scenarios (idempotent, collision resistant, key ordering, null vs undefined, unicode, large inputs, nested objects, array ordering, SHA-256 format)
  Approach: Pure function tests with input/output assertions
  Success: All 10 scenarios pass, contentHash.ts achieves 100% coverage (simple module)
  Test: Same input → same hash, different inputs → different hashes, object key order normalized
  Dependencies: None (tests existing module)
  Time: 60min
  Key assertions:
    - Hash format: /^[a-f0-9]{64}$/ (SHA-256 hex)
    - Determinism: hash(x) === hash(x) for 1000 iterations
    - Collision: hash(x) !== hash(y) for distinct x, y
  ```

### P0-4: Webhook Processing Action

- [x] Implement webhook processing tests (10 scenarios)
  ```
  Files: convex/actions/github/__tests__/processWebhook.test.ts (new)
  Architecture: Tests webhook processing action (security + data integrity critical)
  Pseudocode: TASK.md P0-4 scenarios (valid PR, duplicate event, new event, repo not found, malformed payload, installation, multiple events, rate limit, network timeout, unsupported event)
  Approach: Follow convex/lib/__tests__/reportOrchestrator.test.ts pattern (createMockActionCtx, jest.mock for Convex internals)
  Success: All 10 scenarios pass, processWebhook action achieves 85%+ coverage
  Test: Valid webhook → event persisted with contentHash, duplicate → skipped, rate limit → exponential backoff
  Dependencies: Event canonicalization tests (P0-2), content hash tests (P0-3)
  Time: 2hr
  Mock setup:
    - Mock ctx.runQuery (getByHash, getRepo)
    - Mock ctx.runMutation (createEvent, updateInstallation)
    - Mock canonicalizeEvent (return test EventFact)
    - Mock GitHub API for rate limit simulation
  ```

## Phase 3: E2E Framework Setup (Week 2)

### Playwright Configuration

- [x] Install and configure Playwright
  ```
  Files: package.json (add @playwright/test), playwright.config.ts (new)
  Architecture: Module 4 - E2E Testing Framework
  Pseudocode: TASK.md Phase 3, Tasks 1-3, 8 (Playwright setup)
  Approach: `pnpm add -D @playwright/test`, `npx playwright install chromium`
  Success: Playwright configured, `pnpm test:e2e` script runs, config matches spec (base URL localhost:3000, workers 1 CI/4 local, retries 2 CI/0 local)
  Test: Run `npx playwright test --help` → shows config, chromium browser installed
  Dependencies: None
  Time: 30min
  Config details:
    - testDir: './e2e'
    - baseURL: 'http://localhost:3000'
    - workers: process.env.CI ? 1 : 4
    - retries: process.env.CI ? 2 : 0
    - use: { screenshot: 'only-on-failure', video: 'retain-on-failure' }
  ```

- [x] Create E2E directory structure and fixtures
  ```
  Files: e2e/ (new dir), e2e/fixtures/auth.ts (new), e2e/fixtures/users.ts (new)
  Architecture: Module 4 - E2E Testing Framework (test fixtures)
  Pseudocode: TASK.md Phase 3, Task 4 (E2E directory structure)
  Approach: Create directories, add mock user/auth fixtures for reusable test data
  Success: Directory structure exists, fixtures export typed test data
  Test: Import fixtures in test file → type-safe user/auth data available
  Dependencies: Playwright config (previous task)
  Time: 20min
  Structure:
    e2e/
      ├── auth.spec.ts (auth flow tests)
      ├── webhook.spec.ts (webhook tests)
      ├── reports.spec.ts (report generation tests)
      └── fixtures/
          ├── auth.ts (mock auth tokens)
          └── users.ts (test user data)
  ```

### E2E Critical Flows

- [~] Implement E2E auth flow test
  ```
  Files: e2e/auth.spec.ts (new)
  Architecture: Tests authentication journey (E2E-1 from TASK.md)
  Pseudocode: TASK.md E2E-1 (visit landing → sign in → OAuth → dashboard → session persist)
  Approach: Playwright test with page.goto, page.click, page.waitForURL, expect assertions
  Success: Test passes, user authenticated, dashboard loads, session persists across refresh
  Test: Mock OAuth flow (intercept redirect), verify Clerk session, check Convex user document
  Dependencies: Playwright config, fixtures
  Time: 90min
  Mock strategy:
    - Use page.route() to intercept GitHub OAuth URLs
    - Mock OAuth callback with valid code
    - Set E2E_MOCK_AUTH_ENABLED=true in env

  Work Log:
    - Fixed webServer config - now uses port 3010 to avoid conflicts
    - Server starts correctly, landing page loads
    - Auth test gets stuck on /auth/callback (networkidle timeout)
    - Root cause: E2E_MOCK_AUTH infrastructure doesn't exist yet
    - Clerk integration needs server-side mock mode before E2E auth tests work
    - BLOCKER: Requires implementing mock auth infrastructure first
  ```

- [ ] Implement E2E webhook processing test
  ```
  Files: e2e/webhook.spec.ts (new)
  Architecture: Tests webhook → signature → processing flow (E2E-2 from TASK.md)
  Pseudocode: TASK.md E2E-2 (setup user/repo → POST webhook → verify signature → event persisted → UI updates)
  Approach: Use page.request.post() to send webhook, verify DB state via Convex client
  Success: Webhook processed, event in DB, UI reflects new event
  Test: POST with valid signature → event appears in dashboard events table
  Dependencies: Playwright config, webhook signature tests (P0-1)
  Time: 90min
  Integration:
    - Start Next.js dev server before tests (webServer config in playwright.config.ts)
    - Use real Convex dev deployment for E2E
    - Clean up test data after each run
  ```

- [ ] Implement E2E report generation test
  ```
  Files: e2e/reports.spec.ts (new)
  Architecture: Tests report generation flow (E2E-3 from TASK.md)
  Pseudocode: TASK.md E2E-3 (navigate reports → select date range → enter usernames → generate → verify rendering)
  Approach: Playwright test with form interaction, wait for LLM response, verify DOM
  Success: Report generated, citations clickable, coverage score displayed
  Test: Click generate → loading state → report rendered with citations → coverage score shown
  Dependencies: Playwright config, report tests (P1-2 later)
  Time: 90min
  Mock LLM:
    - Intercept LLM API calls (page.route for api.google.com, api.openai.com)
    - Return deterministic markdown with known citations
    - Verify citation extraction and HTML rendering
  ```

- [ ] Add E2E workflow to CI
  ```
  Files: .github/workflows/e2e.yml (new), package.json (modify - add test:e2e script)
  Architecture: CI integration for E2E tests
  Pseudocode: TASK.md Phase 3, Task 9 (E2E CI workflow)
  Approach: Follow .github/workflows/ci.yml pattern, add Playwright-specific steps
  Success: E2E tests run on every PR, screenshots/videos saved on failure
  Test: Create test PR → E2E tests run → results posted as check
  Dependencies: All E2E tests implemented
  Time: 45min
  Workflow steps:
    - Install Playwright browsers (npx playwright install --with-deps chromium)
    - Start Next.js dev server (npx next dev &)
    - Wait for server ready (npx wait-on http://localhost:3000)
    - Run tests (npx playwright test)
    - Upload artifacts on failure (uses: actions/upload-artifact@v4)
  ```

## Phase 4: P1 Business Logic Tests (Week 2-3)

### P1-1: GitHub Backfill Orchestration

- [ ] Implement backfill orchestration tests (10 scenarios)
  ```
  Files: convex/actions/github/__tests__/startBackfill.test.ts (new)
  Architecture: Tests GitHub API backfill logic (core business logic)
  Pseudocode: TASK.md P1-1 scenarios (timeline pagination, rate limit pause, progress tracking, deduplication, completion, network failure, budget exhausted, concurrent prevention, error recovery, empty repo)
  Approach: Follow reportOrchestrator.test.ts pattern (createMockActionCtx, mock GitHub API responses)
  Success: All 10 scenarios pass, startBackfill action achieves 80%+ coverage
  Test: Pagination → cursor advances, rate limit → job pauses, completion → status updated
  Dependencies: Content hash tests (P0-3), webhook processing tests (P0-4)
  Time: 2hr
  Mock GitHub API:
    - Mock timeline endpoint with Link headers (pagination)
    - Mock rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset)
    - Simulate network failures (throw Error intermittently)
  ```

### P1-2: Report Generation Pipeline

- [x] Implement report generator tests (10 scenarios)
  ```
  Files: convex/lib/__tests__/reportGenerator.test.ts (new)
  Architecture: Tests report generation from context (core business logic)
  Pseudocode: TASK.md P1-2 scenarios (daily/weekly generation, citation extraction, invalid URLs, markdown to HTML, XSS sanitization, empty events, coverage score, LLM timeout, duplicate citations)
  Approach: Pure function tests with mock LLM responses
  Success: All 10 scenarios pass, reportGenerator.ts achieves 85%+ coverage
  Test: Daily report → summary + highlights, citations extracted, XSS blocked (DOMPurify)
  Dependencies: None (pure functions)
  Time: 2hr
  Mock LLM output:
    - Return markdown with known citation patterns
    - Test malicious markdown (XSS attempts: <script>, <img onerror>)
    - Verify DOMPurify sanitization
  ```

### P1-3: LLM Orchestrator

- [x] Implement LLM orchestrator tests (10 scenarios)
  ```
  Files: convex/lib/__tests__/llmOrchestrator.test.ts (new)
  Architecture: Tests LLM provider fallback and retry logic (core business logic)
  Pseudocode: TASK.md P1-3 scenarios (Gemini success, Gemini → OpenAI fallback, both fail, token budget, retry logic, invalid API key, rate limit, streaming, cost tracking, timeout)
  Approach: Mock fetch() for Gemini/OpenAI APIs, test fallback chains
  Success: All 10 scenarios pass, llmOrchestrator.ts achieves 80%+ coverage
  Test: Gemini fails → OpenAI succeeds, rate limit → exponential backoff, timeout → abort
  Dependencies: None (API abstraction)
  Time: 2hr
  Mock providers:
    - Mock global.fetch for api.google.com, api.openai.com
    - Simulate failures (429 rate limit, 500 server error, timeout)
    - Track cost calculations (verify tokens_used, cost_usd)
  ```

### P1-4: GitHub API Client

- [ ] Implement GitHub client tests (10 scenarios)
  ```
  Files: convex/lib/__tests__/GitHubClient.test.ts (new)
  Architecture: Tests GitHub API client abstraction (core business logic)
  Pseudocode: TASK.md P1-4 scenarios (request construction, rate limit parsing, retry logic, 404/403/timeout errors, pagination, ETag caching, invalid JSON, token refresh)
  Approach: Mock fetch() for api.github.com, test retry/pagination logic
  Success: All 10 scenarios pass, GitHubClient.ts achieves 85%+ coverage
  Test: API request → proper headers, rate limit → pause/resume, pagination → Link header parsing
  Dependencies: None (API abstraction)
  Time: 2hr
  Mock GitHub API:
    - Mock responses with headers (Link for pagination, X-RateLimit-*, ETag)
    - Simulate errors (404, 403, 500, network timeout)
    - Verify retry intervals (1s, 2s, 4s, 8s exponential backoff)
  ```

## Phase 5: Test Utilities & Documentation (Week 3)

### Test Utilities

- [ ] Create test fixture factories
  ```
  Files: tests/utils/factories.ts (new)
  Architecture: Shared test data builders (reduce duplication)
  Pseudocode: TASK.md Phase 5, Task 1 (factory functions)
  Approach: Export factory functions with overrides pattern (createMockEvent, createMockReport, createMockWebhookPayload, createMockUser)
  Success: Factories exported, typed with TypeScript, used in at least 3 test files
  Test: Import factory in test → create test data → verify type safety and default values
  Dependencies: All P0+P1 tests completed (identify common patterns)
  Time: 60min
  Pattern:
    export function createMockEvent(type: EventType, overrides?: Partial<EventFact>): EventFact {
      return { /* defaults */ ...overrides };
    }
  ```

- [ ] Create custom assertions
  ```
  Files: tests/utils/assertions.ts (new)
  Architecture: Shared test assertions (reduce duplication)
  Pseudocode: TASK.md Phase 5, Task 2 (assertion helpers)
  Approach: Export custom expect matchers (expectCoverageScore, expectValidCitation, expectContentHash)
  Success: Assertions exported, used in coverage/report tests
  Test: Use custom assertion in test → clear error messages on failure
  Dependencies: Coverage tests, report tests completed
  Time: 45min
  Pattern:
    export function expectValidCitation(url: string) {
      expect(url).toMatch(/^https:\/\/github\.com\/[\w-]+\/[\w-]+\/(pull|issues)\/\d+/);
    }
  ```

### Documentation

- [ ] Create testing documentation
  ```
  Files: docs/TESTING.md (new)
  Architecture: Developer onboarding for testing
  Pseudocode: TASK.md Phase 5, Task 3 (testing guide)
  Approach: Document testing philosophy, patterns from reportOrchestrator.test.ts, E2E best practices, debugging flaky tests
  Success: Documentation covers 80% of common scenarios, examples included
  Test: New developer reads guide → can write test matching existing patterns
  Dependencies: All tests completed (extract patterns)
  Time: 90min
  Sections:
    - Philosophy: Test behavior not implementation, AAA pattern
    - Unit tests: Mock patterns, assertions, fixtures
    - E2E tests: Page objects, fixtures, debugging
    - Running tests: Local, CI, coverage
    - Debugging: Flaky tests, screenshots, trace viewer
  ```

- [ ] Update CLAUDE.md with testing guidelines
  ```
  Files: CLAUDE.md (modify - add Testing section)
  Architecture: Project-specific testing guidance for Claude
  Pseudocode: TASK.md Phase 5, Task 4 (CLAUDE.md update)
  Approach: Add Testing section referencing TESTING.md, coverage targets, key patterns
  Success: CLAUDE.md includes testing guidance, links to TESTING.md
  Test: Review CLAUDE.md → testing expectations clear
  Dependencies: TESTING.md completed
  Time: 20min
  Content:
    - Coverage targets (80% patch, 70% overall)
    - Test file locations (app/api/__tests__, convex/lib/__tests__, e2e/)
    - Key patterns (factories, assertions, mocks)
    - E2E strategy (3 critical flows, Playwright)
  ```

## Design Iteration

**After Phase 1 (Coverage Infra)**: Review coverage report format, adjust thresholds if needed (current: 80% patch, 70% overall)

**After Phase 2 (P0 Tests)**: Review test patterns, extract common mocks to shared fixtures, identify coupling (heavy mocking = design smell)

**After Phase 3 (E2E)**: Review E2E test flakiness, adjust timeouts/retries, evaluate mock strategy (MSW vs route interception)

**After Phase 4 (P1 Tests)**: Review overall coverage (target: 70%+), identify remaining gaps, plan P2 (UI components) for future

**After Phase 5 (Utilities)**: Refactor existing tests to use factories/assertions, eliminate duplication, measure velocity gain

## Automation Opportunities

**Test Fixture Generation**: Script to generate webhook payloads from GitHub API docs (avoid manual fixture creation)

**Coverage Diff Script**: Local script to compare coverage before/after changes (preview PR impact without pushing)

**Flaky Test Detector**: CI job to run E2E tests 3x in parallel, flag tests that fail intermittently

**Mock Data Sync**: Script to update test fixtures when GitHub API schema changes (webhook payload structure)

## Success Metrics

**Phase 1 Complete**: Coverage badge in README, PR comments working, thresholds enforced (pass: coverage comment visible in test PR)

**Phase 2 Complete**: P0 files at 90%+ coverage, overall coverage ~65%, all security paths tested (pass: webhook signature test prevents bypass)

**Phase 3 Complete**: 3 E2E flows passing, < 5min runtime, no flaky tests over 3 runs (pass: E2E tests green in CI)

**Phase 4 Complete**: Overall coverage ≥ 70%, P1 files at 80%+ coverage (pass: `pnpm test:coverage` shows 70%+ overall)

**Phase 5 Complete**: Factories used in 10+ tests, TESTING.md covers 80% of scenarios (pass: new developer writes test in < 30min)

## Notes

- **Test Independence**: Each test should be runnable in isolation (no shared state, idempotent)
- **Mock Minimization**: Prefer real implementations where feasible (e.g., contentHash is pure, no mocking needed)
- **Coverage != Quality**: Aim for confidence, not 100% coverage (diminishing returns after 80-90%)
- **Flaky Test Zero Tolerance**: Fix or delete flaky tests immediately (better to have fewer reliable tests)
- **E2E Cost Awareness**: E2E tests are slow (~5min total), reserve for critical user journeys only

## Architecture Validation

**Deep Modules Check**: Each test module (P0-1, P0-2, etc.) tests a single responsibility, hiding test setup complexity

**Information Hiding Check**: Test fixtures/factories hide implementation details (test code doesn't know about internal data structures)

**Modularity Check**: Tests can run in parallel (no dependencies between test files, only within phases)

**Strategic Investment Check**: Phases 1 (coverage) and 5 (utilities) = velocity multipliers, not just test count
