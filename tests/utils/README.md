# Test Utilities

Shared utilities for GitPulse test suite. Prefer these over raw mocks for consistency and clear error messages.

## Structure

```
tests/utils/
├── factories.ts        # Test data factory functions
└── assertions.ts       # Custom assertion helpers
```

## Factories (`factories.ts`)

Create test fixtures with sensible defaults and optional overrides.

### Core Database Entities

| Factory | Creates |
|---------|---------|
| `createMockUser()` | User document (users table) |
| `createMockRepo()` | Repository document (repos table) |
| `createMockEvent()` | Event document (events table) |
| `createMockReport()` | Report document (reports table) |
| `createMockInstallation()` | Installation document (installations table) |

### GitHub API Responses

| Factory | Creates |
|---------|---------|
| `createMockGitHubUser()` | GitHub user payload |
| `createMockWebhookPayload()` | Webhook payload (PR, review, push, issue) |
| `createMockTimelineNode()` | GraphQL timeline node |
| `createMockTimelineResult()` | Backfill result with pagination |

### HTTP & Convex Mocks

| Factory | Creates |
|---------|---------|
| `createMockResponse()` | Successful HTTP response |
| `createMockErrorResponse()` | Error HTTP response with status |
| `createMockActionCtx()` | Convex action context with mocked methods |

### Usage

```typescript
import { createMockUser, createMockEvent } from "../../../tests/utils/factories";

// With defaults
const user = createMockUser();

// With overrides
const alice = createMockUser({ ghLogin: "alice", email: "alice@example.com" });

// Type-specific events
const pr = createMockEvent("pr_opened", { metadata: { prNumber: 123 } });
const commit = createMockEvent("commit");

// Webhook payloads
const payload = createMockWebhookPayload("opened", "pull_request");
```

## Assertions (`assertions.ts`)

Custom assertions with clear error messages for domain concepts.

### Content Hash

| Assertion | Purpose |
|-----------|---------|
| `expectValidContentHash(hash)` | SHA-256 format (64 hex chars) |
| `expectIdenticalHashes(a, b)` | Idempotency verification |
| `expectDifferentHashes(a, b)` | Collision testing |

### Citations & URLs

| Assertion | Purpose |
|-----------|---------|
| `expectValidCitation(url)` | Valid GitHub URL format |
| `expectValidCitations(urls)` | All URLs valid |
| `expectDeduplicatedCitations(urls)` | No duplicate citations |
| `expectCitationsFromAllowedUrls(citations, allowed)` | Citations subset check |

### Coverage Score

| Assertion | Purpose |
|-----------|---------|
| `expectValidCoverageScore(score, opts)` | Score in 0-1 range |
| `expectCoverageAboveThreshold(score, min)` | Minimum threshold check |
| `expectValidCoverageBreakdown(breakdown)` | Breakdown structure validation |

### Reports

| Assertion | Purpose |
|-----------|---------|
| `expectReportHasRequiredSections(md, headings)` | Required headings present |
| `expectReportMeetsWordCount(md, min)` | Minimum word count |
| `expectValidLLMMetadata(report)` | Provider/model validation |

### Events

| Assertion | Purpose |
|-----------|---------|
| `expectValidCanonicalEvent(event)` | Canonical fields valid |
| `expectValidEventType(type)` | Known event type |

### HTTP & Convex

| Assertion | Purpose |
|-----------|---------|
| `expectResponseStatus(response, status)` | HTTP status check |
| `expectResponseHeaders(response, headers)` | Required headers present |
| `expectValidConvexId(doc)` | Valid _id field |
| `expectValidTimestamps(doc)` | createdAt/updatedAt valid |

### Usage

```typescript
import {
  expectValidContentHash,
  expectValidCitation,
  expectValidCoverageScore,
} from "../../../tests/utils/assertions";

it("produces valid hash", () => {
  const hash = computeContentHash(data);
  expectValidContentHash(hash);
});

it("generates valid citations", () => {
  const report = await generateReport(context);
  report.citations.forEach(expectValidCitation);
  expectValidCoverageScore(report.coverageScore, { min: 0.8 });
});
```

## Best Practices

1. **Prefer factories over raw objects** - Factories ensure type safety and provide sensible defaults
2. **Use domain assertions** - `expectValidContentHash(hash)` is clearer than `expect(hash).toMatch(/^[a-f0-9]{64}$/)`
3. **Override only what matters** - Let factories handle irrelevant fields
4. **Combine assertions** - Use multiple assertions to validate complex objects

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Testing strategy and patterns
- [docs/TESTING.md](../../docs/TESTING.md) - Full testing guide
