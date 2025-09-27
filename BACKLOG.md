# BACKLOG.md

*Last Updated: 2025-09-27*

## 🚨 Immediate Concerns

### Fix Critical Environment Variable Validation
**Location**: `src/lib/auth/authConfig.ts:37-38`
**Problem**: Direct casting of env vars without validation causes runtime crashes if missing
**Fix**: Add validation layer at app startup with clear error messages
**Impact**: Prevents production crashes due to missing configuration

### Resolve TypeScript Compilation Error in Compression Module
**Location**: `src/lib/compress.ts:126`
**Problem**: Buffer type incompatible with NextResponse - compression feature broken
**Fix**: Cast Buffer to Uint8Array or use proper type conversion
**Impact**: Enables response compression, reducing bandwidth by ~60%

### Update Critical Security Vulnerabilities
**Problem**: npm audit shows 4 vulnerabilities including critical sha.js issue
**Fix**: Run `npm audit fix --force` and update Next.js to latest patch
**Impact**: Closes known security vulnerabilities

### Add Input Validation to API Routes
**Location**: `src/app/api/summary/route.ts:225-237`
**Problem**: Installation IDs parsed without validation - injection risk
**Fix**: Implement zod schemas for all API inputs
**Impact**: Prevents injection attacks and type confusion bugs

## 🎯 High-Value Improvements

### Eliminate 'any' Types Throughout Codebase
**Scope**: 155 occurrences across 52 files
**Problem**: Loss of type safety causing runtime errors and poor DX
**Fix**: Define proper interfaces for GitHub API responses, component props, and internal data structures
**Impact**: Catches bugs at compile time, improves IDE support

### Break Down Massive API Route Handler
**Location**: `src/app/api/summary/route.ts:34-210`
**Problem**: 176-line function mixing auth, validation, GitHub API, and AI concerns
**Fix**: Extract into focused services: `validateRequest()`, `fetchGitHubData()`, `generateSummary()`
**Impact**: Makes code testable, debuggable, and maintainable

### Add Comprehensive Test Coverage
**Current**: Only 14 test files, no critical path coverage
**Fix**:
- Add unit tests for auth flows and API handlers
- Add integration tests for GitHub API interactions
- Add E2E tests for user workflows with Playwright
**Impact**: Prevents regressions, enables confident refactoring

### Implement Proper Error Boundaries
**Problem**: Unhandled errors crash entire UI
**Fix**: Add React error boundaries at route and component levels with fallback UI
**Impact**: Graceful degradation instead of white screens

### Add Response Caching Strategy
**Location**: All API routes
**Problem**: Repeated expensive GitHub API calls
**Fix**: Implement Redis caching with smart invalidation
**Impact**: 10x faster response times, reduced GitHub API usage

## 🔧 Technical Debt Worth Paying

### Refactor Dashboard Component State Management
**Location**: `src/app/dashboard/page.tsx:24-316`
**Problem**: 292-line component with 10+ state variables
**Fix**: Extract custom hooks: `useRepositories()`, `useFilters()`, `useSummaryGeneration()`
**Impact**: Reduces complexity, improves testability

### Standardize Logging Throughout Codebase
**Problem**: Mix of console.log and logger across 15 files
**Fix**: Replace all console.* with structured logging using winston
**Impact**: Better production observability and debugging

### Migrate to ESLint v9 Configuration
**Location**: `.eslintrc.js`
**Problem**: Using deprecated configuration format
**Fix**: Migrate to flat config format (eslint.config.js)
**Impact**: Fixes linting issues, enables new ESLint features

### Optimize Repository Filtering Logic
**Location**: `src/app/dashboard/page.tsx:143-160`
**Problem**: localStorage checks on every render
**Fix**: Move to useCallback with proper dependencies
**Impact**: Eliminates unnecessary re-renders

### Add Pre-commit Hooks
**Problem**: Code quality not enforced before commits
**Fix**: Configure Husky to run lint, typecheck, and tests
**Impact**: Consistent code quality across team

### Centralize Authentication Patterns
**Problem**: Mixed OAuth and GitHub App patterns
**Fix**: Create unified auth service with clear boundaries
**Impact**: Simpler security model, easier to audit

## 💡 Nice to Have

### Add Accessibility Features
**Problem**: Missing ARIA attributes and semantic HTML
**Fix**: Audit with axe-core, add proper labels and roles
**Impact**: Makes app usable for all users

### Improve Loading States
**Problem**: Generic "loading" messages
**Fix**: Add specific progress indicators for each operation
**Impact**: Better perceived performance

### Add User-Friendly Error Messages
**Location**: `src/components/AuthError.tsx`
**Problem**: Technical errors shown to users
**Fix**: Map technical errors to helpful user messages
**Impact**: Reduces support burden

### Implement GitHub API Pagination
**Location**: `src/lib/github/auth.ts:52-54`
**Problem**: No pagination for installations
**Fix**: Add cursor-based pagination with batching
**Impact**: Handles users with many repositories efficiently

### Add Development Documentation
**Problem**: No clear onboarding for new developers
**Fix**: Create comprehensive DEVELOPMENT.md with setup guide
**Impact**: Faster onboarding, increased contribution

### Configure Prettier
**Problem**: Inconsistent code formatting
**Fix**: Add .prettierrc with team-agreed rules
**Impact**: Consistent code style, fewer review comments

## ✅ Definition of Done

For each backlog item:
- [ ] Code changes implemented and tested locally
- [ ] Unit tests added/updated with >80% coverage
- [ ] TypeScript compilation passes with no errors
- [ ] ESLint and type checking pass
- [ ] Documentation updated if needed
- [ ] PR created with clear description
- [ ] Code reviewed and approved
- [ ] CI/CD pipeline passes

## 📊 Success Metrics

Track these to measure improvement:
- **Type Safety**: Reduce 'any' usage from 155 to <10
- **Test Coverage**: Increase from ~20% to >80%
- **Build Time**: Keep under 60 seconds
- **Bundle Size**: Keep under 500KB gzipped
- **Lighthouse Score**: Maintain >90 for all categories
- **API Response Time**: P95 under 500ms
- **Error Rate**: <0.1% of requests

## 🗂️ Archived/Decided Against

*Items deliberately not pursued with reasoning*

---

*This backlog is a living document. Update priorities based on user feedback and business needs.*