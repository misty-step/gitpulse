# DESIGN: Multi-Account Architecture

## Architecture Overview
**Selected Approach**: Claim-first Convex graph
**Rationale**: Convex already stores GitHub users + installations globally, so layering a `userInstallations` join plus derived repo access keeps the model close to GitHub's permission semantics while avoiding another service hop.

**Core Modules**
- InstallationRegistry – canonical GitHub installation metadata + webhook sync
- InstallationClaimService – verifies, stores, and audits N:M user↔installation claims
- AccessibleRepoService – computes accessible repos per user + optional tracked repo toggles
- ReportQueryEngine – assembles report windows from actor filters + repo ACLs
- IngestionOrchestrator – schedules backfill/webhook ingestion per installation while respecting shared claims

**Data Flow**: Clerk user → InstallationClaimService (claim) → InstallationRegistry (token + repo list) → AccessibleRepoService (cache) → ReportQueryEngine (fetch events) → Reports UI → Analytics + exports

**Key Decisions**
1. Canonical join table in Convex keeps relationships explicit; no more implicit `clerkUserId` on installations.
2. Report queries gate by repo set derived from claimed installations before filtering actors; prevents leakage even if reporters type other ghLogins.
3. Optional `trackedRepos` slice controls noise without reconfiguring installations.
4. Shared ingestion budget per installation ensures one webhook feed populates data for every claimant.

## Module: InstallationRegistry
Responsibility: Holds truth for GitHub App installations (metadata, repos, rate limits) and reacts to webhook or reconciliation jobs.

Public Interface:
```typescript
interface InstallationRegistry {
  getByInstallationId(id: number): Promise<InstallationDoc | null>
  upsert(payload: InstallationUpsert): Promise<Id<"installations">>
  updateRateLimit(id: number, budget: RateLimitBudget): Promise<void>
  listAll(): Promise<InstallationDoc[]>
  patchRepositories(id: number, names: string[]): Promise<void>
}
```

Internal Implementation:
- Backed by `installations` table (`installationId`, `accountLogin`, `repositorySelection`, `repositories`, `status`, `rateLimit*`).
- Webhook handler (`actions/github/processWebhook`) and reconciliation job call `upsert` with normalized payload.
- Maintains ETag + cursor for incremental ingestion.
- Emits `installation.updated` metric when repos change so AccessibleRepoService can refresh caches.

Dependencies:
- GitHub App APIs (`/app/installations`, `/installation/repositories`).
- Convex internal mutations for ingestion state.
- Used by ClaimService, IngestionOrchestrator, IntegrationStatus queries.

Data Structures:
```typescript
type InstallationDoc = {
  installationId: number
  accountLogin?: string
  repositories?: string[]
  status?: "active" | "suspended" | "deleted"
  lastSyncedAt?: number
  rateLimitRemaining?: number
}
```

Error Handling:
- Missing webhook payload → reject + log (DLQ entry in `webhookEvents`).
- GitHub API 401/404 → emit `installations.sync_failed`, leave prior data unchanged.
- Repo list drift → patch + emit diff summary.

## Module: InstallationClaimService
Responsibility: Manage the N:M mapping between Clerk users and installations with cryptographic verification against GitHub.

Public Interface:
```typescript
interface InstallationClaimService {
  listClaims(userId: string): Promise<UserInstallation[]>
  listUsers(installationId: number): Promise<UserInstallation[]>
  claimInstallation(input: ClaimInput): Promise<UserInstallation>
  releaseInstallation(userId: string, installationId: number): Promise<void>
  assertUserHasAccess(userId: string, installationId: number): Promise<boolean>
}
```

Internal Implementation:
- New `userInstallations` table: `{ userId, installationId, claimedAt, role }` with indexes by user, by installation, and composite.
- `claimInstallation` mutation flow:
  1. Load Clerk identity + stored GitHub OAuth token.
  2. Call GitHub `GET /user/installations` (or `/user/installations/{id}`) to verify membership + scope.citeturn1search0turn1search2
  3. Ensure installation exists in registry; reconcile if missing.
  4. Insert join row (idempotent via unique composite index) and emit audit log event.
