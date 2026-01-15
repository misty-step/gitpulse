# 0007 – Job-Per-Repo Sync Architecture

## Status
Accepted

## Context
Initial sync implementation used "chained" jobs: one job would complete and schedule the next repo. This caused issues:
1. Chain breaks if any job fails (remaining repos never sync)
2. Rate limit handling required complex state passing
3. Progress tracking was unreliable (batch vs individual job confusion)
4. Recovery was difficult—which repos completed before failure?

Alternatives considered:
1. **Single job per installation**: Simpler model but rate limits can block entire sync mid-way. No parallelization opportunity.
2. **Chained jobs**: Original approach—each job schedules successor. Fragile to failures, complex progress tracking.
3. **Job-per-repo with batch coordinator**: One job per repository, batch tracks overall progress. Failures isolated.

## Decision
Adopt job-per-repo architecture with syncBatches coordinator:
- Each sync request creates one `syncBatch` + N `ingestionJobs` (one per repo)
- Jobs execute independently: `processSyncJob` handles exactly one repo
- Batch aggregates results: `syncBatches.jobCompleted()` / `jobFailed()`
- Rate limit blocking affects only the blocked job
- Progress = completedRepos / totalRepos (reliable)

Key implementation:
- `convex/syncBatches.ts`: Batch lifecycle management
- `convex/actions/sync/processSyncJob.ts`: Single-repo worker
- `convex/lib/syncService.ts`: Orchestrates batch creation and job spawning

## Consequences
**Benefits:**
- Failure isolation: One repo's issues don't affect others
- Clear progress: Batch knows exactly which repos completed
- Rate limit handling: Blocked job self-reschedules without affecting batch
- Parallelization ready: Jobs could run concurrently (future optimization)

**Tradeoffs:**
- More database records: N jobs per sync instead of 1
- Complexity: Batch coordinator adds coordination logic
- Schema expansion: `syncBatches` table + `batchId` on jobs

**Invariants enforced:**
- One-job-per-installation: SyncService checks `getActiveForInstallation` before creating batch
- Batch completeness: Batch only completes when all jobs resolve (completed or failed)
- Idempotent processing: Jobs skip if already completed

**Design principle:**
Deep module hiding: `SyncService.request()` is the only interface. Callers don't know about batches, jobs, or rate limit handling.
