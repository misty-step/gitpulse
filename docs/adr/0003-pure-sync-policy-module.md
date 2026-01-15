# 0003 – Pure Sync Policy Module

## Status
Accepted

## Context
Sync request logic was scattered across `githubIngestionService.ts` and `continuousSync.ts`, mixing I/O operations with business rules. Testing required complex mocks, and changes risked hidden side effects. The policy had multiple interacting concerns:
- Manual sync cooldown (1 hour between requests)
- Stale data bypass (48h threshold overrides cooldown)
- Rate limit budget reservation (webhooks need headroom)
- Recovery trigger bypass (auto-healing should bypass user throttles)

Alternatives considered:
1. **Keep policy inline with I/O**: Simpler initially, but testing requires full integration mocks. Changes amplify across files.
2. **Extract policy to config**: Too rigid—policy logic involves conditionals that config can't express.
3. **Pure decision engine**: Zero I/O function that takes state + trigger + timestamp, returns deterministic decision.

## Decision
Create `convex/lib/syncPolicy.ts` as a pure decision engine:
- `evaluate(state: InstallationState, trigger: SyncTrigger, now: number) → SyncDecision`
- All policy constants exported and documented (MIN_SYNC_BUDGET, WEBHOOK_BUDGET_RESERVE, etc.)
- Decision includes action (start/skip/block), reason enum, and metadata
- Helper `reasonToUserMessage()` centralizes user-facing strings

SyncTrigger variants: `manual | cron | webhook | maintenance | recovery`
- Recovery trigger bypasses cooldown for self-healing sync operations

## Consequences
**Benefits:**
- 48 unit tests with zero mocks—pure functions are trivially testable
- Policy changes isolated to one file with clear test coverage
- UI/orchestrator gets decision + reason without re-implementing policy
- Recovery syncs can bypass user-facing throttles safely

**Tradeoffs:**
- Requires callers to load state before calling `evaluate()`
- State interface (`InstallationState`) must be kept in sync with schema
- Adds vocabulary layer (decision types) that all callers must understand

**Design principle:**
Deep module: complex policy hidden behind simple `evaluate()` interface. Callers don't know about cooldown math, budget calculations, or bypass logic.