- `listClaims` hydrates installation metadata for UI (account login, repo count, last sync).
- `releaseInstallation` deletes join row; optional `role` flag supports future admin vs viewer semantics.

Dependencies:
- InstallationRegistry for metadata.
- Clerk identity + stored GitHub tokens (from `users.updateGitHubAuth`).
- Used by UI (settings), IngestionOrchestrator (to know watchers), `IntegrationStatus` query.

Data Structures:
```typescript
interface UserInstallation {
  userId: string
  installationId: number
  role: "owner" | "viewer"
  claimedAt: number
}
```

Error Handling:
- Missing GitHub token → throw validation error instructing user to connect OAuth.
- GitHub API denies access → return 403 + recommendation to ask org admin.
- Duplicate claim → return existing row (no-op) but refresh `claimedAt`.

## Module: AccessibleRepoService
Responsibility: Compute and cache the repositories a user can see, then apply per-repo toggles before handing the list to reporting or ingestion UX.

Public Interface:
```typescript
interface AccessibleRepoService {
  refreshForUser(userId: string): Promise<UserRepoAccess>
  refreshForInstallation(installationId: number): Promise<void>
  list(userId: string, filter?: { enabledOnly?: boolean }): Promise<UserRepoAccess>
  setTrackedRepo(params: { userId: string; repoId: Id<"repos">; enabled: boolean }): Promise<void>
}
```

Internal Implementation:
- On every claim change or installation repo delta, recompute:
  - Fetch union of `installations.repositories` for claimed installations.
  - Upsert into `repos` table as needed (existing ingestion flow already does this but we trigger lean sync for metadata only).
  - Persist derived set into `userRepoAccess` cached document or derive on read with deterministic key `access:{userId}` stored via Convex `table()` or `kv`. (Implementation detail recorded in `convex/lib/accessControl.ts`).
- `trackedRepos` table stores per-user toggles with indexes by user + repo.
- `list()` merges derived union with toggles: default = enabled, unless entry with `enabled=false` exists.

Dependencies:
- InstallationRegistry for repo lists.
- `trackedRepos` table for overrides.
- `repos` table for metadata used in UI.
- Notifies ReportQueryEngine when cache version changes (simple monotonic `accessVersion`).

Data Structures:
```typescript
type UserRepoAccess = {
  userId: string
  repos: Array<{ repoId: Id<"repos">; fullName: string; enabled: boolean }>
  version: number
  computedAt: number
}
```

Error Handling:
- Missing installation repo list → trigger reconciliation job + mark access stale (UI shows warning badge).
- Stale cache detection (version mismatch) → recompute lazily.

## Module: ReportQueryEngine
Responsibility: Fetch canonical events for report generation using repo ACL + actor filters + date windows.

Public Interface:
```typescript
interface ReportQueryEngine {
  getReportEvents(input: {
    userId: string
    ghLogins: string[]
    startDate: number
    endDate: number
  }): Promise<Doc<"events">[]>
  countEvents(...): Promise<number>
  buildCacheKey(args: ReportQueryArgs): string
}
```

Internal Implementation:
- `getReportEvents` steps:
  1. Load `UserRepoAccess` (enabled repos only). If empty → throw `NO_REPO_ACCESS` error for UX.
  2. Resolve `ghLogins` to `users` table IDs. If empty and UI requested "self", default to Clerk user's GitHub login.
  3. Query events index by `repoId` + `ts` (new helper `events.listByReposAndWindow` that batches repo IDs in 100 chunks). Filter by `actorId` ∈ resolved IDs + by `ts` within range.
  4. Enforce coverage count = expected count (mirrors current invariants) before handing to orchestrator.
- `countEvents` uses same filters but only returns numbers for gating token budgets.
- Emits `report.query_ms`, `report.zero_events` metrics for observability.

Dependencies:
- AccessibleRepoService for ACLs.
- `users` table to resolve GitHub logins.
- Existing `reportOrchestrator` for downstream LLM calls.

Data Structures:
```typescript
interface ReportQueryArgs {
  userId: string
  repoIds: Id<"repos">[]
  actorIds: Id<"users">[]
  startDate: number
  endDate: number
}
```

