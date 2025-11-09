# Repository Guidelines

## Project Structure & Module Organization
Next's App Router lives in `app/` (e.g., `app/dashboard`, `app/sign-in`). Presentation components belong to `components/` with shared ShadCN bits in `components/ui/`; hooks stay in `hooks/` and pure utilities in `lib/`. Convex backend logic sits in `convex/` (`schema.ts`, `queries/`, `mutations/`, `actions/`, `lib/`), and static assets live under `public/`. Keep data fetching inside Convex, UI inside `components`, and pass only the props that expose intent.

## Build, Test, and Development Commands
Install deps with `pnpm install`. `pnpm dev` starts Next.js + Convex; add `:log` for verbose tracing and prune with `pnpm logs:rotate`. Ship-ready bundles come from `pnpm build` plus `pnpm start`. Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm exec jest`, and `pnpm storybook` / `pnpm build-storybook`. Run `scripts/doctor.sh` (once committed) before sweeping refactors to ensure a clean tree.

## Coding Style & Naming Conventions
We write strict TypeScript with two-space indentation and the repo’s Prettier + ESLint rules. Components use PascalCase files, hooks/utilities prefer camelCase, and directories stay lowercase or kebab-case. Keep pure calculations in `lib/` or Convex helpers, expose only the intention through hooks/services, and lean on Tailwind utility classes for layout. Avoid leaking Convex or Clerk details across layers.

## Testing Guidelines
Author `*.test.ts`/`*.test.tsx` files next to the code they verify so interfaces stay tiny. Run `pnpm exec jest --coverage` before every push, and extend local Jest mocks (create a sibling `__mocks__/` directory when touching networked modules) instead of exercising live GitHub or Convex APIs. Snapshot UI states in Storybook when behavior is visual and capture invariants directly in test names.

## Commit & Pull Request Guidelines
Use Conventional Commits with scoped subjects (`feat(app): add report panel`, `fix(convex): guard empty payload`). PRs must state intent, list the checks you ran (`lint`, `typecheck`, `jest`, coverage, Storybook`), link the relevant issue, and attach screenshots or recordings for UI changes. Flag temporary shortcuts or debt so it can be tracked, and request reviewers closest to the layer you touched.

## Security & Configuration Tips
Copy `.env.local.example` before `pnpm dev`; populate Convex, Clerk, GitHub, and AI provider keys but keep them out of git. Rotate shared secrets (`NEXTAUTH_SECRET`, Clerk keys, Convex tokens) and scrub traces with `pnpm logs:clean`. Prefer least-privilege GitHub App scopes, document new permissions in repo docs, and keep secrets out of Storybook stories or test fixtures.
