# Test Coverage Best Practices Research - 2025

Comprehensive research on test coverage tooling, standards, and E2E testing for TypeScript/Node.js projects (Next.js 16 + React 19 + Convex).

---

## 1. Coverage Tools Comparison

### A. Leading Tools Overview

| Tool | Best For | Pricing (2025) | Key Strengths | Limitations |
|------|----------|----------------|---------------|-------------|
| **Codecov** | Cloud-based PR comments, multi-repo teams | Free for public repos; $5/user/month (private) | Excellent GitHub integration, PR diff coverage, trend tracking, badges | Can be expensive for large private teams |
| **Coveralls** | Simple setup, GitHub Actions | Free for public repos; ~$5-10/user/month (private) | Clean UI, easy setup, good PR comments | Fewer features than Codecov |
| **SonarQube** | Holistic code quality + security | Free (Community); $65/user/month (Team) | Comprehensive quality gates, security scanning, multi-language | Resource-intensive, complex setup |
| **Istanbul (nyc)** | JavaScript/TypeScript local coverage | Free (open source) | First-class ES6+ support, integrates with Jest/Mocha/Vitest | No built-in PR comments or cloud features |
| **py-cov-action** | GitHub Actions PR comments (no external service) | Free | No external dependencies, self-hosted, generates badges | Limited to GitHub Actions |

### B. Detailed Tool Analysis

#### Codecov
- **Official Docs**: https://about.codecov.io/
- **Pricing**:
  - Free: Unlimited public repos
  - Pro: $5/user/month (private repos)
  - Enterprise: Custom pricing
- **Features**:
  - Pull request diff coverage comments
  - README badges (SVG, dynamic)
  - File/function/branch granular reporting
  - GitHub/GitLab/Bitbucket integration
  - Trend tracking over time
  - Coverage gates (fail builds if coverage drops)
- **GitHub Actions Integration**: Excellent (official action: `codecov/codecov-action`)
- **When to Use**: Multi-repo organizations, teams wanting detailed analytics
- **Limitations**: Can get pricey for large private teams (100 users = $500/month)

#### Coveralls
- **Official Docs**: https://coveralls.io/
- **Pricing**: Similar to Codecov (free public, paid private)
- **Features**:
  - Clean, simple UI
  - PR coverage comments
  - Badge support
  - GitHub Actions integration
- **When to Use**: Teams wanting simpler alternative to Codecov
- **Limitations**: Fewer advanced features than Codecov

#### SonarQube
- **Official Docs**: https://www.sonarsource.com/products/sonarqube/
- **Pricing**:
  - Free: Community Edition (self-hosted)
  - Team: $65/user/month
  - Enterprise: Custom
- **Features**:
  - Code coverage + code quality + security analysis
  - Test coverage visualization
  - Bug detection, code smells
  - Multi-language support (30+ languages)
  - Quality gates (customizable thresholds)
- **When to Use**: Teams wanting comprehensive code quality platform (not just coverage)
- **Limitations**: Requires substantial resources (CPU, memory, storage); complex initial setup

#### Istanbul (nyc) - Local Coverage
- **Official Docs**: https://istanbul.js.org/
- **Pricing**: Free (open source)
- **Features**:
  - ES2015+ support via `babel-plugin-istanbul`
  - Multiple output formats (HTML, XML, CSV, LCOV, JSON)
  - Integrates with Jest, Vitest, Mocha, AVA, Tap
  - Command-line and programmatic APIs
- **When to Use**: Local development, CI reporting to external services
- **Limitations**: No PR comment or badge features (requires pairing with Codecov/Coveralls)

#### py-cov-action (GitHub Actions Native)
- **GitHub**: https://github.com/marketplace/actions/free-code-coverage
- **Pricing**: Free
- **Features**:
  - Generates PR comments without external services
  - Creates Markdown badges for README
  - Commit statuses
  - Self-hosted (no data sent to third parties)
- **When to Use**: Teams avoiding external dependencies, privacy-conscious projects
- **Limitations**: GitHub Actions only; less feature-rich than Codecov

---

## 2. Coverage Visualization Best Practices

### A. README Badges

**Recommended Approach**: Use dynamic badges from your coverage service

