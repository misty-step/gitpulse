# BACKLOG: Deferred Features for 100% Coverage Reports

**Context**: This document captures features from the original TASK.md v1 specification (map-reduce, Merkle trees, overflow protocols) that were intentionally deferred from the pragmatic MVP. These features provide additional guarantees and scalability but add complexity beyond current needs.

**Current Scope**: Single power user with <10k events/week
**Future Scope**: Multi-user platform with 100k+ events/day, compliance requirements

---

## Feature 1: Map-Reduce Batching Pipeline

**Problem**: Single LLM calls hit token limits beyond 10-20k events (>500k tokens input).

**Solution**: Transform report generation into multi-stage pipeline:
1. **MAP**: Process events in 300-800 event batches, extract structured facts
2. **REDUCE**: Aggregate facts in deterministic code (counts, groupings)
3. **NARRATE**: LLM generates narrative from compact aggregations

**Triggers**:
- Users exceed 20k events/week consistently
- Token overflow warnings (>400k input tokens)
- Latency degradation (>30s p95)

**Effort**: ~2 weeks (major refactor)

**Benefits**:
- Scales to 100k+ events
- Sub-10s latency via parallel map batches
- Lower cost per event (batch API 50% discount)

**Design Notes**:
- Use Convex scheduled functions for map batches
- Store intermediate results in `batchExecutions` table
- Deterministic reducer: pure functions, no LLM calls

**Reference**: TASK.md v1, sections 2-5 (Context assembly, Overflow protocols)

---

## Feature 2: Merkle Trees & Coverage Receipts

**Problem**: No cryptographic proof that all events were processed—trust-based verification.

**Solution**: Generate machine-verifiable receipts for each report:
- **Merkle tree** over event contentHashes (proves no insertion/deletion)
- **Receipt schema**: `{ expected, seen, missing_ids[], merkle_root, timestamp }`
- **Audit trail**: Store receipts in `reportReceipts` table, link to reports

**Triggers**:
- Compliance/audit requirements (time tracking, billable hours)
- Multi-user enterprise deployment
- Need for external verification (share receipts with stakeholders)

**Effort**: ~1 week

**Benefits**:
- Provable completeness (no "trust me" arguments)
- Efficient partial validation (Merkle proof)
- Tamper detection (receipt hash mismatch)

**Design Notes**:
- Use `crypto.subtle.digest()` for SHA-256 hashing
- Store Merkle root with report
- Add `/api/verify-receipt` endpoint for external validation

**Reference**: TASK.md v1, section 7 (Coverage receipts)

---

## Feature 3: Overflow Detection & Batch Splitting

**Problem**: LLM may truncate output silently if batch exceeds context window.

**Solution**:
- Prompt LLM to return `OVERFLOW` token if it detects incomplete processing
- Orchestrator detects overflow, halves batch size, retries
- Enforce `n_output == n_input` schema validation

**Triggers**:
- Token overflow errors from Gemini API
- Reports with suspiciously low coverage (<0.90)
- Events with very long text (>5k characters)

**Effort**: ~3 days

**Benefits**:
- Graceful degradation (no silent failures)
- Automatic recovery via batch splitting
- Clear error messages to user

**Design Notes**:
- Add `OVERFLOW` detection to LLM response parsing
- Exponential backoff: 800 → 400 → 200 → 100 events/batch
- Max 3 splits (fail if 100-event batch overflows)

**Reference**: TASK.md v1, section 5 (Overflow protocols)

---

## Feature 4: Hierarchical Summarization

**Problem**: Weekly reports over 7 days × 2000 events = 14k events, slow generation.

**Solution**:
- Generate daily micro-reports (summaries)
- Weekly report aggregates 7 daily summaries (not raw events)
- Preserves citations by linking to daily reports

**Triggers**:
- Weekly report latency >30s consistently
- Users with >10k events/week
- Multi-week retrospective requests

**Effort**: ~1 week

**Benefits**:
- Faster weekly generation (7 summaries << 14k events)
- Reuses daily report cache
- Layered abstraction (day → week → month)

**Design Notes**:
- Store daily summaries in `dailySummaries` table
- Weekly generator queries summaries, not raw events
- Citations link to daily reports for drill-down

**Reference**: TASK.md v1, section 2 (Context assembly, Multi-pass compaction)

---

## Feature 5: Deterministic Field Extraction (Lossless Compaction)

**Problem**: Events with very long text (commit messages >1k chars) bloat token budget.

**Solution**:
- Pre-compute normalized surrogates: `(event_id, sentence_id, normalized_sentence)`
- LLM sees compact bullets, not raw text
- Preserve pointers for audit (can reopen original text)

