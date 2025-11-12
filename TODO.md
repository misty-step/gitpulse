# TODO: 100% Coverage Reports (Pragmatic MVP)

**Reference**: TASK.md (PRD v2.0)
**Timeline**: 7 days total
**Branch**: `feat/exhaustive-coverage`

---

## Context

**Architecture**: Single-pass exhaustive retrieval with deterministic generation
- **Key Modules**: Event Query Service, LLM Client, Report Orchestrator, Coverage Validator
- **Key Files**: `convex/events.ts`, `convex/lib/LLMClient.ts`, `convex/lib/reportOrchestrator.ts`, `convex/lib/coverage.ts`, `convex/lib/reportContext.ts`
- **Patterns**: Follow existing Jest tests in `convex/lib/__tests__/`, use Convex query/mutation patterns from `convex/events.ts`

**Current State** (from research):
- ✅ Content-hash deduplication at ingestion
- ✅ Cache key infrastructure exists (inactive)
- ✅ Coverage schema (`coverageCandidates` table) exists (unpopulated)
- ❌ Truncation at 2000 events fetch, 80/140 timeline
- ❌ Non-deterministic generation (temp=0.3-0.4)
- ❌ No cache pre-check
- ❌ No fail-closed validation

---

## Implementation Tasks

### Phase 1: Exhaustive Event Retrieval (2 days)

- [x] **Implement `listByActorComplete()` with cursor pagination**
  ```
  File: convex/events.ts (add new export after line 45)

  Module: Event Query Service
  Interface: listByActorComplete(ctx, actorId, startDate, endDate) → AsyncGenerator<EventDoc[]>
  Hides: Cursor pagination logic, batch sizing (100 docs/batch), isDone tracking
  Exposes: Generator yielding complete event set

  Implementation Pattern:
  - Use Convex .paginate({ cursor, numItems: 100 })
  - Yield batch.page on each iteration
  - Track cursor = batch.continueCursor
  - Stop when batch.isDone === true

  Success Criteria:
  - Generator yields all events matching filters (no truncation)
  - Cursor stability: concurrent writes don't break traversal
  - Test with 5000-event fixture → all 5000 retrieved

  Test Strategy:
  - Unit test: Mock ctx.db.query().paginate() with 3 pages
  - Verify all pages yielded, cursor progression
  - Integration test: Real Convex DB with 500+ events

  Dependencies: None (independent task)
  Time: 1 day (6 hours impl + 2 hours testing)
  ```

- [x] **Add `countByActor()` pre-count query**
  ```
  File: convex/events.ts (add after listByActorComplete)

  Module: Event Query Service
  Interface: countByActor(ctx, actorId, startDate, endDate) → number
  Hides: Count aggregation logic
  Exposes: N_expected for validation

  Implementation Pattern:
  - Use same index as listByActorComplete: by_actor_and_ts
  - Apply same filters (startDate, endDate)
  - Return .length of collected results (Convex doesn't have .count())

  Success Criteria:
  - Returns exact count of matching events
  - Count matches manual verification

  Test Strategy:
  - Unit test: Verify count matches .collect().length
  - Integration test: countByActor() == listByActorComplete() total

  Dependencies: None
  Time: 2 hours
  ```

- [x] **Write tests for exhaustive retrieval**
  ```
  File: convex/lib/__tests__/eventQueries.test.ts (new file)

  Test Cases:
  1. Empty result set → generator yields nothing, isDone immediately
  2. Single page (< 100 events) → one yield, isDone
  3. Multi-page (500 events) → 5 yields, all events present, no duplicates
  4. Concurrent writes during pagination → stable cursor, no skips
  5. countByActor() matches generator total

  Pattern: Follow convex/lib/__tests__/coverage.test.ts structure

  Success: All tests pass, 100% branch coverage
  Time: 4 hours
  ```

---

### Phase 2: Deterministic LLM Generation (1 day)

- [x] **Add deterministic config to LLMClient**
  ```
  File: convex/lib/LLMClient.ts (modify lines 60-76)

  Module: LLM Client
  Interface: (no interface change, config update)
  Hides: Gemini API temperature parameter, sampling config
  Exposes: Deterministic generation for report task types

  Changes:
  1. Update constructor default: temperature: config.temperature ?? 0.3
     → Keep 0.3 default for non-report tasks

  2. Add method: setDeterministic() → sets temperature=0
     OR create separate config factory: createReportLLMClient() → temp=0

  3. Update createLLMClient() helper (line 318-350):
     - For taskType "daily" | "weekly": set temperature=0 (was 0.3/0.4)
     - Document: "Deterministic for cache reliability"

  Success Criteria:
  - Daily/weekly reports use temperature=0
  - Other tasks (complex) unchanged
  - Tests verify config values

  Test Strategy:
  - Unit test: createLLMClient("daily") → temperature === 0
  - Integration test: Same prompt twice → byte-identical output

  Dependencies: None
  Time: 2 hours
  ```

