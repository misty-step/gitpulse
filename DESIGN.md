# DESIGN.md - GitPulse Agentic Architecture

## Problem

Developers and leads need trustworthy answers to questions like:

- What happened across these repos this sprint?
- Where is review throughput lagging?
- Who is carrying merge load over this period?

The query space is open-ended (arbitrary time windows, repos, orgs, contributors), so static dashboards alone are insufficient.

## Core Contract

1. **Model decides WHAT to do**
2. **Tools decide HOW to do it**
3. **Typed UI schema decides HOW to render it**

## Module Boundaries

### `packages/schemas` (Deep Contract Module)

**Owns:** all typed contracts

- Scope (`repos`, `orgs`, `contributors`)
- Time windows
- Canonical activity events
- Deterministic metrics
- Generative UI block types

No GitHub API calls, no model calls.

### `packages/agent-core` (Deep Runtime Module)

**Owns:** all orchestration and intelligence

- GitHub collectors (`commits`, `pulls`, `reviews`)
- Deterministic metric engine
- Citation assembly
- Agent loop (`Experimental_Agent`) with bounded tool steps
- Fallback answer path when no model key exists

No UI code.

### `apps/cli` (Surface)

**Owns:** command parsing + terminal rendering.

Never computes metrics directly; always calls `agent-core`.

### `apps/web` (Surface)

**Owns:**

- query form and request submission
- `/api/agent` endpoint for runtime invocation
- typed JSON block rendering

Never talks to GitHub directly.

## Data Flow

```txt
User question + scope + window
        |
        v
Agent core
  ├─ tool: get_activity_window      -> GitHub REST
  ├─ tool: compare_windows          -> GitHub REST x2
  ├─ deterministic metrics/citations
  └─ optional LLM narrative
        |
        v
AgentAnswer
  ├─ answer (markdown/plain text)
  ├─ citations[]
  ├─ blocks[]
  ├─ metrics
  └─ events
        |
        +--> CLI renderer
        +--> Web block renderer
```

## Guardrails

- Model never writes persistence.
- Metric claims are deterministic from tool outputs.
- UI only renders whitelisted block types.
- Scope and window are schema-validated.
- Tool loop has bounded `stepCount`.

## Current Scope (v0.2)

Implemented:

- Bun workspace monorepo
- Agent runtime with two tools (`get_activity_window`, `compare_windows`)
- CLI `ask` command with full scope flags
- Web UI with typed block rendering

Next:

1. Persisted memory and saved queries
2. Team/org presets and comparison templates
3. Streaming responses in web UI
4. Background sync/cache for large orgs
5. Eval harness for prompt/tool regressions