```markdown
<!-- Codecov -->
[![codecov](https://codecov.io/gh/username/repo/branch/master/graph/badge.svg)](https://codecov.io/gh/username/repo)

<!-- Coveralls -->
[![Coverage Status](https://coveralls.io/repos/github/username/repo/badge.svg?branch=master)](https://coveralls.io/github/username/repo?branch=master)

<!-- Self-hosted with py-cov-action -->
![Coverage Badge](./badges/coverage.svg)
```

**Best Practices**:
- Place prominently in README (near build status badges)
- Link to detailed coverage report
- Update automatically via CI/CD
- Use shields.io for custom styling if needed

### B. Pull Request Comments

**Format Best Practices** (based on industry leaders):

```markdown
## Coverage Report

**Overall Coverage**: 82.5% (+2.3%)

### Files Changed
| File | Coverage | Lines | Branches |
|------|----------|-------|----------|
| src/lib/canonicalizeEvent.ts | 95.2% (+5%) | 120/126 | 24/26 |
| src/lib/reportOrchestrator.ts | 78.4% (-2%) | 89/114 | 18/22 |

### Coverage by Type
- **Line Coverage**: 82.5%
- **Branch Coverage**: 78.1%
- **Function Coverage**: 85.3%

### New Code Coverage
Files added in this PR: **91.2%** (23/25 lines covered)

🟢 Coverage increased by 2.3%
```

**Key Elements**:
- Overall coverage with delta (vs base branch)
- File-level breakdown for changed files only
- Coverage by type (line/branch/function)
- New code coverage (most important metric)
- Visual indicators (✅/❌ or 🟢/🔴)

### C. Dashboards & Reports

**Recommended Setup**:
1. **Local HTML Reports**: Generate via Istanbul/nyc for development
   ```bash
   npm test -- --coverage
   # Opens coverage/lcov-report/index.html
   ```

2. **CI Dashboard**: Use Codecov/SonarQube for historical trends
   - Track coverage over time (weekly/monthly charts)
   - Identify coverage regressions
   - Monitor specific modules/directories

3. **Team Visibility**: Pin coverage dashboard in Slack/Teams
   - Weekly automated coverage summaries
   - Alerts for significant drops

### D. Trend Tracking

**Metrics to Track**:
- Overall coverage percentage (weekly snapshots)
- Coverage per module/directory
- Coverage delta per PR
- Untested file count
- High-risk low-coverage areas

**Tools**:
- Codecov: Built-in trend charts
- SonarQube: Historical metrics dashboard
- Custom: Store coverage JSON in git, visualize with D3.js/Chart.js

---

## 3. Coverage Standards & Thresholds

### A. Industry Standards (2025)

**Recommended Thresholds** (based on research):

| Coverage Type | Minimum | Target | Ideal |
|--------------|---------|--------|-------|
| **Patch Coverage** (new code) | 70% | 80% | 90%+ |
| **Overall Project** | 60% | 70% | 80%+ |
| **Critical Paths** (auth, payments, core logic) | 90% | 95% | 100% |
| **Utilities/Libraries** | 80% | 90% | 95%+ |
| **UI Components** | 50% | 60% | 70% |

**Key Insights from Research**:
- **Focus on patch coverage** (new code only) > overall coverage
- 80%+ patch coverage is achievable without diminishing returns
- 100% coverage is often wasteful (law of diminishing returns after 80-90%)
- Branch coverage > line coverage (catches edge cases)

### B. Threshold Philosophy

**Modern Best Practices** (2025):

1. **Patch Coverage > Overall Coverage**
   - Enforce high coverage on new code (80%+)
   - Allow gradual improvement of legacy code
   - Prevent coverage regression

2. **Branch Coverage Priority**
   - Branch coverage catches untested conditionals
   - Line coverage can be misleading (counts executed lines, not tested logic)
   - Example: `if (x) return y;` counts as covered even if false branch never tested

3. **Differential Coverage**
   - Only measure coverage for lines changed in PR
   - Avoids penalizing teams for legacy code
   - Encourages incremental improvement

