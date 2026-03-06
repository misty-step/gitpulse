# GitPulse v2 (Agentic Rebuild)

GitPulse is now an **agentic git intelligence system** with two surfaces:

- **CLI first** for fast personal workflows
- **Slim generative web UI** for shared/team visibility

The runtime is rebuilt around the contract:

1. **Model decides what to do**
2. **Tools decide how it is done**
3. **Typed UI blocks decide how it is rendered**

## Stack

- **Package manager:** Bun
- **Monorepo:** Bun workspaces
- **Web:** Next.js 16 + React 19
- **Agent runtime:** Vercel AI SDK (`Experimental_Agent`) + typed tools
- **Model provider:** OpenRouter (optional, deterministic fallback if unset)
- **Schema contracts:** Zod

## Workspace Layout

```txt
apps/
  cli/          # gitpulse command-line surface
  web/          # generative web surface
packages/
  schemas/      # typed contracts (scope, events, metrics, UI blocks)
  agent-core/   # GitHub tools, deterministic metrics, agent loop
```

Legacy directories from pre-rebuild remain in place as reference only. New scripts target `apps/*` + `packages/*`.

## Quick Start

```bash
bun install
bun run typecheck
bun run test
```

Run the web app:

```bash
bun run dev:web
# open http://localhost:3000
```

Run the CLI:

```bash
bun run dev:cli -- ask "what did we ship this week" --orgs misty-step
```

## CLI Usage

```bash
gitpulse ask "question" [flags]
```

Flags:

- `--from <iso-date>` (default: now - 7 days)
- `--to <iso-date>` (default: now)
- `--repos <owner/repo,...>`
- `--orgs <org,...>`
- `--contributors <user,...>`
- `--model <openrouter-model>`
- `--json`

Example:

```bash
gitpulse ask "compare this week to last week" \
  --from 2026-02-25T00:00:00Z \
  --to 2026-03-04T00:00:00Z \
  --repos misty-step/gitpulse,misty-step/overmind \
  --contributors phaedrus
```

## Environment

Required for higher rate limits and private repo access:

```bash
GITHUB_TOKEN=ghp_...
```

Optional for LLM narrative output:

```bash
OPENROUTER_API_KEY=...
GITPULSE_MODEL_PRIMARY=anthropic/claude-sonnet-4.6
GITPULSE_MODEL_FALLBACKS=openai/gpt-5-mini,google/gemini-2.5-pro,openai/gpt-4.1-mini
GITPULSE_LLM_TELEMETRY=true
```

If `OPENROUTER_API_KEY` is missing, GitPulse still runs with deterministic analytics output.

Production web safety default:

```bash
# Production route stays disabled unless you opt in intentionally.
GITPULSE_ALLOW_UNAUTHENTICATED_AGENT_ROUTE=true

# Optional extra guard for preview/staging/dev or any exposed route.
# Callers must send x-gitpulse-agent-secret with the same value.
GITPULSE_AGENT_ROUTE_SHARED_SECRET=...
```

## Architecture Summary

- **Ingestion tool layer:** GitHub REST collectors for commits, PRs, reviews
- **Deterministic layer:** metric computation, citations, block construction
- **Agent layer:** tool-calling planner with bounded steps
- **Surfaces:**
  - CLI: plain-text + optional JSON
  - Web: JSON block renderer (`metric_grid`, `repo_breakdown`, `event_feed`, `insight_list`)

See [`DESIGN.md`](DESIGN.md) for module boundaries and extension plan.
See [`docs/architecture/agentic-system.md`](docs/architecture/agentic-system.md) for the system diagram.