- [x] **Add Gemini JSON Schema support**
  ```
  File: convex/lib/LLMClient.ts (new method)

  Module: LLM Client
  Interface: generateStructured<T>(payload, schema, options?) → T
  Hides: Gemini response_schema, response_mime_type parameters, validation
  Exposes: Type-safe structured output

  Implementation:
  - Add Zod schema parameter (not Pydantic, since we're in Node.js)
  - Convert Zod schema to JSON Schema for Gemini API
  - Set response_mime_type: "application/json"
  - Set response_schema: jsonSchema
  - Parse response.text, validate with Zod
  - Return typed object

  Success Criteria:
  - Output validates against provided schema
  - Invalid output throws validation error

  Test Strategy:
  - Unit test: Mock Gemini response, verify Zod validation
  - Integration test: Real Gemini call with schema

  Dependencies: Install zod if not present (check package.json)
  Time: 4 hours
  ```

- [x] **Define ReportSchema for structured outputs**
  ```
  File: convex/lib/reportSchemas.ts (new file)

  Export Zod schemas for:
  - DailyReportSchema: { sections, citations, metadata }
  - WeeklyReportSchema: (similar structure)
  - CitationSchema: { url, context }

  Pattern: Follow existing type definitions in convex/_generated/dataModel.ts

  Success: Schemas compile, match current report structure
  Time: 2 hours
  ```

- [x] **Write tests for deterministic generation**
  ```
  File: convex/lib/__tests__/LLMClient.test.ts (extend existing or create)

  Test Cases:
  1. temperature=0 → same input produces same output (run 3x)
  2. Structured output validates against schema
  3. Invalid JSON → validation error
  4. Schema mismatch → clear error message

  Success: All tests pass
  Time: 2 hours
  ```

---

### Phase 3: Cache Activation (1 day)

- [x] **Add cache pre-check to generateReportForUser()**
  ```
  File: convex/lib/reportOrchestrator.ts (modify lines 28-100)

  Module: Report Orchestrator
  Interface: (no change, internal optimization)
  Hides: Cache lookup logic, cacheKey computation
  Exposes: Transparent caching (caller doesn't know if cache hit)

  Changes:
  1. Move cacheKey computation earlier (currently line 93)
     → Compute BEFORE LLM call

  2. Add cache lookup:
     ```typescript
     const cacheKey = buildCacheKey(kind, params.userId, startDate, endDate, events);

     // Check cache BEFORE generation
     const cached = await ctx.runQuery(internal.reports.getByCacheKey, { cacheKey });
     if (cached) {
       emitMetric({ name: "report.cache_hit", cacheKey, latency_ms: 0 });
       return cached._id;
     }
     ```

  3. Add internal query: getByCacheKey()
     File: convex/reports.ts
     Query reports.by_cacheKey index (already exists in schema)

  Success Criteria:
  - First generation: cache miss, LLM called
  - Second generation (same inputs): cache hit, <5s response
  - Changed event: cache miss (new contentHashAgg)

  Test Strategy:
  - Integration test: Generate twice, verify second is cache hit
  - Unit test: Mock ctx.runQuery, verify cache lookup logic

  Dependencies: Phase 1 (needs exhaustive events for contentHashAgg)
  Time: 4 hours
  ```

- [x] **Add cache hit metrics**
  ```
  File: convex/lib/reportOrchestrator.ts

  Add emitMetric() calls:
  - Cache hit: { name: "report.cache_hit", cacheKey, latency_ms }
  - Cache miss: { name: "report.cache_miss", cacheKey }

  Pattern: Follow existing emitMetric() usage in reportOrchestrator.ts

  Success: Metrics logged to Convex, visible in dashboard
  Time: 1 hour
  ```

- [x] **Write cache activation tests**
  ```
  File: convex/lib/__tests__/reportOrchestrator.test.ts (extend)

  Test Cases:
  1. Cache miss → LLM called, report generated
  2. Cache hit → LLM NOT called, report returned instantly
  3. ContentHashAgg change → cache miss (new key)
  4. Metrics emitted correctly (hit vs miss)

  Success: All tests pass, cache behavior verified
  Time: 3 hours
  ```

---

### Phase 4: Coverage Validation (2 days)

