# 0005 – Embedding Provider Strategy (Voyage Primary, OpenAI Fallback)

## Status
Accepted

## Context
Vector embeddings enable semantic search across GitHub activity. Provider choice affects cost, quality, and reliability. The schema is locked to 1024-dimension vectors (Convex vector index cannot be resized without migration).

Alternatives considered:
1. **OpenAI text-embedding-3-small**: Cheap ($0.02/1M tokens), 1536 dimensions, but quality lags on code/technical content.
2. **OpenAI text-embedding-3-large**: Better quality, 3072 dimensions, but higher cost and dimension mismatch.
3. **Cohere embed-v3**: Good quality, but API less mature and pricing complex.
4. **Voyage voyage-3-large**: Optimized for code retrieval, 1024 dimensions, $0.10/1M tokens. Benchmark leader for code search.

## Decision
Use Voyage AI as primary embedding provider with OpenAI fallback:
- Primary: `voyage-3-large` (1024-dim, optimized for code)
- Fallback: `text-embedding-3-small` (1536-dim, truncated or padded if needed)
- Schema: Fixed at 1024 dimensions to match Voyage output
- Fallback triggers on Voyage API errors (rate limit, downtime)

Key implementation: `convex/lib/embeddings.ts` with `embedText()` auto-fallback.

## Consequences
**Benefits:**
- Voyage excels at code/technical content (our primary use case)
- 1024 dimensions balances quality vs storage/compute cost
- Auto-fallback ensures availability during Voyage outages
- Cost-effective: 5x cheaper than OpenAI large model

**Tradeoffs:**
- Dimension lock: Changing providers requires schema migration
- Mixed embeddings: Fallback produces different vectors (may affect search quality)
- Voyage smaller company: Higher vendor risk than OpenAI

**Cost model:**
- Target: ≤$0.02/user-day for embeddings
- Average event size: ~200 tokens
- Voyage: $0.02 per 200K events per day
- Acceptable for expected usage patterns

**Future considerations:**
- Monitor Voyage availability and quality
- Consider embedding caching by contentHash (already implemented)
- Evaluate dimension reduction if storage becomes concern
