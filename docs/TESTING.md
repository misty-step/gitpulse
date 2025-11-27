# Testing Guide

Comprehensive testing guide for GitPulse. This document covers testing philosophy, patterns, tools, and best practices.

## Table of Contents

- [Philosophy](#philosophy)
- [Test Structure](#test-structure)
- [Unit Testing](#unit-testing)
- [E2E Testing](#e2e-testing)
- [Test Utilities](#test-utilities)
- [Running Tests](#running-tests)
- [Coverage](#coverage)
- [Debugging](#debugging)
- [Best Practices](#best-practices)

## Philosophy

### Test Behavior, Not Implementation

**Good**: Test what the code does (behavior)
```typescript
it("generates report with citations when events exist", async () => {
  const context = createMockReportContext({ totals: { eventCount: 5 } });
  const result = await generateDailyReportFromContext("user", context, allowedUrls);

  expect(result.citations.length).toBeGreaterThan(0);
  expect(result.markdown).toContain("## Work Completed");
});
```

**Bad**: Test how the code does it (implementation)
```typescript
it("calls buildDailyStandupPrompt with correct arguments", async () => {
  // Don't test internal function calls - test outcomes instead
  expect(buildDailyStandupPrompt).toHaveBeenCalledWith(...);
});
```

### AAA Pattern (Arrange-Act-Assert)

Every test should follow this structure:

```typescript
it("computes deterministic hash for identical input", () => {
  // Arrange: Set up test data
  const input = {
    canonicalText: "PR #1 – add auth",
    sourceUrl: "https://github.com/org/repo/pull/1",
    metrics: { additions: 10, deletions: 2 },
  };

  // Act: Execute the code being tested
  const hash1 = computeContentHash(input);
  const hash2 = computeContentHash({ ...input });

  // Assert: Verify the outcome
  expectIdenticalHashes(hash1, hash2);
});
```

### Minimize Mocks

**Prefer real implementations** when possible:

```typescript
// Good: Use real pure functions
const hash = computeContentHash(data); // No mocking needed

// Good: Use test fixtures/factories
const user = createMockUser({ ghLogin: "alice" });

// Necessary: Mock external APIs
global.fetch = jest.fn(() => createMockResponse({ data: "..." }));
```

**Avoid heavy mocking** - it's often a design smell:
- Too many mocks → Module doing too much (violates SRP)
- Complex mock setup → Tight coupling between modules
- Brittle tests → Testing implementation details

### Coverage Goals

- **Patch coverage**: ≥80% for new code (enforced in CI)
- **Overall coverage**: ≥70% project-wide
- **Critical paths**: 90%+ (auth, webhooks, content hashing)

**Coverage ≠ Quality**: Aim for confidence, not 100%. Diminishing returns after 80-90%.

## Test Structure

### File Organization

```
gitpulse/
├── app/
│   └── api/
│       └── webhooks/
│           └── github/
│               └── __tests__/          # Next.js route tests
│                   └── route.test.ts
├── convex/
│   ├── actions/
│   │   └── github/
│   │       └── __tests__/              # Action tests
│   │           ├── processWebhook.test.ts
│   │           └── startBackfill.test.ts
│   └── lib/
│       └── __tests__/                  # Library/utility tests
│           ├── contentHash.test.ts
│           ├── github.test.ts
│           └── reportGenerator.test.ts
├── e2e/                                # E2E tests
│   ├── auth.spec.ts
│   ├── webhook.spec.ts
│   └── fixtures/
│       ├── auth.ts
│       └── users.ts
└── tests/
    └── utils/                          # Shared test utilities
        ├── factories.ts
        └── assertions.ts
```

### Naming Conventions

- **Test files**: `*.test.ts` for unit/integration, `*.spec.ts` for E2E
- **Test suites**: `describe("moduleName", () => { ... })`
- **Test cases**: `it("does something specific", () => { ... })`

Use descriptive test names:
```typescript
// Good
it("throws RateLimitError on 429 with proper reset time")
it("filters citations to only allowed URLs")
it("generates daily report with LLM for non-empty context")

// Bad
it("works")
it("test1")
it("should work correctly")
```

## Unit Testing

### Basic Pattern

```typescript
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { functionToTest } from "../module";
import { createMockX } from "../../../tests/utils/factories";

describe("functionToTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles success case", () => {
    const input = createMockX();
    const result = functionToTest(input);
    expect(result).toBeDefined();
  });

  it("handles error case", () => {
    expect(() => functionToTest(null)).toThrow("Expected error");
  });
});
```

### Testing Pure Functions

Pure functions (no side effects) are easiest to test:

```typescript
import { computeContentHash } from "../contentHash";
import { expectValidContentHash, expectIdenticalHashes } from "../../../tests/utils/assertions";

describe("computeContentHash", () => {
  const baseInput = {
    canonicalText: "PR #1 – add auth",
    sourceUrl: "https://github.com/org/repo/pull/1",
    metrics: { additions: 10, deletions: 2 },
  };

  it("produces deterministic hashes for identical input", () => {
    const first = computeContentHash(baseInput);
    const second = computeContentHash({ ...baseInput });
    expectIdenticalHashes(first, second);
  });
});
```

### Testing Convex Actions

Actions require mocking the Convex context:

```typescript
import { createMockActionCtx } from "../../../tests/utils/factories";
import { processWebhook } from "../processWebhook";

describe("processWebhook", () => {
  it("creates event when payload is valid", async () => {
    const ctx = createMockActionCtx({
      runQuery: jest.fn().mockResolvedValue(null), // No existing event
      runMutation: jest.fn().mockResolvedValue("event_123"),
    });

    await processWebhook(ctx, { payload: mockPayload });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "pr_opened" })
    );
  });
});
```

### Testing with External APIs

Mock `fetch` for GitHub API calls:

```typescript
import { createMockResponse, createMockErrorResponse } from "../../../tests/utils/factories";

describe("githubFetch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("constructs proper API request with auth headers", async () => {
    const mockFetch = jest.fn(() =>
      createMockResponse({ id: 123, name: "test-repo" })
    );
    global.fetch = mockFetch as any;

    await getRepository("test-token", "owner/repo");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });
});
```

### Testing Rate Limiting

```typescript
it("throws RateLimitError on 429 with proper reset time", async () => {
  const resetTime = Math.floor(Date.now() / 1000) + 3600;

  const mockFetch = jest.fn(() =>
    createMockErrorResponse(
      429,
      "Too Many Requests",
      { message: "API rate limit exceeded" },
      {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(resetTime),
      }
    )
  );
  global.fetch = mockFetch as any;

  await expect(getRepository("test-token", "owner/repo")).rejects.toThrow(
    RateLimitError
  );

  try {
    await getRepository("test-token", "owner/repo");
  } catch (error) {
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).reset).toBe(resetTime * 1000);
  }
});
```

## E2E Testing

### Playwright Configuration

E2E tests use Playwright with Chromium browser:

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://localhost:3000',
  workers: process.env.CI ? 1 : 4,
  retries: process.env.CI ? 2 : 0,
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Basic E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test('user can sign in via GitHub OAuth', async ({ page }) => {
  // Navigate to landing page
  await page.goto('/');

  // Click sign in button
  await page.click('button:has-text("Sign in with GitHub")');

  // Wait for OAuth redirect
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Verify dashboard loaded
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Using Fixtures

Create reusable test data in `e2e/fixtures/`:

```typescript
// e2e/fixtures/users.ts
export const testUsers = {
  alice: {
    ghLogin: "alice",
    ghId: 1,
    email: "alice@example.com",
  },
  bob: {
    ghLogin: "bob",
    ghId: 2,
    email: "bob@example.com",
  },
};
```

### Mocking OAuth in E2E

```typescript
test('authentication flow with mocked OAuth', async ({ page }) => {
  // Set mock auth environment variable
  process.env.E2E_MOCK_AUTH_ENABLED = 'true';

  // Intercept OAuth callback
  await page.route('**/api/auth/callback/**', (route) => {
    route.fulfill({
      status: 302,
      headers: { Location: '/dashboard' },
    });
  });

  await page.goto('/');
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard');
});
```

## Test Utilities

### Factories (`tests/utils/factories.ts`)

Use factories to create test data with sensible defaults:

```typescript
import {
  createMockUser,
  createMockRepo,
  createMockEvent,
  createMockReportContext,
} from "../../../tests/utils/factories";

// Create with defaults
const user = createMockUser();

// Override specific fields
const alice = createMockUser({
  ghLogin: "alice",
  email: "alice@example.com",
});

// Create events by type
const prEvent = createMockEvent("pr_opened", {
  metadata: { prNumber: 42 },
});

// Create report context
const context = createMockReportContext({
  totals: { eventCount: 10 },
});
```

**Available factories**:
- `createMockUser()` - User documents
- `createMockRepo()` - Repository documents
- `createMockEvent()` - Event documents (by type)
- `createMockReport()` - Report documents
- `createMockInstallation()` - Installation documents
- `createMockGitHubUser()` - GitHub API user payloads
- `createMockWebhookPayload()` - Webhook payloads
- `createMockReportContext()` - Report generation context
- `createMockPrompt()` - LLM prompt payloads
- `createMockResponse()` - HTTP success responses
- `createMockErrorResponse()` - HTTP error responses
- `createMockActionCtx()` - Convex action context

### Custom Assertions (`tests/utils/assertions.ts`)

Use custom assertions for clearer error messages:

```typescript
import {
  expectValidContentHash,
  expectIdenticalHashes,
  expectValidCitation,
  expectValidCoverageScore,
} from "../../../tests/utils/assertions";

// Content hash validation
expectValidContentHash(hash); // Checks SHA-256 format

// Hash comparison
expectIdenticalHashes(hash1, hash2); // For idempotency
expectDifferentHashes(hash1, hash2); // For collision tests

// Citation validation
expectValidCitation("https://github.com/owner/repo/pull/123");
expectValidCitations(report.citations);
expectDeduplicatedCitations(report.citations);

// Coverage validation
expectValidCoverageScore(0.85);
expectCoverageAboveThreshold(0.85, 0.8);
```

**Available assertions**:
- Content Hash: `expectValidContentHash`, `expectIdenticalHashes`, `expectDifferentHashes`
- Citations: `expectValidCitation`, `expectValidCitations`, `expectDeduplicatedCitations`
- Coverage: `expectValidCoverageScore`, `expectCoverageAboveThreshold`
- Reports: `expectReportHasRequiredSections`, `expectReportMeetsWordCount`
- Events: `expectValidCanonicalEvent`, `expectValidEventType`
- HTTP: `expectResponseStatus`, `expectResponseHeaders`
- Convex: `expectValidConvexId`, `expectValidTimestamps`

## Running Tests

### Local Development

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test contentHash.test.ts

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode (debugging)
pnpm test:e2e --ui
```

### CI/CD

Tests run automatically on every PR via GitHub Actions:

1. **Unit/Integration Tests** (`.github/workflows/ci.yml`)
   - Runs on push to any branch
   - Executes `pnpm test`
   - Fails if any test fails

2. **Coverage Report** (`.github/workflows/coverage.yml`)
   - Runs on pull requests
   - Posts coverage comment to PR
   - Enforces 80% patch coverage threshold
   - Updates coverage badge on master

3. **E2E Tests** (`.github/workflows/e2e.yml`)
   - Runs on pull requests
   - Starts Next.js dev server
   - Runs Playwright tests
   - Uploads screenshots/videos on failure

## Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

- **Patch coverage**: ≥80% (new code only, enforced in CI)
- **Overall coverage**: ≥70% (entire codebase)
- **Statement coverage**: Primary metric
- **Branch coverage**: Secondary metric

### Interpreting Coverage

```
-----------|---------|----------|---------|---------|-------------------
File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------|---------|----------|---------|---------|-------------------
All files  |   92.36 |    84.9  |   94.44 |   92.91 |
 github.ts |   92.36 |    84.9  |   94.44 |   92.91 | 64-66,278,480
-----------|---------|----------|---------|---------|-------------------
```

- **Stmts**: Statement coverage (most important)
- **Branch**: Branch/decision coverage
- **Funcs**: Function coverage
- **Lines**: Line coverage
- **Uncovered Line #s**: Lines not executed by tests

### Coverage Best Practices

1. **Don't chase 100%**: Diminishing returns after 80-90%
2. **Focus on critical paths**: Auth, webhooks, payment, data integrity
3. **Ignore trivial code**: Getters, setters, type guards
4. **Test edge cases**: Error handling, boundary conditions
5. **Review uncovered lines**: Are they dead code? Should they be tested?

## Debugging

### Debugging Failing Tests

```bash
# Run single test file with verbose output
pnpm test contentHash.test.ts --verbose

# Run specific test by name pattern
pnpm test -t "produces deterministic hashes"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest contentHash.test.ts
```

### Debugging E2E Tests

```bash
# Run E2E tests in headed mode (see browser)
pnpm test:e2e --headed

# Run with UI mode (interactive debugging)
pnpm test:e2e --ui

# Debug specific test
pnpm test:e2e auth.spec.ts --headed --debug
```

### Using Playwright Trace Viewer

```bash
# Generate trace
pnpm test:e2e --trace on

# Open trace viewer
npx playwright show-trace trace.zip
```

### Common Issues

**Issue**: Tests timeout
```typescript
// Increase timeout for slow operations
it("generates report with LLM", async () => {
  // ...
}, 30000); // 30 second timeout
```

**Issue**: Flaky tests (intermittent failures)
```typescript
// Use waitFor for async operations
await page.waitForSelector('button:has-text("Submit")', {
  state: 'visible',
  timeout: 10000,
});

// Use retry logic for API calls
await expect(async () => {
  const response = await fetch('/api/status');
  expect(response.ok).toBe(true);
}).toPass({ timeout: 5000 });
```

**Issue**: Mock not working
```typescript
// Ensure mock is set up before test runs
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => createMockResponse({ data: "..." }));
});

// Restore original after test
afterEach(() => {
  global.fetch = originalFetch;
});
```

## Best Practices

### 1. Test Independence

Each test should be runnable in isolation:

```typescript
// Good: Each test is independent
describe("contentHash", () => {
  it("test A", () => {
    const hash = computeContentHash(dataA);
    expect(hash).toBeDefined();
  });

  it("test B", () => {
    const hash = computeContentHash(dataB);
    expect(hash).toBeDefined();
  });
});

// Bad: Tests depend on each other
let sharedState;
it("test A", () => {
  sharedState = computeContentHash(dataA);
});
it("test B", () => {
  expect(sharedState).toBeDefined(); // Depends on test A
});
```

### 2. Clear Test Names

```typescript
// Good: Describes what and why
it("throws RateLimitError when API returns 429 with reset header")
it("filters citations to only allowed URLs for security")
it("generates daily report with LLM when events exist")

// Bad: Vague or generic
it("works correctly")
it("handles edge cases")
it("test rate limiting")
```

### 3. One Assertion Per Concept

```typescript
// Good: Test one thing
it("computes deterministic hash", () => {
  const hash1 = computeContentHash(input);
  const hash2 = computeContentHash(input);
  expectIdenticalHashes(hash1, hash2);
});

it("produces valid SHA-256 format", () => {
  const hash = computeContentHash(input);
  expectValidContentHash(hash);
});

// Acceptable: Multiple assertions for same concept
it("validates user profile fields", () => {
  const user = createMockUser();
  expect(user.ghLogin).toBeDefined();
  expect(user.ghId).toBeGreaterThan(0);
  expect(user.avatarUrl).toMatch(/^https:/);
});
```

### 4. Test Error Cases

```typescript
describe("error handling", () => {
  it("handles network timeout", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("Network timeout"))
    );

    await expect(getRepository("token", "owner/repo"))
      .rejects.toThrow("Network timeout");
  });

  it("handles invalid JSON responses", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => { throw new Error("Invalid JSON"); },
      } as Response)
    );

    await expect(getRepository("token", "owner/repo"))
      .rejects.toThrow("Invalid JSON");
  });
});
```

### 5. Use Descriptive Variables

```typescript
// Good
const validPRPayload = createMockWebhookPayload("opened", "pull_request");
const expectedHash = "abc123...";
const resetTimeOneHourFromNow = Date.now() + 3600000;

// Bad
const payload = { ... };
const hash = "abc123...";
const time = Date.now() + 3600000;
```

### 6. Keep Tests DRY (Don't Repeat Yourself)

```typescript
// Good: Use factories and shared setup
describe("report generation", () => {
  const baseContext = createMockReportContext();

  it("generates daily report", async () => {
    const result = await generateDailyReport("user", baseContext);
    expect(result.markdown).toContain("## Work Completed");
  });

  it("generates weekly report", async () => {
    const result = await generateWeeklyReport("user", baseContext);
    expect(result.markdown).toContain("## Accomplishments");
  });
});

// Bad: Duplicate setup in every test
it("generates daily report", async () => {
  const context = {
    timeframe: { start: 1000, end: 2000 },
    totals: { eventCount: 5, byType: { ... } },
    repos: [...],
    events: [],
  };
  // ... test code
});
```

### 7. Avoid Testing Third-Party Code

```typescript
// Bad: Testing Jest/Playwright itself
it("jest mock works", () => {
  const fn = jest.fn();
  fn();
  expect(fn).toHaveBeenCalled(); // Don't test Jest
});

// Good: Test your code's behavior
it("calls GitHub API when backfill starts", async () => {
  await startBackfill(ctx, { repoId: "repo_123" });
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("/repos/"),
    expect.anything()
  );
});
```

### 8. Flaky Test Zero Tolerance

If a test fails intermittently:

1. **Fix it immediately** - Add proper waits, fix race conditions
2. **If unfixable** - Delete it (better to have no test than flaky test)
3. **Never skip/disable** - Fix or delete, don't ignore

```typescript
// Bad: Skipping flaky test
it.skip("sometimes fails", async () => { ... });