Error Handling:
- Missing ACL or ghLogins → validation error surfaced to UI.
- Event count mismatch → throw (existing retry logic) + emit metric.
- Repo filter produces >5k events → short-circuit with suggestion to narrow ghLogins or enable tracked repos.

## Module: IngestionOrchestrator
Responsibility: Run ingestion/backfill flows using installation scopes, not individual users, while keeping per-user job UX intact.

Public Interface:
```typescript
interface IngestionOrchestrator {
  queueBackfill(params: { installationId: number; userId: string; repos?: string[]; since: number; until?: number }): Promise<Id<"ingestionJobs">>
  continueJob(jobId: Id<"ingestionJobs">): Promise<void>
  fanoutWebhookEvent(envelope: WebhookEnvelope): Promise<void>
}
```

Internal Implementation:
- `queueBackfill` verifies `InstallationClaimService.assertUserHasAccess` before launching.
- Jobs stored in `ingestionJobs` keep both `userId` (requestor) and `installationId`; ingestion writes events once and marks job complete for requestor.
- Rate limit tracking keyed by installation so concurrent requestors coordinate automatically.
- Webhook fanout ensures events are ingested once; downstream users just need ACL to read.

Dependencies:
- InstallationRegistry for tokens + rate limits.
- ClaimService for authorization checks.
- `githubApp` helpers for token minting and timeline fetch.

Data Structures:
```typescript
interface IngestionJobDoc {
  userId: string
  installationId: number
  repoFullName: string
  reposRemaining?: string[]
  status: "pending" | "running" | "blocked" | "completed" | "failed"
  blockedUntil?: number
}
```

Error Handling:
- Unauthorized request → 403 with message referencing claim requirement.
- Rate limit exhaustion → mark job blocked + schedule resume at reset.
- Webhook duplicate detection remains in `webhookEvents` table (unchanged).

## Core Algorithms
### claimInstallation(userId, installationId)
1. Ensure Clerk session + GitHub token exist; if not, throw "connect GitHub" error.
2. Fetch `/user/installations` (paged) until installation located or list exhausted.
3. When found, call `InstallationRegistry.upsert` to refresh metadata.
4. Start Convex transaction:
   - Insert into `userInstallations` unless composite exists.
   - Emit `userInstallation.claimed` metric with `installationId`, `accountLogin`.
   - Schedule `AccessibleRepoService.refreshForUser` via async job.
5. Return hydrated claim (includes repo count + status for UI).

### refreshForUser(userId)
1. Load all `userInstallations` rows for user.
2. Fetch each installation's repo list; if missing, call GitHub `installation/repositories` using app token + store result.
3. Normalize repo names and map to Convex `repos` IDs (create if missing with metadata from GitHub search API for just-in-time descriptions).
4. Merge lists, apply tracked repo overrides, write cache doc with new `version`.
5. Return `UserRepoAccess`; IntegrationStatus uses `version` to determine freshness.

### getReportEvents(userId, ghLogins, range)
1. Access list = `AccessibleRepoService.list(userId, { enabledOnly: true })`.
2. `actorIds` = lookup `users` by ghLogins; // fallback to Clerk-linked login.
3. Break repo IDs into batches of 100, query `events` by `repoId`/`ts` per batch.
4. Filter events to `actorIds`; track counts per actor for coverage metrics.
5. If `trackedRepos` disabled some repos, note in coverage breakdown.
6. Return sorted events and `coverageSummary` to orchestrator.

### queueBackfill(...)
1. Assert claim + `installation.status === active`.
2. Determine repo list: provided override OR union of installation repos OR fallback to `AccessibleRepoService` output.
3. Create `ingestionJobs` row with `installationId`, `userId` for audit.
4. Iterate repos (respect MAX_REPOS per invocation). For each repo:
   - Mint installation token.
   - Pull timeline window.
   - Write events + coverage candidate entries.
   - Update job progress + installation rate limit.
5. If rate limit near exhaustion, set `blockedUntil = reset` and stop; scheduler requeues via `continueJob`.
6. On completion emit `ingestion.completed` metric with repo count and requestor id.