- [x] **Add `validateCoverage()` function**
  ```
  File: convex/lib/coverage.ts (add after computeCoverageSummary)

  Module: Coverage Validator
  Interface: validateCoverage(events, report, threshold=0.95) → ValidationResult
  Hides: Citation extraction, threshold comparison, error formatting
  Exposes: Pass/fail verdict with diagnostics

  Implementation:
  - Extract citations from report.content (markdown links)
  - Compute coverage: N_cited / N_events
  - If coverage < threshold: throw Error with diagnostics
  - Return: { pass: true, score, breakdown } or throw

  Success Criteria:
  - Coverage ≥ 0.95: pass, return summary
  - Coverage < 0.95: throw with clear error message
  - Breakdown shows per-repo coverage

  Test Strategy:
  - Unit test: Mock events + citations
    - 100 events, 96 cited → pass
    - 100 events, 94 cited → throw
  - Edge case: 0 events → pass (trivial coverage)

  Dependencies: None (pure function)
  Time: 4 hours
  ```

- [x] **Integrate validation into generateReportForUser()**
  ```
  File: convex/lib/reportOrchestrator.ts (modify after LLM generation)

  Changes:
  1. After LLM generation (line 78), before saving report:
     ```typescript
     // Validate coverage (fail closed)
     const validation = validateCoverage(events, generated, 0.95);

     if (!validation.pass) {
       emitMetric({ name: "report.coverage_failed", userId, score: validation.score });
       throw new Error(`Coverage too low: ${validation.score.toFixed(2)} < 0.95`);
     }
     ```

  2. Store validation result in report metadata:
     - Add coverage field to report insert: coverage: validation

  Success Criteria:
  - Low coverage report → generation fails with error
  - High coverage report → saved with validation metadata
  - Error message actionable (shows which events missing)

  Test Strategy:
  - Integration test: Mock LLM to return low-coverage output → verify throw
  - Integration test: Normal output → verify pass + metadata stored

  Dependencies: Phase 1 (needs all events), Phase 2 (needs LLM)
  Time: 4 hours
  ```

- [x] **Add N_seen validation**
  ```
  File: convex/lib/reportOrchestrator.ts (add after Phase 1 pagination)

  Implementation:
  1. After collecting all events via listByActorComplete():
     ```typescript
     const N_expected = await ctx.runQuery(api.events.countByActor, { actorId, startDate, endDate });
     const N_seen = events.length;

     if (N_seen !== N_expected) {
       throw new Error(`Event count mismatch: expected ${N_expected}, saw ${N_seen}`);
     }
     ```

  Success Criteria:
  - N_seen == N_expected: proceed
  - N_seen != N_expected: throw before LLM call

  Test Strategy:
  - Mock count mismatch → verify throw
  - Normal case → verify no throw

  Dependencies: Phase 1 (count + pagination)
  Time: 2 hours
  ```

- [ ] **Write coverage validation tests**
  ```
  File: convex/lib/__tests__/coverage.test.ts (extend)

  Test Cases:
  1. validateCoverage() with 96% → pass
  2. validateCoverage() with 94% → throw with details
  3. N_seen == N_expected → no error
  4. N_seen != N_expected → throw before LLM
  5. Coverage metadata stored in report

  Success: All tests pass
  Time: 4 hours
  ```

---

### Phase 5: Remove Timeline Limits (1 day)

- [ ] **Remove maxTimelineEvents from buildReportContext()**
  ```
  File: convex/lib/reportContext.ts (modify function signature + logic)

  Module: Report Context Builder
  Interface: buildReportContext({ events, reposById, startDate, endDate }) (remove maxTimelineEvents param)
  Hides: (no change, already hides event normalization)
  Exposes: Context for ALL events (no truncation)

  Changes:
  1. Remove maxTimelineEvents parameter from function signature
  2. Remove .slice(0, maxTimelineEvents) truncation (line ~70)
  3. Update JSDoc: document that all events are included

  Success Criteria:
  - 200-event day → all 200 in timeline (not 80)
  - Stats match timeline (no inconsistency)
  - Timeline length == events.length

  Test Strategy:
  - Unit test: 200 events → context.timeline.length === 200
  - Integration test: Verify stats (byType, repos) computed over all events

  Dependencies: Phase 1 (needs exhaustive events)
  Time: 2 hours
  ```

