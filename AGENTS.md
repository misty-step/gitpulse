# Repository Guidelines

## Structure

GitPulse is Bun workspace monorepo:

- `apps/cli` - terminal surface (`gitpulse ask`)
- `apps/web` - slim generative UI (Next.js)
- `packages/schemas` - typed contracts (scope/events/metrics/blocks)
- `packages/agent-core` - GitHub tools + deterministic metrics + agent loop

Legacy pre-rebuild directories remain but are not primary execution paths.

## Commands

- `bun install`
- `bun run dev:web`
- `bun run dev:cli -- ask "what happened" --orgs misty-step`
- `bun run typecheck`
- `bun run test`
- `bun run build`

## Architecture Rules

- Model decides **what**; tools decide **how**; schema decides **rendering**.
- Do not call GitHub APIs from surface apps; only from `agent-core`.
- Do not compute metrics in surface apps; use `computeMetrics` in `agent-core`.
- Keep UI block types strict and versionable in `packages/schemas`.
- Never let model-generated text become a source of truth for metrics.

## Code Style

- TypeScript strict mode.
- Keep modules deep with minimal interfaces.
- Prefer narrow, reversible patches.
- Add tests for non-trivial logic changes.

## Testing

- Schema tests live in `packages/schemas/src/*.test.ts`
- Agent logic tests live in `packages/agent-core/src/*.test.ts`
- Run `bun run test` before handoff.

## Security / Config

- Use `GITHUB_TOKEN` for private repo access and higher limits.
- Use `OPENROUTER_API_KEY` for LLM narrative mode.
- Without LLM key, deterministic mode must still work.