### listAvailableInstallations(userId)
1. Use user's GitHub OAuth token to call `/user/installations`.
2. For each installation, check ClaimService for existing row.
3. Return classification: `{ claimed: true }` vs `{ claimable: true }` vs `{ inaccessible: true }` for UI toggles.

## File Organization
```
convex/
  schema.ts                  # add userInstallations, trackedRepos, userRepoAccess tables
  userInstallations.ts       # queries + mutations for claims
  trackedRepos.ts            # toggles API
  access.ts                  # AccessibleRepoService helpers (new)
  actions/github/
    claimInstallation.ts     # handles OAuth verification + join writes
    startBackfill.ts         # updated to enforce claims + shared budgets
    processWebhook.ts        # now only updates InstallationRegistry, no clerk linkage
  integrations.ts            # integration status pulls from claims + repo cache freshness
  reports.ts                 # new getReportEvents entrypoint returning repo-scoped data
app/dashboard/settings/
  installations/page.tsx     # claim/release UI (new)
  repositories/page.tsx      # uses AccessibleRepoService output + tracked toggles
hooks/
  useInstallationClaims.ts   # client hook for claims + repo access view
lib/
  accessControl.ts           # shared helpers for ACL caching + versioning
  integrationStatus.ts       # statuses updated for claim-driven flow
```

Existing files to update:
- `TASK.md` → reference design after delivery (no code change now).
- `app/dashboard/reports` components (actor selection UI fetches ghLogins defined in claims).
- `convex/actions/github/maintenance.ts` remove clerk linkage, trigger claim audit instead.

## Integration Points
- **Convex schema**: add `userInstallations`, `trackedRepos`, optional `userRepoAccessCache` tables; remove `clerkUserId` column after migration.
- **GitHub APIs**: `GET /user/installations`, `GET /installation/repositories`, `POST /app/installations/{id}/access_tokens`; respect docs requiring short-lived tokens + stored installation IDs.citeturn1search0turn1search1
- **Clerk**: existing JWT auth + `users.updateGitHubAuth` provide access tokens + `clerkId`; ClaimService depends on this state.
- **Environment**: ensure `GITHUB_CLIENT_ID/SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL` configured for UI deep links.
- **Build/Deploy**: Next + Convex remain; run `pnpm build` + `npx convex deploy` once schema extends; Vercel env vars add new tables automatically.
- **Observability integration**:
  - Error tracking: wire Sentry (Next) + Convex log scrapes for ClaimService errors (tag `module=claims`).
  - Structured logging: `emitMetric` for `userInstallation.claimed`, `access.refresh_ms`, `report.query_ms` with correlation IDs.
  - Performance monitoring: track repo-cache refresh latency + report query durations; compare against 5s UI budget.
  - Analytics: track claim funnel events (viewed list, attempted claim, success/failure) for onboarding insights.

## State Management
- **Server**: Convex tables store installations, claims, repo caches, tracked toggles, ingestion jobs. Derived caches keyed by `access:{userId}` versioned to avoid stale reads.
- **Client**: React hooks (`useInstallationClaims`, `useIntegrationStatus`) fetch via Convex; local component state handles filters + toggles only. No client caching beyond React Query semantics from Convex hooks.
- **Cache policy**: repo access cache recomputed on claim change or hourly TTL (configurable). Invalidated via `version` increments consumed by hooks.
- **Concurrency**: `userInstallations` composite index prevents duplicate claims; all claim/release operations wrapped in single Convex mutation to avoid races. AccessibleRepoService uses convex `db.patch` to set version atomically.

## Error Handling Strategy
- **Validation errors**: missing OAuth token, invalid repo selection, duplicate claim; return 400-equivalent response + toast copy.
- **Auth errors**: user without Clerk session or lacking claim → 401/403 surfaces across actions and ingestion.
- **GitHub faults**: map 401/403/404 to actionable UI messages, 429 to retry/backoff; log `rateLimitRemaining` for SLO tracking.
- **Data conflicts**: detection via version mismatches; auto-retry once, else mark cache stale + prompt user to refresh.
- **System faults**: DLQ entry in `webhookEvents`; escalate via pager once error budget exceeded.

