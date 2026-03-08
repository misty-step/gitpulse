# CLAUDE.md

This repo has been reimagined as an **agentic git intelligence system**.

## Project Overview

GitPulse v2 answers natural-language questions about git activity across arbitrary windows, repositories, organizations, and contributors.

Primary contract:

1. Model decides what to do
2. Tools decide how to do it
3. UI schema decides how to render

## Stack

- Bun workspaces
- Next.js 16 + React 19 (`apps/web`)
- CLI (`apps/cli`)
- Vercel AI SDK agent loop in `packages/agent-core`
- Typed contracts in `packages/schemas`

## Workspace Map

```txt
apps/
  cli/
  web/
packages/
  schemas/
  agent-core/
```

## Essential Commands

```bash
bun install
bun run dev:web
bun run dev:cli -- ask "what happened" --orgs misty-step
bun run typecheck
bun run test
bun run build
```

## Environment

```bash
# GitHub access
GITHUB_TOKEN=ghp_...

# Optional LLM narrative mode
OPENROUTER_API_KEY=...
GITPULSE_MODEL_PRIMARY=anthropic/claude-sonnet-4.6
GITPULSE_MODEL_FALLBACKS=openai/gpt-5-mini,google/gemini-2.5-pro,openai/gpt-4.1-mini
GITPULSE_LLM_TELEMETRY=true
```

Without `OPENROUTER_API_KEY`, deterministic analytics mode must still produce valid output.

## Deep Module Boundaries

### `packages/schemas`

Hides all schema complexity:

- window/scope validation
- canonical event contracts
- metric contracts
- UI block contracts

### `packages/agent-core`

Hides runtime complexity:

- GitHub collection
- metric computation
- citations
- tool-calling agent loop

### `apps/cli` and `apps/web`

Surface-only. They should not implement business logic.

## Invariants

- Never trust model output for metrics.
- Always compute metrics deterministically from tool data.
- Never call GitHub from `apps/web` or `apps/cli` directly.
- UI only renders whitelisted block types from schema union.
- Never write deterministic code for what the LLM already handles (see below).

## Agent-Forward Design

GitPulse has an LLM in the loop. Before adding any capability, ask:
**"Can the model do this with existing or expanded tools?"**

**Model handles:** intent parsing, time inference ("last week"), entity extraction,
narrative synthesis, insight generation, deciding tool call sequences.
Do NOT add NLP libraries, regex classifiers, or deterministic parsers for these.

**Code handles:** GitHub API calls, metrics computation, schema validation,
auth/security, filesystem operations, rendering contracts.

**The line:** If the value of a feature IS the intelligence, the model does it.
If the value is mechanical data access or correctness guarantees, code does it.

Expand the model's capabilities by giving it better tools and better prompts,
not by building deterministic pipelines around it.

## Testing Guidance

- Put logic tests next to source files (`*.test.ts`).
- Run `bun run test` for schema + agent core.
- Run `bun run typecheck` before handoff.

## Extension Plan

- Add persistent query history + memory
- Add streaming responses in web route
- Add cached/background ingestion for large org scopes
- Add eval fixtures for prompt + tool regression