**Triggers**:
- Events with >1k character text fields
- Token budget warnings
- Need for verbatim citation display

**Effort**: ~5 days

**Benefits**:
- 50-70% token reduction for verbose events
- Lossless (no information deleted)
- Audit trail preserves original text

**Design Notes**:
- Use sentence tokenization (NLP library)
- Store mappings in `eventSentences` table
- Link sentences → events for drill-down

**Reference**: TASK.md v1, section 6 (Context compaction)

---

## Feature 6: QA & Reconciliation Checks

**Problem**: No validation that aggregated stats match source of truth.

**Solution**:
- **Schema checks**: Validate all required fields present
- **Range checks**: Timestamps in window, counts ≥ 0
- **Metric balancing**: Sum of parts == total (e.g., by_repo counts == total events)
- **Reconciliation**: Query DB for ground-truth counts, compare to reducer output

**Triggers**:
- Data integrity incidents (wrong counts reported)
- Compliance requirements (SOC 2, audit trails)
- Debugging coverage mismatches

**Effort**: ~3 days

**Benefits**:
- Early detection of bugs/corruption
- Confidence in aggregate statistics
- Audit-friendly (reconciliation logs)

**Design Notes**:
- Add `qaChecks()` function to orchestrator
- Log reconciliation results to `reportAuditLog` table
- Fail closed if any check fails

**Reference**: TASK.md v1, section 8 (QA stage in state machine)

---

## Feature 7: Evaluation Harness & Golden Tests

**Problem**: No automated tests for end-to-end report generation correctness.

**Solution**:
- **Synthetic corpora**: Fixtures with known event counts, edge cases
- **Golden receipts**: Store expected outputs (counts, hashes, coverage)
- **CI integration**: Fail if generated report deviates from golden

**Triggers**:
- Regression in production (incorrect reports)
- Prompt engineering changes (need to validate no breaking changes)
- Pre-merge validation for report changes

**Effort**: ~5 days (initial setup) + ongoing maintenance

**Benefits**:
- Catch regressions before deployment
- Safe prompt experimentation (A/B test with validation)
- Confidence in refactors

**Design Notes**:
- Store golden fixtures in `tests/fixtures/reports/`
- Use `vitest` snapshots for structured output
- Add `pnpm test:reports` script to CI

**Reference**: TASK.md v1, section 10 (Evaluation harness)

---

## Feature 8: Multi-Pass Prompt Chaining (State Machine)

**Problem**: Single prompt tries to do extraction + aggregation + narrative in one shot.

**Solution**: Explicit state machine orchestration:
- **DISCOVER** → **COUNT** → **MAP_BATCHES** → **REDUCE** → **QA** → **NARRATE** → **VERIFY** → **PUBLISH**
- Each stage has clear inputs/outputs
- Intermediate results stored for debugging

**Triggers**:
- Need for fine-grained observability (which stage failed?)
- Prompt engineering complexity (single prompt too large)
- Want to reuse extraction across multiple report types

**Effort**: ~2 weeks

**Benefits**:
- Clear failure isolation (know exactly which stage broke)
- Reusable extraction pipeline (share across daily/weekly)
- Observable intermediate states

**Design Notes**:
- Use Convex actions for each stage
- Store state in `reportExecutions` table (FSM tracker)
- Add state visualization in dashboard

**Reference**: TASK.md v1, section 8 (Chaining blueprint)

---

## Feature 9: Late-Binding Enrichment

**Problem**: Joining metadata (user profiles, repo details) before LLM inflates token budget.

**Solution**:
- Extract facts from raw events first (no joins)
- Aggregate in reducer
- Join enrichment metadata **after** aggregation (before narrative)

**Triggers**:
- Token overflow from verbose metadata
- Need for dynamic enrichment (user preferences, localization)

**Effort**: ~4 days

**Benefits**:
- Lower token usage (enrich only aggregated rows)
- Flexibility (swap enrichment sources without reprocessing)

**Design Notes**:
- Enrichment as separate action
- Store enrichment cache (userId → profile) separately
- Hydrate narrative input just-in-time

**Reference**: TASK.md v1, Optional extensions

---

## Feature 10: Vector Search Fallback (Semantic Filtering)

**Problem**: Not all events are equally relevant—some are noise (dependabot PRs, typo fixes).

**Solution**:
- Use vector similarity to rank events by relevance to report purpose
- Filter top-k% by score (e.g., keep only score >0.7)
- Fall back to exhaustive retrieval if <N events pass filter