## Testing Strategy
- **Unit**: new Convex modules (`userInstallations`, `accessControl`, `reports.getReportEvents`) tested via `convex-test` harness + Jest for pure helpers.
- **Integration**: mock GitHub API via `tests/__mocks__/github.ts` to cover claim + refresh flows.
- **E2E**: Playwright/Next test hitting settings UI to claim + toggle repos.
- **Quality gates**:
  - Pre-commit (lefthook to add) runs `pnpm lint && pnpm typecheck && pnpm format --check` on touched files.
  - Pre-push runs `pnpm exec jest --coverage` plus Convex tests.
  - CI (`claude-code-review`, `enforce-pnpm`) remains; add workflow for lint/typecheck/test matrix before deploy.
  - Coverage thresholds: ≥80% statements for ClaimService + ReportQueryEngine (critical path).

## Performance & Security Notes
- **Load expectations**: 10 installations/user, 100 repos/install → derived repo cache must handle ~1k repos quickly (<2s). Use incremental diff + caching to stay under budget.
- **Latency targets**: claim action <3s (dominated by GitHub API); repo cache refresh <5s; report query <2s before LLM stage.
- **Scaling**: caches per user avoid expensive joins; ingestion still bounded by GitHub rate limits (shared across claimants).
- **Security**:
  - Never store user GitHub access tokens in client; use Convex env or encrypted storage.
  - Claims require GitHub verification each time to prevent spoofing.
  - Rate-limit claim attempts (5/min) via Convex `table` storing attempt timestamps.
  - Secrets live in Convex env + Vercel; rotate via `maintenance.rotateSecrets` hook.
- **Observability requirements**:
  - Performance budget: track Core Web Vitals for settings/reports pages; API SLO 95th percentile <2s for claim/list endpoints.
  - Error budget: <=1% failed claim attempts per day; alert when threshold hit.
  - Monitoring: dashboards for `claims.count`, `access.refresh_ms`, `report.query_ms`, `ingestion.jobs_blocked`.
  - Alerting: fire when webhook backlog >50, rate limit resets <10%, or claim errors spike.
  - Release tracking: annotate deployments (Vercel + Convex) so regressions correlate with release IDs.

## Alternative Architectures Considered
| Option | Pros | Cons | Verdict | Revisit Trigger |
| --- | --- | --- | --- | --- |
| Convex Claim Graph (selected) | Minimal new infra, keeps data near reports, simple migrations | Requires cache invalidation plumbing | ✅ Selected | Revisit if Convex storage costs explode |
| Clerk Org Workspace Layer | Aligns with Clerk multi-tenant APIs, easy to model teams | Adds extra indirection; still need repo ACL join; more UI work | Deferred | If we add org-wide billing + roles per team (align with Clerk org best practices).citeturn2search0 |
| Dedicated Installation Microservice | Can isolate GitHub API traffic, share with other products | New deployable + persistence, higher latency, duplicated schema | Rejected | Only if GitPulse splits into multiple environments needing shared service |
| Event-Scoped Access Lists | Tag every event with installation IDs and filter per user | Complex retrofits, increases write amplification, ambiguous when repo moves installations | Rejected | Consider if GitHub starts enforcing repo-level installation scoping on webhooks |

## Open Questions / Assumptions
- Need product decision on default tracked repo behavior (opt-in vs opt-out) and UI copy for noisy repos.
- Migration detail: do we keep `clerkUserId` shadow column through full rollout for rollback safety? (assume yes until Phase 4).
- Permissions: should non-admin claimants get read-only vs ingestion rights? Proposed `role` column but semantics TBD.
- How many repos can GitHub installation list realistically return? Current API limit ~20k; confirm we can stream and chunk.
- Webhook security review: do we need to revalidate claims whenever webhook indicates org membership change?

## Validation Pass
- Interfaces hide GitHub + Convex specifics; callers get simple `claim`, `list`, `getReportEvents` APIs.
- Vocabulary shifts per layer (installations → claims → repos → reports) so no shallow pass-throughs.
- Dependencies explicit: join service depends on GitHub + Clerk, report engine depends on ACL + users.
- Pseudocode covers every hot path (claim, refresh, report, ingestion, listing) with branching spelled out.
- Risks + observability + testing documented along with rollback/migration notes.
