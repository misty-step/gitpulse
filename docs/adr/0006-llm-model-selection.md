# 0006 – LLM Model Selection (Gemini 3 Pro via OpenRouter)

## Status
Accepted

## Context
Report generation requires an LLM that can:
1. Process structured GitHub event lists
2. Generate coherent technical summaries
3. Maintain citation accuracy (every claim links to source)
4. Handle variable input sizes (5-500 events per report)

Alternatives considered:
1. **GPT-4o / GPT-4.1**: Excellent quality, high cost ($2-10/1M input tokens), slower.
2. **Claude 3.5 Sonnet**: Great reasoning, $3/1M input, but API rate limits tight.
3. **Gemini 2.5 Flash**: Fast, cheap ($0.075/1M), but citation accuracy concerns.
4. **Gemini 3 Pro**: New model (Dec 2025), balanced quality/cost ($2/1M input).
5. **Local models**: Privacy benefits but quality gap and infrastructure overhead.

## Decision
Use Gemini 3 Pro via OpenRouter as the production model:
- Model: `google/gemini-3-pro-preview` via OpenRouter API
- Temperature: 1.0 (creative but consistent with structured prompts)
- Max tokens: 4000 (sufficient for weekly reports)
- Routing: OpenRouter provides multi-provider fallback capability

Key rationale:
- Citation accuracy critical: Gemini 3 Pro follows structured prompt instructions well
- Cost: $2/$12 per 1M tokens (input/output)—affordable for daily use
- Eval-tested: Promptfoo tests verify citation coverage and format compliance

## Consequences
**Benefits:**
- Consistent citation format across all reports
- OpenRouter abstracts provider management (keys, fallback, rate limits)
- Single model for both daily and weekly reports (simpler eval coverage)
- Reasonable cost (~$0.01-0.03 per report)

**Tradeoffs:**
- Vendor lock-in to OpenRouter (but easy to swap—just API endpoint)
- Gemini 3 Pro in preview—may have breaking changes
- Higher cost than Flash ($2 vs $0.075 input)—watch if usage grows

**Eval strategy:**
- `evals/promptfooconfig.yaml` tests production model only
- LLM-rubric assertions verify structure and accuracy
- CI fails on citation coverage regression

**Cost projection:**
- Average report: ~2K input tokens, ~1K output tokens
- Per-report cost: ~$0.016
- 1000 users × 7 reports/week = ~$112/week
- Within target of ≤$0.02/user-day
