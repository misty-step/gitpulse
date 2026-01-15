# 0008 – Langfuse for LLM Observability

## Status
Accepted

## Context
LLM calls are expensive and opaque. Without observability, debugging issues requires log archaeology and reproducing conditions. Key needs:
1. Trace generation latency and token usage
2. Correlate prompts with outputs for quality review
3. Track costs per user/report type
4. Debug citation failures without reproducing full flow

Alternatives considered:
1. **Structured logs only**: Simple but lacks correlation, aggregation, and visualization.
2. **OpenTelemetry + custom backend**: Flexible but high setup cost, no LLM-specific features.
3. **LangSmith**: Good LangChain integration but requires LangChain. We use direct API calls.
4. **Langfuse**: Open-source, LLM-native tracing, prompt versioning, cost tracking. Self-hostable.

## Decision
Use Langfuse for LLM observability:
- Traces span full report generation (user request → LLM response → save)
- Generations capture prompt, completion, model, tokens, latency
- Cost calculation via `calculateCost()` using MODEL_PRICING table
- Conditional enablement: Skip tracing if env vars not configured

Key implementation: `convex/lib/langfuse.ts`
- Singleton pattern for Langfuse client
- `flushLangfuse()` MUST be called at end of every action (serverless constraint)
- `isLangfuseConfigured()` for conditional tracing

## Consequences
**Benefits:**
- Full trace history for debugging
- Token/cost tracking per user and report type
- Prompt playground for iteration without redeployment
- Self-hostable option for data sovereignty

**Tradeoffs:**
- Flush requirement: Serverless may terminate before background sends complete
- Added dependency: Langfuse SDK in bundle
- Cost: Langfuse cloud pricing applies (or self-host infrastructure)

**Serverless constraint:**
- Set `flushAt: 1` for immediate flush (batching unreliable in Convex)
- Every action must call `await flushLangfuse()` before returning

**Model pricing maintained:**
- `MODEL_PRICING` table in langfuse.ts updated manually
- Dec 2025 prices for Gemini 3, GPT-4.1, Claude 3.5, Voyage

**Integration pattern:**
```typescript
const trace = getLangfuse().trace({ name: 'report-generation', userId });
const gen = trace.generation({ name: 'llm-call', model, input: { ... } });
// ... LLM call ...
gen.end({ output, usage: { promptTokens, completionTokens } });
await flushLangfuse(); // CRITICAL
```
