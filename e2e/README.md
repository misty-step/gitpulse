# E2E Tests (Playwright)

- `pnpm test:e2e` — run all E2E specs (chromium)
- Base URL: `http://localhost:3000` (override via `PLAYWRIGHT_BASE_URL`)
- Artifacts: `playwright-report/`, `test-results/` (ignored in git)
- Fixtures live in `e2e/fixtures/`
