# TODO

- [x] Release workflow watches `main` and pins Node 22.15.0 (`.github/workflows/release.yml`)
  - Owner: @codex | ETA: done | Acceptance: workflow triggers on default branch and aligns with engines
- [x] HeroMetadata uses deep health with logging (`components/HeroMetadata.tsx`)
  - Owner: @codex | ETA: done | Acceptance: fetches `/api/health?deep=1`, logs degraded/failures, ignores abort
- [x] Restore env preflight and add UI tests (`package.json`, `tests/components/*`)
  - Owner: @codex | ETA: done | Acceptance: `build:app` runs `env:check`; tests cover clipboard success/fallback and health states
- [x] Add placeholder legal pages for footer links (`app/terms/page.tsx`, `app/privacy/page.tsx`)
  - Owner: @codex | ETA: done | Acceptance: routes render placeholder copy without 404s