// Good: Fixed with proper wait
it("waits for async operation", async () => {
  await page.waitForSelector('button', { state: 'visible' });
  await page.click('button');
  await expect(page.locator('div')).toContainText('Success');
});
```

## Examples

### Example 1: Testing Pure Function

```typescript
// convex/lib/__tests__/contentHash.test.ts
import { computeContentHash } from "../contentHash";
import { expectIdenticalHashes, expectDifferentHashes } from "../../../tests/utils/assertions";

describe("computeContentHash", () => {
  const baseInput = {
    canonicalText: "PR #1 – add auth",
    sourceUrl: "https://github.com/org/repo/pull/1",
    metrics: { additions: 10, deletions: 2 },
  };

  it("produces deterministic hashes for identical input", () => {
    const first = computeContentHash(baseInput);
    const second = computeContentHash({ ...baseInput });
    expectIdenticalHashes(first, second);
  });

  it("changes hash when canonicalText differs", () => {
    const a = computeContentHash(baseInput);
    const b = computeContentHash({ ...baseInput, canonicalText: "different" });
    expectDifferentHashes(a, b);
  });
});
```

### Example 2: Testing with Mocks

```typescript
// convex/lib/__tests__/reportGenerator.test.ts
import { generateDailyReportFromContext } from "../reportGenerator";
import { createMockReportContext } from "../../../tests/utils/factories";

jest.mock("../llmOrchestrator");

describe("generateDailyReportFromContext", () => {
  it("generates report with LLM for non-empty context", async () => {
    const context = createMockReportContext();
    const allowedUrls = ["https://github.com/acme/repo/pull/1"];

    llmOrchestrator.generateWithOrchestrator.mockResolvedValue({
      markdown: "## Work Completed\nBuilt feature X",
      provider: "google",
      model: "gemini-2.5-flash",
    });

    const result = await generateDailyReportFromContext("octocat", context, allowedUrls);

    expect(result.markdown).toContain("## Work Completed");
    expect(result.provider).toBe("google");
  });
});
```

### Example 3: E2E Test

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign in and access dashboard', async ({ page }) => {
  await page.goto('/');

  await page.click('button:has-text("Sign in with GitHub")');
  await page.waitForURL('/dashboard', { timeout: 10000 });

  await expect(page.locator('h1')).toContainText('Dashboard');
  await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
});
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Martin Fowler on Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)

---

**Questions?** Check [CLAUDE.md](../CLAUDE.md) for project-specific testing guidelines or ask the team in #engineering.