**Triggers**:
- Users with many low-signal events (bots, automation)
- Need for "highlight reel" reports (not exhaustive list)
- Token budget optimization

**Effort**: ~1 week

**Benefits**:
- Focus on high-impact activity
- Lower token costs (fewer events processed)
- Better narrative quality (less noise)

**Risks**:
- ⚠️ Vector search not exhaustive in Convex (can't paginate)
- ⚠️ Risk of false negatives (important events below threshold)

**Design Notes**:
- Add `relevanceThreshold` config (default: null = no filtering)
- Log filtered-out events for audit
- Fallback to full scan if vector search returns <10 events

**Reference**: Research findings on Convex vector search limitations

---

## Feature 11: Batch API Integration (Gemini)

**Problem**: Real-time report generation costs 2x vs batch processing.

**Solution**:
- For non-urgent reports (scheduled, historical), use Gemini Batch API
- 50% cost reduction, 24h turnaround (often faster)
- Bulk-generate multiple reports in single job

**Triggers**:
- Cost optimization initiative (reduce LLM spend)
- Scheduled report generation (daily/weekly at midnight)
- Backfill historical reports

**Effort**: ~3 days

**Benefits**:
- 50% cost savings for batch workloads
- Scales to 2GB JSONL (thousands of reports)

**Design Notes**:
- Add `urgent` flag to report generation
- `urgent=false` → enqueue to batch job
- Poll batch status, populate reports when complete

**Reference**: Research on Gemini Batch API (50% discount)

---

## Feature 12: Observability Dashboards

**Problem**: No visibility into report generation health, cost, performance.

**Solution**:
- Convex dashboard integration
- Metrics: coverage distribution, cache hit rate, latency percentiles, cost/report
- Alerts: coverage <0.95, N_seen ≠ N_expected, latency >30s

**Triggers**:
- Multi-user deployment (need ops visibility)
- Cost monitoring requirements
- SLO enforcement

**Effort**: ~1 week

**Benefits**:
- Proactive issue detection
- Cost attribution (per user, per report type)
- SLO tracking

**Design Notes**:
- Export structured logs to Convex dashboard
- Add custom charts for coverage/latency
- Integrate with Sentry for error tracking

**Reference**: TASK.md v1, section 9 (Observability & SLOs)

---

## Feature 13: Regeneration Throttling & Budgeting

**Problem**: Unlimited push-button regenerations could spike LLM spend and starve scheduled jobs.

**Solution**: Introduce guardrails for report regenerations:
- Per-user quota (e.g., 3 regenerations per rolling 24h)
- Global rate limiter tied to LLM budget and queue depth
- UI feedback when throttled, with guidance on when retry will be available

**Triggers**:
- Regeneration volume exceeds 10% of scheduled reports
- LLM spend variance >20% week-over-week
- Abuse signals (same report regenerated >N times/hour)

**Effort**: ~2 days (shared limiter + UI messaging)

**Design Notes**:
- Track regeneration counts in `reportRegenerations` table (already storing timestamps)
- Integrate with planned job scheduler metrics for observability
- Consider surfacing soft warnings before hard stops (e.g., toast: “2 of 3 regenerations remaining today”)

---

## Prioritization Framework

When to implement these features:

**Tier 1 (Critical Path)**:
- Map-Reduce Batching (when >20k events hit)
- Overflow Detection (when token errors occur)

**Tier 2 (Compliance/Scale)**:
- Merkle Trees (when audit requirements arise)
- QA Checks (when data integrity issues occur)
- Evaluation Harness (when prompt changes frequent)

**Tier 3 (Optimization)**:
- Hierarchical Summarization (when weekly >30s)
- Late-Binding Enrichment (when metadata bloats tokens)
- Batch API (when cost becomes issue)

**Tier 4 (Nice-to-Have)**:
- Vector Search Fallback (when noise reduction needed)
- State Machine (when debugging complexity grows)
- Observability (when multi-user ops needed)

---

## Implementation Triggers

Set up monitoring for these signals—when triggered, prioritize corresponding feature:

| Signal | Threshold | Feature |
|--------|-----------|---------|
| Events per report | >20k | Map-Reduce Batching |
| Token count | >400k input | Overflow Detection |
| Coverage score | <0.90 avg | QA Checks, Evaluation Harness |
| Latency p95 | >30s | Hierarchical Summarization |
| Cost per report | >$0.10 | Batch API, Late-Binding |
| Compliance inquiry | Any | Merkle Trees & Receipts |

---

**Note**: This backlog represents ~3-4 months of additional work beyond the MVP. Prioritize based on actual user pain, not speculative scale.
