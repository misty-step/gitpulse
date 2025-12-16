# Convex Backend

Serverless backend for GitPulse using [Convex](https://convex.dev).

## Structure

```
convex/
├── schema.ts           # Database schema (12 tables)
├── auth.config.ts      # Clerk JWT validation
├── crons.ts            # Scheduled jobs (daily/weekly reports)
├── http.ts             # HTTP endpoint definitions
│
├── actions/            # External API calls (GitHub, LLM, embeddings)
├── lib/                # Shared utilities (deep modules)
├── sync/               # SyncService orchestration
│
└── *.ts                # Table-specific queries/mutations
```

## Key Files

| File | Purpose |
|------|---------|
| `schema.ts` | Database schema with 12 tables and indexes |
| `crons.ts` | 24 daily + 168 weekly cron jobs for report generation |
| `users.ts` | User queries/mutations including `getUsersByMidnightHour` |
| `events.ts` | GitHub event storage with content-hash deduplication |
| `reports.ts` | AI report storage and retrieval |
| `installations.ts` | GitHub App installation tracking |

## Tables

1. **users** - GitHub profiles + Clerk linkage + OAuth tokens + schedule preferences
2. **repos** - Repository metadata
3. **events** - GitHub activity facts with contentHash deduplication
4. **embeddings** - 1024-dim Voyage vectors
5. **reports** - Generated AI reports
6. **ingestionJobs** - Background job tracking
7. **installations** - GitHub App installation metadata
8. **webhookEvents** - Raw webhook envelopes
9. **coverageCandidates** - Fact-to-report scope relations
10. **embeddingQueue** - Pending embedding jobs
11. **reportJobHistory** - Audit log for scheduler runs
12. **syncBatches** - Sync batch tracking

## Running Locally

```bash
npx convex dev        # Start dev server (auto-syncs schema + functions)
npx convex dashboard  # Open dashboard (view data, logs)
```

## See Also

- [CLAUDE.md](../CLAUDE.md) - Full architecture documentation
- [lib/README.md](./lib/README.md) - Shared utilities
- [actions/README.md](./actions/README.md) - Action handlers
