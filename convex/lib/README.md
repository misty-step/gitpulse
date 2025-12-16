# Convex Library Utilities

Shared utilities following [Deep Modules](https://web.stanford.edu/~ouster/cgi-bin/book.php) philosophy - simple interfaces hiding complex implementations.

## Deep Modules

| Module | Interface | Hides |
|--------|-----------|-------|
| `githubApp.ts` | `verifyAndEnqueueWebhook()` | OAuth, HMAC verification, token minting, rate-limit state |
| `canonicalFactService.ts` | `upsertFromWebhook()`, `upsertFromBackfill()` | Payload normalization, SHA-256 hashing, deduplication |
| `generateReport.ts` | `generateReport()` | LLM prompting, citation validation, caching |
| `syncService.ts` | `startSync()`, `getStatus()` | One-job-per-installation invariant, cursor-based fetching |
| `timeWindows.ts` | `isLocalSunday()`, `getMidnightUtcHour()` | Timezone calculations, DST handling |

## Key Files

| File | Purpose |
|------|---------|
| `contentHash.ts` | SHA-256 content-addressed hashing for deduplication |
| `canonicalizeEvent.ts` | GitHub payload → canonical EventFact normalization |
| `embeddings.ts` | Voyage AI / OpenAI embedding calls with fallback |
| `github.ts` | GitHub REST API client with rate-limit handling |
| `GitHubClient.ts` | GraphQL client for timeline queries |
| `logger.ts` | Structured logging (Pino) |
| `metrics.ts` | `emitMetric()` for observability |
| `types.ts` | `ActionResult<T>` standard response type |
| `syncPolicy.ts` | Pure decision logic for sync scheduling |

## Patterns

### Content-Addressed Deduplication

```typescript
import { computeContentHash } from "./contentHash";

const hash = computeContentHash({
  canonicalText: "PR #1 – add auth",
  sourceUrl: "https://github.com/org/repo/pull/1",
  metrics: { additions: 10, deletions: 2 },
});

// Check before insert
const existing = await ctx.runQuery(internal.events.getByHash, { hash });
if (!existing) {
  await ctx.runMutation(internal.events.create, { ... });
}
```

### Timezone-Aware Scheduling

```typescript
import { isLocalSunday, getTimezoneOrDefault } from "./timeWindows";

// Filter users where it's Sunday in their timezone
const eligible = users.filter((u) =>
  isLocalSunday(Date.now(), getTimezoneOrDefault(u.timezone))
);
```

### ActionResult Pattern

```typescript
import type { ActionResult } from "./types";

function myAction(): ActionResult<MyData> {
  return {
    success: true,
    data: { ... },
    timestamp: Date.now(),
  };
}
```

## Testing

Tests live in `__tests__/` subdirectory:

```bash
pnpm test convex/lib/__tests__/contentHash.test.ts
pnpm test convex/lib/__tests__/timeWindows.test.ts
```

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Full architecture documentation
- [convex/README.md](../README.md) - Backend overview
