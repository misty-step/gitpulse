# TODO

## Phase 1 · Data + Services Core
- [x] Extend Convex schema for multi-claim tables
  ```
  Files: convex/schema.ts, convex/_generated/* (via `npx convex codegen`), convex/lib/types.ts
  Goal: Add `userInstallations`, `trackedRepos`, `userRepoAccessCache` tables + indexes; keep `clerkUserId` column but mark deprecated for Phase 4.
  Success: Convex deploy succeeds; tables enforce composite uniqueness; schema docstrings describe migration path; generated types used by later modules.
  Tests: `pnpm typecheck` (schema), `pnpm exec jest tests/utils/convexSchema.test.ts` (update fixtures if exist).
  Dependencies: none.
  Estimate: 1.5h
  ```

- [ ] Implement `convex/userInstallations.ts` CRUD + audit hooks
  ```
  Files: convex/userInstallations.ts (new), convex/lib/metrics.ts (emit `userInstallation.*`), convex/_generated/api.ts
  Goal: Provide list/claim/release/assert helpers per DESIGN §InstallationClaimService.
  Success: Mutations validate Clerk session + enforce uniqueness; queries hydrate installation metadata; metrics fire on claim/release.
  Tests: Add Jest/Convex tests under convex/lib/__tests__/userInstallations.test.ts covering claim happy path, duplicate, unauthorized.
  Dependencies: Extend schema.
  Estimate: 1.5h
  ```

- [ ] Build `trackedRepos` + `accessControl` services
  ```
  Files: convex/trackedRepos.ts (new), convex/lib/accessControl.ts (new), convex/lib/__tests__/accessControl.test.ts
  Goal: Implement AccessibleRepoService (refresh/list/setTrackedRepo) using cache table + tracked repo toggles.
  Success: Refresh recomputes repo set, applies overrides, bumps version; setters debounce writes; exported helpers consumed by UI + report queries.
  Tests: Unit tests for merge logic + cache invalidation; integration test using Convex fake ctx verifying recompute triggered on version mismatch.
  Dependencies: Schema + userInstallations service.
  Estimate: 2h
  ```

- [ ] Retrofit installation registry + maintenance flows
  ```
  Files: convex/installations.ts, convex/actions/github/maintenance.ts, convex/actions/github/processWebhook.ts, convex/actions/github/startBackfill.ts (token metadata), convex/integrations.ts
  Goal: Remove writes to `clerkUserId`, ensure repository updates emit `installation.updated` metric + notify access cache; keep read-only shadow for migration diagnostics.
  Success: Webhooks + recon jobs only mutate installation metadata; log statements reference claims; lint/tests pass.
  Tests: Update existing webhook tests (if absent create) to assert `clerkUserId` untouched; add unit verifying maintenance job emits metric.
  Dependencies: userInstallations service (for notifications reference) optional but not hard.
  Estimate: 1.5h
  ```

## Phase 2 · Claim + Access APIs
- [ ] Add GitHub-verified claim/release actions
  ```
  Files: convex/actions/github/claimInstallation.ts (new), convex/actions/github/releaseInstallation.ts (new), convex/actions/github/index export, convex/lib/github.ts (helpers for /user/installations), app/api/github/installations/route.ts (if HTTP endpoint needed)
  Goal: Implement mutation flow from DESIGN pseudocode including OAuth token requirement, GitHub verification, audit metric.
  Success: Action rejects when token missing/mismatch; automatically reconciles installation record; returns hydrated claim.
  Tests: Mock GitHub API via tests/mocks/github.ts; add action tests for success, forbidden, duplicate.
  Dependencies: userInstallations + installation registry.
  Estimate: 2h
  ```

- [ ] Wire AccessibleRepoService into ingestion + integration status
  ```
  Files: convex/actions/github/startBackfill.ts, convex/actions/github/ingestMultiple.ts, convex/ingestionJobs.ts, convex/integrations.ts, hooks/useIntegrationStatus.ts
  Goal: Backfill authorization uses `assertUserHasAccess`; IntegrationStatus surfaces claim count + cache freshness + missing-claim warnings.
  Success: Unauthorized requests fail fast; IntegrationStatus variants updated (new kinds for `no_claims`, `stale_access_cache`).
  Tests: Jest tests for new status mapper; Convex action tests for unauthorized queue attempt; update client hook test snapshot.
  Dependencies: claim/release actions + access service.
  Estimate: 1.5h
  ```