4. **Module-Specific Thresholds**
   ```javascript
   // jest.config.js
   module.exports = {
     coverageThreshold: {
       global: {
         branches: 70,
         functions: 75,
         lines: 75,
         statements: 75
       },
       './convex/lib/**/*.ts': {  // Critical backend logic
         branches: 90,
         functions: 90,
         lines: 90,
         statements: 90
       },
       './app/components/**/*.tsx': {  // UI components
         branches: 60,
         functions: 65,
         lines: 65
       }
     }
   };
   ```

### C. Setting Thresholds (Practical Guide)

**Step 1**: Establish baseline
```bash
npm test -- --coverage
# Note current coverage: e.g., 45%
```

**Step 2**: Set achievable incremental goals
- Don't jump from 45% → 80% immediately
- Set threshold at current - 5% (40%) to prevent regression
- Increase by 10% every sprint until target reached

**Step 3**: Enforce patch coverage strictly
```yaml
# .github/workflows/test.yml
- name: Check coverage
  run: |
    npm test -- --coverage
    npx coverage-threshold-checker \
      --patch-threshold 80 \
      --global-threshold 70
```

**Step 4**: Monitor and adjust
- Review coverage reports monthly
- Identify high-value untested code
- Adjust thresholds based on team velocity

### D. What NOT to Do

❌ **Anti-Patterns**:
- Chasing 100% coverage (wastes time on trivial code)
- Focusing only on line coverage (ignores branches)
- Writing tests just to hit thresholds (test quality > quantity)
- Uniform thresholds across all modules (critical code needs higher coverage)
- Ignoring flaky tests to maintain coverage numbers

✅ **Better Approach**:
- Target 80-90% coverage on critical paths
- Accept 50-70% on UI/presentation layers
- Measure test quality via mutation testing (not just coverage)
- Focus on patch coverage over legacy code coverage

---

## 4. E2E Testing for Next.js 16 + React 19 + Convex

### A. Playwright vs Cypress (2025 Comparison)

| Feature | Playwright | Cypress |
|---------|-----------|---------|
| **Cross-browser** | Chromium, Firefox, WebKit (Safari) | Chromium, Firefox, Edge (WebKit experimental) |
| **Parallel Execution** | Built-in, fast | Requires Cypress Cloud ($$$) |
| **Network Interception** | Excellent (native) | Good (cy.intercept) |
| **Component Testing** | Yes (experimental) | Excellent (mature) |
| **TypeScript Support** | First-class | Good |
| **Auto-waiting** | Excellent | Excellent |
| **Debugging** | VS Code debugger, trace viewer | Time-travel debugging, excellent |
| **Speed** | Faster (headless optimized) | Slower (Electron overhead) |
| **Learning Curve** | Moderate | Easy |
| **Next.js 16 Support** | ✅ Full support | ⚠️ Version 13.6.3+ required (TypeScript 5 fix) |
| **React 19 Support** | ✅ Yes | ✅ Yes |
| **Best For** | Cross-browser E2E, CI/CD pipelines | Component testing, developer experience |