- [ ] **Update reportOrchestrator to pass all events**
  ```
  File: convex/lib/reportOrchestrator.ts (modify buildReportContext call)

  Changes:
  1. Remove DAILY_TIMELINE_LIMIT, WEEKLY_TIMELINE_LIMIT constants (lines 25-26)
  2. Remove maxTimelineEvents calculation (lines 56-57)
  3. Update buildReportContext() call (line 59):
     - Remove maxTimelineEvents parameter
     - Pass all events directly

  Success Criteria:
  - No artificial caps in orchestrator
  - All events passed to context builder

  Test Strategy:
  - Integration test: 150-event daily report → all 150 in context

  Dependencies: Above task (context builder updated)
  Time: 1 hour
  ```

- [ ] **Update tests to reflect no limits**
  ```
  File: convex/lib/__tests__/reportContext.test.ts (update expectations)

  Changes:
  - Remove tests that verify truncation behavior
  - Update tests to expect full event set
  - Add test: 200 events → 200 in timeline

  Success: All tests pass
  Time: 2 hours
  ```

- [ ] **Add token budget warning**
  ```
  File: convex/lib/reportOrchestrator.ts (add before LLM call)

  Implementation:
  1. Estimate token count: events.length * 50 (avg tokens/event)
  2. If > 400k tokens: console.warn() with recommendation
  3. If > 475k tokens: throw (approaching 500k limit)

  Success Criteria:
  - 8k events (400k tokens) → warning logged
  - 9.5k events (475k tokens) → error thrown

  Test Strategy:
  - Unit test: Mock large event set → verify warning/error

  Dependencies: Phase 1 (has all events)
  Time: 2 hours
  ```

---

## Design Iteration Checkpoints

**After Phase 1-2**: Review module boundaries
- Is Event Query Service interface clean? (just generator, no leakage)
- Is LLM Client hiding complexity? (caller doesn't see temp/schema details)

**After Phase 3-4**: Review coupling
- Does cache activation require tight coupling to orchestrator? (yes, acceptable)
- Does coverage validation tightly couple to report structure? (check abstraction)

**After Phase 5**: Review completeness
- Are all truncation points removed? (verify no .slice(), .take(limit))
- Are all fail-closed checks in place? (N_seen, coverage)

---

## Testing Strategy Summary

**Unit Tests** (fast, isolated):
- `eventQueries.test.ts`: Pagination generator logic
- `LLMClient.test.ts`: Deterministic config, schema validation
- `coverage.test.ts`: Validation threshold logic

**Integration Tests** (slower, real Convex DB):
- `reportOrchestrator.test.ts`: End-to-end report generation
  - Cache hit/miss behavior
  - Coverage validation integration
  - N_seen validation

**Manual Testing** (production-like):
- Generate report with 5000 events (your actual data)
- Verify all events included (spot-check)
- Verify cache hit on second run (<5s)
- Verify coverage score ≥ 0.95

---

## Success Criteria (Launch Checklist)

- [ ] 10k-event test case: all events included, coverage ≥ 0.95
- [ ] Deterministic cache: same input → same output, cache hit <5s
- [ ] Fail-closed: N_seen ≠ N_expected → error thrown
- [ ] No breaking changes: existing reports still work (backward compat)
- [ ] Cost < $0.05/report for 10k events (monitor via metrics)
- [ ] All tests pass: `pnpm test`
- [ ] Type check: `pnpm typecheck`
- [ ] Lint: `pnpm lint`

---

## Dependencies & Blockers

**External**:
- None (all dependencies already in place)

**Internal** (task order):
- Phase 3 depends on Phase 1 (needs exhaustive events for cache key)
- Phase 4 depends on Phase 1 (needs all events for validation)
- Phase 5 depends on Phase 1 (needs exhaustive retrieval before removing limits)

**Parallel Work**:
- Phase 1 + Phase 2 can run concurrently (independent modules)
- Phase 3 + Phase 4 can start once Phase 1 done
- Phase 5 can run after Phase 1-3 complete

---

## Automation Opportunities

**Identified for future**:
- Automated cache invalidation on event patch (rare, manual for now)
- Automated token count estimation (add if we see overflows)
- Coverage threshold tuning (A/B test 0.90 vs 0.95 vs 0.98)

**Not automating yet** (premature):
- Map-reduce batching (deferred to BACKLOG.md)
- Merkle tree generation (deferred to BACKLOG.md)

---

## Notes

**Module Value Check**:
- Event Query Service: High value (hides pagination complexity), simple interface (just generator)
- LLM Client: High value (hides provider logic), simple interface (generate methods)
- Coverage Validator: Medium value (threshold check is simple), acceptable interface

**No Shallow Modules**: All modules transform data (not just pass-through)

**Testability**: All modules testable in isolation (minimal mocking needed)

**Coupling**: Orchestrator couples to all modules (acceptable—it's the coordinator)