- [ ] Upgrade report query engine to repo-scoped filters
  ```
  Files: convex/reports.ts, convex/events.ts (new `listByReposAndWindow`), convex/lib/reportOrchestrator.ts (call new query helper), convex/lib/__tests__/reportQueryEngine.test.ts
  Goal: `getReportEvents` uses repo ACL + actor filters, enforces coverage + 5k event guard, updates metrics names.
  Success: Manual report generation works for multi-claim users; old actor-only path removed.
  Tests: Unit tests for query helper; orchestrator tests verifying `NO_REPO_ACCESS` path + event gating.
  Dependencies: access service.
  Estimate: 2h
  ```

## Phase 3 · Product Surfaces
- [ ] Build installation management UI
  ```
  Files: app/dashboard/settings/installations/page.tsx (new), app/dashboard/settings/page.tsx (link), hooks/useInstallationClaims.ts (new), components/InstallationClaimCard.tsx (new), lib/integrationStatus.ts (helper strings)
  Goal: UI lists claimed + claimable installations, provides claim/release buttons, surfaces errors.
  Success: Page loads via Convex queries; claim flow uses action, shows toast + refresh; release removes card.
  Tests: React Testing Library test for hook (mock convex client), Playwright smoke to claim+release stub installation.
  Dependencies: claim actions.
  Estimate: 2h
  ```

- [ ] Extend repositories settings with tracked toggles
  ```
  Files: app/dashboard/settings/repositories/page.tsx, components/IntegrationStatusBanner.tsx (messages), lib/accessControlClient.ts (new helper), hooks/useRepoAccess.ts (new)
  Goal: Show derived repo list (enabled/disabled), allow toggling tracked state, surface cache staleness banner.
  Success: Toggle writes `trackedRepos` entry, optimistic UI, respects version updates.
  Tests: Component unit tests for toggle handler; Playwright scenario verifying repo disable hides events in report.
  Dependencies: access service, reports update.
  Estimate: 1.5h
  ```

- [ ] Refresh integration + onboarding copy
  ```
  Files: app/onboarding/page.tsx, app/dashboard/reports/page.tsx (empty states), README.md (multi-account section), TASK.md (phase progress), DESIGN.md (link to task status note)
  Goal: Update copy + support info to reflect claiming installations vs single owner.
  Success: Strings mention "claimed installations"; README steps include claim UI screenshot placeholder; docs lint passes.
  Tests: Snapshot/update unit tests for onboarding (if present) otherwise manual verification.
  Dependencies: UI tasks.
  Estimate: 1h
  ```

## Phase 4 · Infra, Observability, QA
- [ ] Instrument observability + security hooks
  ```
  Files: convex/lib/metrics.ts (new names: `claims.count`, `access.refresh_ms`, `report.query_ms`), app/providers.tsx (Sentry init), lib/logger.ts (if needed), .env.example/.env.local.example (SENTRY_DSN), convex/actions/github/processWebhook.ts (structured logs)
  Goal: Ensure claim/access/report flows emit metrics + optional Sentry instrumentation per DESIGN.
  Success: Metrics log payloads include correlation IDs; Sentry only initialized client-side when key present; secrets not logged.
  Tests: Unit tests verifying emitMetric called; manual run capturing log sample.
  Dependencies: prior modules instrumented.
  Estimate: 1h
  ```

- [ ] Establish quality gates (lefthook + CI)
  ```
  Files: .lefthook.yml (new), package.json scripts (add `test:convex`), .github/workflows/ci.yml (new or extend), docs/CONTRIBUTING.md (if exists)
  Goal: Pre-commit runs lint/typecheck/format; pre-push runs jest+convex tests; CI matrix enforces same.
  Success: Hooks run locally; CI green on happy path; README references new commands.
  Tests: `lefthook run pre-commit`, GitHub workflow dry run via `act` optional.
  Dependencies: none (but align with new scripts before PR).
  Estimate: 1h
  ```

- [ ] QA + regression sweep before PR
  ```
  Files: n/a (execution task)
  Goal: Execute `/prompts:quality-check`, `/prompts:observe`, `/prompts:aesthetic` for UI, `/prompts:qa-cycle`, run `pnpm lint && pnpm typecheck && pnpm exec jest && pnpm build && pnpm reports:generate -- --dry-run`.
  Success: All commands green; captured notes in PR description (coverage %, screenshots of new UI).
  Tests: commands themselves.
  Dependencies: all implementation tasks.
  Estimate: 1h
  ```

## Open Questions
- ? Default tracked repo state (opt-out vs opt-in) impacts `AccessibleRepoService` heuristics — need product guidance before toggles task (owner: PM, due before Phase 3 tasks).
- ? Migration of historical `clerkUserId` links: confirm whether to auto-claim existing installations during Phase 1 (owner: backend lead).
