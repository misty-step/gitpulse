
### [CRITICAL] Fix Build Command - Add Convex Deploy
**Files**: `package.json:8`, `vercel.json:3`
**Perspectives**: architecture-guardian
**Impact**: Prevents production runtime failures from missing Convex schema/functions

**Problem**: Build script only runs `next build` without deploying Convex backend first. Next.js imports generated Convex types, so backend must deploy before frontend builds.

**Current (BROKEN)**:
```json
// package.json
"build": "next build"
```

**Fix**:
```json
// package.json
"build": "npx convex deploy && next build"
```

**Why Critical**: Convex generates `convex/_generated/` types that Next.js imports. If Convex doesn't deploy first, build fails or uses stale types.

**Effort**: 5m | **Priority**: P0
**Acceptance**: `pnpm build` deploys Convex then builds Next.js, production builds succeed

---

### [INFRASTRUCTURE] Install Lefthook Pre-Commit Quality Gates
**Files**: Create `.lefthook.yml`, update `package.json`
**Perspectives**: architecture-guardian
**Impact**: Catch issues locally before CI (saves 5+ min per failed push), prevents 80%+ of regression bugs

**Problem**: No git hooks configured. Type errors, lint violations, failing tests, and secrets reach main branch. CI failures discovered after push waste time.

**Fix**: Install Lefthook (3-5x faster than Husky, parallel execution)
```yaml
# .lefthook.yml
pre-commit:
  parallel: true
  commands:
    format:
      glob: "*.{ts,tsx,md}"
      run: pnpm prettier --write {staged_files}
    lint:
      glob: "*.{ts,tsx,js,jsx}"
      run: pnpm lint --fix --cache {staged_files}
    secrets:
      run: gitleaks protect --staged

pre-push:
  commands:
    typecheck:
      run: pnpm typecheck
    test:
      run: pnpm test --bail --findRelatedTests $(git diff --name-only --cached)
    convex:
      run: npx convex typecheck
```

```json
// package.json - add prepare script
"scripts": {
  "prepare": "lefthook install"
}
```

**Performance Budget**: pre-commit <5s, pre-push <15s (if >20% of commits use --no-verify, hooks too slow)

**Effort**: 2h (install + configure + test) | **Priority**: P0
**Acceptance**: Commits blocked on format/lint/secrets violations, pushes blocked on type/test failures

---

### [INFRASTRUCTURE] Create CI/CD Quality Pipeline
**Files**: Create `.github/workflows/ci.yml`
**Perspectives**: architecture-guardian, maintainability-maven
**Impact**: Automated quality gates catch broken builds, type errors, test failures before merge

**Problem**: No CI/CD checks. 3 workflows exist (enforce-pnpm, claude, claude-code-review) but none run typecheck/lint/test/build. Broken code can reach main branch.

**Fix**: Create comprehensive CI pipeline
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        check: [typecheck, lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run ${{ matrix.check }}
        run: pnpm ${{ matrix.check }}

  build:
    needs: quality-gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # CRITICAL: Convex deploy BEFORE Next.js build
      - name: Deploy Convex
        run: npx convex deploy
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}

      - name: Build Next.js
        run: pnpm build
```

**Effort**: 1.5h | **Priority**: P0
**Acceptance**: PRs require passing CI (typecheck, lint, test, build), parallel execution

---

### [SECURITY] Add Gitleaks Secrets Scanning
**Files**: Create `.gitleaks.toml`, update `.lefthook.yml` and `.github/workflows/ci.yml`
**Perspectives**: security-sentinel, architecture-guardian
**Impact**: Prevents API keys, tokens, passwords from being committed

**Problem**: No secrets detection. 121 console.* calls with no PII redaction. API keys could be committed to git history.

**Fix**: Install Gitleaks with pre-commit hook + CI check
```toml
# .gitleaks.toml
[extend]
useDefault = true

[allowlist]
description = "Allowlist for false positives"
paths = [
  '''\.env\.example$''',
  '''\.env\.local\.example$''',
]

[[rules]]
description = "GitHub Token"
regex = '''ghp_[0-9a-zA-Z]{36}'''
tags = ["key", "GitHub"]

[[rules]]
description = "Convex Deploy Key"
regex = '''prod:[a-z0-9]{64}'''
tags = ["key", "Convex"]
```

```yaml
# .lefthook.yml (already shown in Lefthook item above)
pre-commit:
  commands:
    secrets:
      run: gitleaks protect --staged
```

```yaml
# .github/workflows/ci.yml (add job)
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Effort**: 30m | **Priority**: P0
**Acceptance**: Commits with secrets blocked, CI scans full git history

---

### [TESTING] Add Coverage Tracking & Thresholds
**Files**: `package.json` (jest config section)
**Perspectives**: maintainability-maven, architecture-guardian
**Impact**: Visibility into test coverage, prevent coverage regressions

**Problem**: 12 test files, 76 tests total, but no coverage tracking. Don't know what's untested or if coverage is dropping.

**Fix**: Add Jest coverage configuration
```json
// package.json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "convex/lib/**/*.ts",
      "convex/actions/**/*.ts",
      "lib/**/*.ts",
      "!**/__tests__/**",
      "!**/*.test.ts",
      "!convex/_generated/**"
    ],
    "coverageThresholds": {
      "global": {
        "lines": 60,
        "functions": 60,
        "branches": 55,
        "statements": 60
      }
    },
    "coverageReporters": ["text", "lcov", "html"]
  },
  "scripts": {
    "test:coverage": "jest --coverage"
  }
}
```

**Philosophy**: Google research shows 60% = acceptable, 75% = commendable, 90% = exemplary. Focus on delta, not absolute percentage.

**Effort**: 30m | **Priority**: P1
**Acceptance**: `pnpm test:coverage` generates report, CI fails if coverage drops below 60%

---

### [SECURITY] Enable GitHub Dependabot
**Files**: Create `.github/dependabot.yml`
**Perspectives**: security-sentinel
**Impact**: Automated dependency updates, vulnerability patches

**Problem**: No automated dependency management. Vulnerable dependencies unpatched, manual version bumps error-prone.

**Fix**: Configure Dependabot for weekly PRs
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "automated"
    reviewers:
      - "misty-step"
    assignees:
      - "misty-step"
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    # Group patch updates to reduce PR noise
    groups:
      patch-updates:
        patterns:
          - "*"
        update-types:
          - "patch"
```

**Effort**: 15m | **Priority**: P1
**Acceptance**: Weekly automated PRs for dependency updates, grouped by type

---
