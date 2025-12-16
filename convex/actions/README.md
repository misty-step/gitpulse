# Convex Actions

Actions are Convex functions that can call external APIs and run async code.

## Structure

```
actions/
├── github/             # GitHub API interactions
├── embeddings/         # Voyage AI / OpenAI embeddings
├── reports/            # Report generation
├── sync/               # SyncService orchestration
├── run*.ts             # Scheduled report runners
└── *.ts                # Other actions
```

## Key Files

### Scheduled Reports

| File | Purpose |
|------|---------|
| `runDailyReports.ts` | Daily standup generation (runs every hour) |
| `runWeeklyReports.ts` | Weekly retro generation (runs every hour, filters by Sunday) |
| `generateScheduledReport.ts` | Shared report generation driver |

### Data Ingestion

| File | Purpose |
|------|---------|
| `ingestRepo.ts` | Ingest single repository events |
| `ingestMultiple.ts` | Batch repository ingestion |
| `startBackfill.ts` | Historical data backfill |
| `syncUserActivity.ts` | User activity sync |

### Embeddings & Search

| File | Purpose |
|------|---------|
| `generateEmbeddings.ts` | Batch embedding generation |
| `vectorSearch.ts` | Semantic similarity search |

### Subdirectories

- `github/` - GitHub API actions (processWebhook, startBackfill)
- `embeddings/` - Embedding batch processing
- `reports/` - Report generation actions
- `sync/` - SyncService implementation

## Patterns

### ActionResult Response

All actions return `ActionResult<T>`:

```typescript
import type { ActionResult } from "../lib/types";

export const myAction = internalAction({
  args: { ... },
  handler: async (ctx, args): Promise<ActionResult<MyData>> => {
    try {
      const data = await doWork();
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: { code: "ERROR", message: error.message },
        timestamp: Date.now(),
      };
    }
  },
});
```

### Scheduled Report Pattern

```typescript
// Query users by their midnight hour
const users = await ctx.runQuery(internal.users.getUsersByMidnightHour, {
  midnightUtcHour: args.hourUTC,
  weeklyEnabled: true,
});

// Filter to only users where it's Sunday locally (weekly only)
const eligible = users.filter((u) =>
  isLocalSunday(Date.now(), getTimezoneOrDefault(u.timezone))
);

// Generate report for each eligible user
for (const user of eligible) {
  await ctx.runAction(internal.actions.generateScheduledReport.generateWeeklyReport, {
    userId: user.clerkId,
    timezone: user.timezone,
  });
}
```

## Testing

Tests live in `__tests__/` subdirectory:

```bash
pnpm test convex/actions/__tests__/runWeeklyReports.test.ts
pnpm test convex/actions/__tests__/ingestRepo.test.ts
```

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Full architecture documentation
- [lib/README.md](../lib/README.md) - Shared utilities
