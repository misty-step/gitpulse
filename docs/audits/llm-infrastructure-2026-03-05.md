# LLM Infrastructure Audit + Overhaul

Date: 2026-03-05  
Scope: `apps/*`, `packages/*`, CI workflows, LLM prompt/model/runtime contracts.

## Executive Result

- Replaced stale hardcoded model use with env-driven model chain + fallback runtime.
- Centralized prompt contract with explicit versioning.
- Added per-call LLM telemetry logging (status/latency/tokens/model/error).
- Added Bun-native LLM gate workflow + model-audit script.
- Added deterministic tests for LLM config + no-key fallback behavior.
- Added architecture diagram documenting the new agentic contract.

## Audit Findings (Before Patch)

1. `packages/agent-core/src/agent.ts` had inline hardcoded default model (`openai/gpt-4.1-mini`) and no fallback chain.
2. Prompt contract lived inline with no version control surface.
3. No trace-level visibility for model attempts (latency/tokens/errors).
4. LLM CI workflow targeted legacy `convex/*` paths and `pnpm`.
5. Repo policy still enforced `pnpm` despite Bun monorepo runtime.

## Overhaul Implemented

### 1) Model Runtime + Routing

- New: `packages/agent-core/src/llm/config.ts`
- New env contract:
  - `GITPULSE_MODEL_PRIMARY`
  - `GITPULSE_MODEL_FALLBACKS`
  - `GITPULSE_LLM_MAX_STEPS`
  - `GITPULSE_LLM_TELEMETRY`
  - `GITPULSE_OPENROUTER_APP_NAME`
  - `GITPULSE_OPENROUTER_REFERER`
  - `GITPULSE_PROMPT_VERSION`
- `runGitPulseAgent()` now executes model attempts across a deduped chain.

### 2) Prompt/Context Contract

- New: `packages/agent-core/src/llm/prompt.ts`
- Prompt now follows Role + Objective + Latitude pattern and includes a prompt version marker.

### 3) Observability

- New: `packages/agent-core/src/llm/telemetry.ts`
- Each attempt logs:
  - model id
  - status (`success|empty|error`)
  - latency
  - tokens (when provider returns usage)
  - error message

### 4) Test + CI Gates

- New tests:
  - `packages/agent-core/src/llm/config.test.ts`
  - `packages/agent-core/src/agent.test.ts`
- New script:
  - `scripts/audit-llm-models.sh`
- Root scripts:
  - `bun run test:llm`
  - `bun run audit:llm`
- Replaced eval workflow with Bun-native `LLM Infrastructure Gates`.

### 5) Bun Policy Alignment

- Converted `ci.yml` install/audit/check steps from pnpm to Bun.
- Reworked package-manager policy to enforce Bun lockfile usage (`enforce-bun.yml`).

## Research Notes (Web-Grounded)

### Vercel Agent SDK

- AI SDK docs define agentic and loop patterns plus provider/model management + telemetry hooks, which aligns with GitPulse’s tool-first deterministic architecture.
- Recommendation: keep current AI SDK direction for orchestration and typed tooling.

### Claude Agent SDK

- Anthropic provides Claude Code SDK support (Python/TypeScript) and model documentation with release/deprecation cadence.
- Recommendation: treat Claude SDK as a viable provider/runtime alternative for CLI-heavy workflows and agent sessions, but keep one orchestration layer in GitPulse (`agent-core`) to avoid split-brain logic.

### Pi

- In local sibling systems (`../overmind`) Pi runtime is treated as a signal source (`pi_runtime`) with ingestion from `~/.pi/agent/logs`.
- Recommendation: keep Pi as a first-class context/memory signal into GitPulse, not as a second planner runtime inside GitPulse itself.

## Compelling Stack Direction (Post-Audit)

1. Orchestrator: Vercel AI SDK in `packages/agent-core`.
2. Model gateway: OpenRouter with explicit model chain + env-driven defaults.
3. Surfaces: keep CLI-first + slim generative web shell.
4. Deterministic truth path: metrics/citations always tool-derived.
5. Governance: Bun test gate + model-audit script + LLM workflow gate.

## Sources

- Vercel AI SDK docs: https://ai-sdk.dev/docs/agents/overview
- Vercel AI SDK providers/models: https://ai-sdk.dev/docs/foundations/providers-and-models
- Vercel AI SDK telemetry: https://ai-sdk.dev/docs/ai-sdk-core/telemetry
- Anthropic model docs + lifecycle: https://docs.anthropic.com/en/docs/about-claude/models
- Anthropic prompt engineering overview: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- Anthropic Claude Code SDK: https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview
- Promptfoo CI docs: https://www.promptfoo.dev/docs/integrations/ci-cd/
- OpenRouter quickstart: https://openrouter.ai/docs/quickstart
- OpenRouter model routing/fallback concepts: https://openrouter.ai/docs/features/model-routing
- OpenRouter live model index (validated via API on 2026-03-05): https://openrouter.ai/api/v1/models