**Official Next.js Recommendations** (2025):
- **Playwright**: Preferred for E2E testing (https://nextjs.org/docs/pages/guides/testing/playwright)
- **Cypress**: Supported for E2E and component testing (https://nextjs.org/docs/pages/guides/testing/cypress)

### B. Playwright Setup (Recommended for GitPulse)

**Installation**:
```bash
npm install -D @playwright/test
npx playwright install
```

**Configuration** (`playwright.config.ts`):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Example E2E Test**:
```typescript
// e2e/report-generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Report Generation', () => {
  test('should generate daily report', async ({ page }) => {
    await page.goto('/dashboard/reports');

    // Authenticate (assuming Clerk)
    await page.click('[data-testid="sign-in"]');
    // ... authentication flow

    // Generate report
    await page.click('[data-testid="generate-daily-report"]');

    // Wait for report generation (polling Convex)
    await expect(page.locator('[data-testid="report-status"]'))
      .toHaveText('Completed', { timeout: 60000 });

    // Verify report content
    const reportTitle = page.locator('h1');
    await expect(reportTitle).toContain('Daily Standup');

    // Verify citations
    const citations = page.locator('[data-testid="citation-link"]');
    await expect(citations).toHaveCount.greaterThan(0);
  });
});
```

**Best Practices**:
1. **Use data-testid attributes** for stable selectors
2. **Mock external APIs** (GitHub, LLM) for reliability
3. **Test critical user flows** (auth, report generation, webhook ingestion)
4. **Parallelize tests** for speed
5. **Use Playwright's auto-waiting** (don't add arbitrary waits)

### C. Component Testing Approaches

**Option 1: Vitest + React Testing Library** (Recommended for GitPulse)
```bash
npm install -D @testing-library/react @testing-library/jest-dom vitest
```

```typescript
// components/ReportCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReportCard from './ReportCard';

describe('ReportCard', () => {
  it('displays coverage percentage', () => {
    render(<ReportCard coverage={85.5} />);
    expect(screen.getByText('85.5%')).toBeInTheDocument();
  });
});
```

**Option 2: Cypress Component Testing**
```bash
npm install -D cypress
```

```typescript
// components/ReportCard.cy.tsx
import ReportCard from './ReportCard';

describe('ReportCard', () => {
  it('displays coverage percentage', () => {
    cy.mount(<ReportCard coverage={85.5} />);
    cy.contains('85.5%').should('be.visible');
  });
});
```

**Recommendation for GitPulse**:
- **Unit/Integration**: Vitest + React Testing Library (already using Vitest)
- **E2E**: Playwright (better for Next.js 16 + cross-browser)

### D. Testing Convex Backend

**Convex Official Approach**: Use `convex-test` library

**Setup**:
```bash
npm install -D convex-test vitest @edge-runtime/vm
```

**Configuration** (`vitest.config.mts`):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: {
      deps: {
        inline: ['convex-test']
      }
    }
  }
});
```

**Example Test**:
```typescript
// convex/lib/reportOrchestrator.test.ts
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import { api } from './_generated/api';

describe('Report Orchestrator', () => {
  it('should generate report with citations', async () => {
    const t = convexTest(schema);

    // Insert test data
    await t.run(async (ctx) => {
      await ctx.db.insert('events', {
        actorId: 'user-123',
        contentHash: 'abc123',
        canonicalText: 'Opened PR #42',
        sourceUrl: 'https://github.com/org/repo/pull/42',
        timestamp: Date.now()
      });
    });

    // Call action
    const result = await t.action(api.reports.generateDaily, {
      userId: 'user-123',
      startDate: '2025-01-01',
      endDate: '2025-01-02'
    });

    // Verify
    expect(result.success).toBe(true);
    expect(result.data.citations.length).toBeGreaterThan(0);
  });
});
```

**Convex Testing Resources**:
- Official Docs: https://docs.convex.dev/testing/convex-test
- Example Test Suite: https://github.com/get-convex/convex-test/tree/main/convex

---

## 5. GitHub Actions Integration

### A. Recommended Workflow (Codecov + Playwright)

```yaml
# .github/workflows/test.yml
name: Test Coverage

