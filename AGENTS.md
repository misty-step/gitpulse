# Repository Guidelines

## Project Structure & Module Organization
- Domain modules live in `src/core`; service effects and workflows sit in `src/services`, while the Next.js shell is split between `src/app` (routes) and `src/components` (presentation).
- Shared hooks and utilities belong in `src/hooks` and `src/lib`. Define new types in `src/core/types` before exposing them elsewhere.
- Static assets stay in `public/`. Storybook docs live in `docs/`. The `e2e/` folder holds the Playwright-ready scaffolding for future end-to-end helpers and config.

## Build, Test, and Development Commands
- `pnpm install` is enforced by the `preinstall` hook; start the app with `pnpm dev` or `pnpm dev:log` for verbose logging (rotate logs via `pnpm logs:rotate`).
- `pnpm build` and `pnpm start` prepare and serve the production bundle.
- `pnpm lint`, `pnpm typecheck`, and `pnpm exec jest` form the quality baseline. Use `pnpm storybook` / `pnpm build-storybook` for component work and visual QA.

## Coding Style & Naming Conventions
- Write strict TypeScript with functional leanings: keep pure calculations in `core` and wrap effects in `services` or hooks.
- Use two-space indentation and the repo’s Prettier/ESLint defaults to manage formatting and import order.
- Components adopt `PascalCase`, hooks and utilities use `camelCase`, and directories stay kebab- or lower-case (`logged-summary`, `dashboard`). Tailwind utility classes remain the primary styling method.

## Testing Guidelines
- Jest picks up `*.test.ts` files co-located with source; cover fresh logic in `core` before layering service or UI tests.
- Rely on `src/lib/github/__mocks__` to isolate Octokit behavior. Extend mocks instead of calling live APIs.
- Run `pnpm exec jest --coverage` before merging and snapshot expected results in Storybook while the Playwright suite is scaffolded.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`); scope subjects when touching focused areas (`feat(core): aggregate trends`).
- PRs must state intent, list the checks you ran (`lint`, `typecheck`, `jest`), link issues, and attach screenshots or Storybook URLs for UI updates.
- Capture environment adjustments in `.env.local.example` or `docs/`, and request reviewers closest to the touched layer.

## Environment & Security Notes
- Populate `.env.local` from the template with GitHub OAuth, NextAuth, and Gemini keys; never commit secrets.
- Rotate `NEXTAUTH_SECRET` in shared deployments and prune sensitive traces with `pnpm logs:clean`. Prefer least-privilege GitHub App scopes and document new permissions.
