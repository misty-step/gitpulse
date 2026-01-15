# 0002 – Content-Addressed Fact Graph

## Status
Accepted

## Context
GitPulse ingests GitHub events from two sources: real-time webhooks and historical backfills (REST API). The same PR or commit can arrive via either path, creating a deduplication challenge. Additionally, embedding and LLM costs scale linearly with unique content, so avoiding redundant processing is critical for cost control.

Alternatives considered:
1. **GitHub event ID as primary key**: Simple but fragile—GitHub event IDs differ between webhook and REST payloads for the same logical event. Would require complex reconciliation.
2. **Composite key (repo + type + timestamp)**: Still allows duplicates when the same event arrives via different paths at different times.
3. **Content-addressed hashing**: Deterministic SHA-256 hash of (canonicalText, sourceUrl, metrics). Same content = same hash regardless of ingestion path.

## Decision
Use content-addressed hashing for event deduplication:
- Normalize all events into a canonical form (EventFact) before hashing
- Hash includes `canonicalText`, `sourceUrl`, and optional `metrics`
- Use `stableStringify()` for deterministic JSON serialization (sorted keys)
- Index by `contentHash` for O(1) duplicate detection
- Hash before embedding/LLM calls to skip known content

Key implementation: `convex/lib/contentHash.ts` provides `computeContentHash()`.

## Consequences
**Benefits:**
- Zero duplicate embeddings regardless of ingestion timing
- Reports cache-keyed by aggregate content hash—same events = same report
- Webhook + backfill can run concurrently without coordination
- Cost optimization: LLM/embedding calls only for truly new content

**Tradeoffs:**
- Hash computation adds ~1ms per event (acceptable)
- Canonical form must be carefully designed to capture semantic identity
- Schema migration requires rehashing if canonical form changes

**Future implications:**
- Replay/reprocessing is safe—content hash ensures idempotency
- Analytics can count unique vs duplicate events via hash collisions