on:
  pull_request:
    branches: [master, main]
  push:
    branches: [master, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests with coverage
        run: pnpm test -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          flags: unittests
          fail_ci_if_error: true

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### B. Self-Hosted Coverage (No External Service)

```yaml
# .github/workflows/coverage.yml
name: Coverage Report

on:
  pull_request:

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22.15'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Generate coverage
        run: pnpm test -- --coverage

      - name: Coverage Report
        uses: davelosert/vitest-coverage-report-action@v2
        with:
          json-summary-path: ./coverage/coverage-summary.json
          json-final-path: ./coverage/coverage-final.json
```

**Alternative (py-cov-action style)**:
```yaml
      - name: Coverage Comment
        uses: py-cov-action/python-coverage-comment-action@v3
        with:
          GITHUB_TOKEN: ${{ github.token }}
          COVERAGE_FILE: ./coverage/lcov.info
```

---

## 6. Recommendations for GitPulse

### A. Immediate Actions

1. **Choose Coverage Service**:
   - **Recommended**: Codecov (free for public repos, excellent PR comments)
   - **Alternative**: Self-hosted with `vitest-coverage-report-action` (privacy-focused)

2. **Set Coverage Thresholds**:
   ```javascript
   // jest.config.js or vitest.config.ts
   export default {
     test: {
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html', 'lcov'],
         thresholds: {
           global: {
             branches: 70,
             functions: 75,
             lines: 75,
             statements: 75
           },
           './convex/lib/**/*.ts': {  // Critical backend logic
             branches: 90,
             functions: 90,
             lines: 90
           }
         }
       }
     }
   };
   ```

3. **Add E2E Testing**:
   - Install Playwright
   - Create `e2e/` directory
   - Test critical flows (auth, report generation, webhook processing)

4. **Update GitHub Actions**:
   - Add coverage upload step (Codecov or self-hosted)
   - Add Playwright E2E tests
   - Generate coverage badges

5. **Add README Badge**:
   ```markdown
   [![codecov](https://codecov.io/gh/misty-step/gitpulse/branch/master/graph/badge.svg)](https://codecov.io/gh/misty-step/gitpulse)
   ```

### B. Testing Strategy by Module

| Module | Testing Approach | Target Coverage | Rationale |
|--------|------------------|-----------------|-----------|
| **convex/lib/** | Unit tests (Vitest + convex-test) | 90%+ | Critical business logic |
| **convex/actions/** | Integration tests (convex-test) | 85%+ | External API interactions |
| **app/components/** | Component tests (Vitest + RTL) | 65%+ | UI components (visual testing less critical) |
| **app/dashboard/** | E2E tests (Playwright) | 70%+ | User flows |
| **API routes** | Integration tests | 90%+ | Critical endpoints |

### C. Coverage Roadmap

**Phase 1: Foundation** (Week 1-2)
- ✅ Jest/Vitest already configured
- [ ] Set up Codecov
- [ ] Add coverage thresholds to config
- [ ] Create GitHub Actions workflow
- [ ] Add README badge

**Phase 2: Unit Test Expansion** (Week 3-4)
- [ ] Achieve 80% coverage on `convex/lib/`
- [ ] Test critical paths (canonicalizeEvent, reportOrchestrator, coverage)
- [ ] Add tests for edge cases

**Phase 3: E2E Testing** (Week 5-6)
- [ ] Install Playwright
- [ ] Write E2E tests for report generation
- [ ] Test webhook ingestion flow
- [ ] Test GitHub App installation

**Phase 4: Optimization** (Ongoing)
- [ ] Monitor coverage trends
- [ ] Identify high-risk low-coverage areas
- [ ] Add mutation testing (Stryker) for test quality
- [ ] Set up coverage alerts (Slack/email)

---

## 7. Additional Resources

### Official Documentation
- **Codecov**: https://docs.codecov.com/
- **Playwright**: https://playwright.dev/
- **Cypress**: https://docs.cypress.io/
- **Convex Testing**: https://docs.convex.dev/testing
- **Next.js Testing**: https://nextjs.org/docs/pages/guides/testing
- **Vitest**: https://vitest.dev/guide/coverage.html
- **SonarQube**: https://docs.sonarsource.com/sonarqube-server/

### Best Practice Articles
- "How much code coverage is enough?" (Graphite): https://graphite.dev/guides/code-coverage-best-practices
- "Modern Python CI with Coverage in 2025" (Daniel Nouri): https://danielnouri.org/notes/2025/11/03/modern-python-ci-with-coverage-in-2025/
- "Playwright vs. Cypress 2025 Showdown" (FrugalTesting): https://www.frugaltesting.com/blog/playwright-vs-cypress-2025

### Community Resources
- r/QualityAssurance (Reddit): Coverage tool discussions
- Vitest Discord: Active community for Vitest questions
- Playwright Discord: E2E testing help

---

## Summary

**Coverage Tool**: Codecov (cloud) or vitest-coverage-report-action (self-hosted)
**E2E Tool**: Playwright (better Next.js 16 support, cross-browser)
**Thresholds**: 80% patch coverage, 70% overall, 90%+ critical paths
**Priority**: Branch coverage > line coverage
**Focus**: Test quality over coverage percentage

**Next Steps for GitPulse**:
1. Set up Codecov (or self-hosted alternative)
2. Add coverage thresholds to Vitest config
3. Install Playwright for E2E tests
4. Create GitHub Actions workflow
5. Add coverage badge to README

---

*Research compiled: 2025-11-25*
*Sources: Codecov, Playwright, Cypress, Convex, Next.js official docs + 25+ industry articles*
