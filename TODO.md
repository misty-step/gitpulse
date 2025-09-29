# GitPulse TODO - GitHub API Rate Limit Resolution

## 🚨 CRITICAL - Immediate Fix (Stop the bleeding)

### Serial Processing Quick Fix
- [x] In `src/lib/github/commits.ts:308-327`, replace `Promise.all` with sequential processing using a for...of loop
- [x] Add 100ms delay between repository fetches using `await new Promise(resolve => setTimeout(resolve, 100))`
- [x] In `src/lib/github/commits.ts:342-361`, replace second `Promise.all` with sequential processing
- [x] In `src/lib/github/commits.ts:373-392`, replace third `Promise.all` with sequential processing
- [x] Test with 10 repositories to verify no rate limit errors (see docs/RATE_LIMIT_FIX_TESTING.md)
- [x] Test with 50 repositories to verify no rate limit errors (see docs/RATE_LIMIT_FIX_TESTING.md)
- [x] Deploy behind environment variable `GITHUB_SERIAL_FETCH=true` for quick rollback

## 📦 Phase 1: GraphQL Foundation (Days 1-2)

### Package Installation
- [x] Run `pnpm add graphql@^16.8.0` to install GraphQL core
- [x] Run `pnpm add graphql-request@^6.1.0` for GraphQL client
- [x] Run `pnpm add @graphql-codegen/cli @graphql-codegen/typescript --save-dev` for type generation
- [x] Verify packages installed correctly with `pnpm ls graphql graphql-request`

### GraphQL Client Setup
- [x] Create directory `src/lib/github/graphql/`
- [x] Create `src/lib/github/graphql/client.ts` with basic GraphQLClient class skeleton
- [x] Add constructor that accepts `accessToken: string` parameter
- [x] Configure client with GitHub GraphQL endpoint `https://api.github.com/graphql`
- [x] Add authorization header `Bearer ${accessToken}` to client configuration
- [x] Add `X-Github-Next-Global-ID: 1` header for new ID format support
- [x] Create unit test file `src/lib/github/graphql/__tests__/client.test.ts`
- [x] Write test to verify client instantiation with mock token
- [x] Write test to verify headers are set correctly

### GraphQL Query Templates
- [x] Create `src/lib/github/graphql/queries.ts` file
- [x] Define `REPOSITORY_NODE_ID_QUERY` to convert owner/name to node IDs
- [x] Define `COMMIT_HISTORY_FRAGMENT` with fields: oid, committedDate, message, author (name, email, user.login)
- [x] Define `BATCH_COMMITS_QUERY` that accepts array of node IDs and date range
- [x] Add `rateLimit { cost, remaining, resetAt }` to all queries for monitoring
- [ ] Test queries in GitHub GraphQL Explorer (https://docs.github.com/en/graphql/overview/explorer)
- [x] Save working query examples in `src/lib/github/graphql/queries.examples.graphql`

## 🔧 Phase 2: Core Implementation (Days 3-5)

### Repository ID Resolution
- [ ] In `src/lib/github/graphql/client.ts`, create `resolveRepositoryIds(repos: string[]): Promise<Map<string, string>>`
- [ ] Implement batching logic to handle max 50 repositories per query
- [ ] Parse repository strings (e.g., "facebook/react") into owner and name
- [ ] Build dynamic GraphQL query with aliased repository fields
- [ ] Execute query and map results to `Map<repoFullName, nodeId>`
- [ ] Handle repositories that return null (private/deleted) by filtering from results
- [ ] Add retry logic for transient failures with 1-second delay
- [ ] Cache resolved IDs in memory with 1-hour TTL
- [ ] Write test with mock data for 100 repositories
- [ ] Write test for handling missing repositories gracefully

### Commit History Fetching
- [ ] Create `fetchCommitsGraphQL(nodeIds: string[], since: string, until: string, author?: string): Promise<Commit[]>`
- [ ] Implement query builder that chunks nodeIds into groups of 50 maximum
- [ ] Add `first: 100` pagination parameter to commit history
- [ ] Implement cursor-based pagination for repositories with >100 commits
- [ ] Transform GraphQL response to match existing `Commit` type structure
- [ ] Map `oid` → `sha`, `committedDate` → `commit.author.date`
- [ ] Preserve `repository.full_name` in transformed commits
- [ ] Handle null author.user gracefully (non-GitHub users)
- [ ] Add performance timing with `console.time()` for development
- [ ] Write test for single repository with 50 commits
- [ ] Write test for pagination with 150 commits
- [ ] Write test for author filtering

### Data Transformation Layer
- [ ] Create `src/lib/github/graphql/transformers.ts`
- [ ] Implement `transformGraphQLCommit(graphqlCommit: any): Commit` function
- [ ] Map all required fields maintaining backwards compatibility
- [ ] Handle optional fields with sensible defaults
- [ ] Create `transformGraphQLRepository(graphqlRepo: any): Repository` function
- [ ] Write comprehensive unit tests for all field mappings
- [ ] Test with actual GitHub API response samples

## 🎛️ Phase 3: Integration & Feature Flags (Days 6-7)

### Feature Flag System
- [ ] Add `FEATURE_GRAPHQL_COMMITS=false` to `.env.local`
- [ ] Create `src/lib/features.ts` with `isGraphQLEnabled()` function
- [ ] Read from `process.env.FEATURE_GRAPHQL_COMMITS` with fallback to false
- [ ] Add runtime toggle check (don't require restart)
- [ ] Create `FEATURE_GRAPHQL_BATCH_SIZE=50` for configurable batching
- [ ] Add `FEATURE_GRAPHQL_PAGE_SIZE=100` for pagination tuning

### Backwards Compatible Wrapper
- [ ] In `src/lib/github/commits.ts`, add GraphQL import at top
- [ ] Modify `fetchCommitsForRepositories` to check feature flag first
- [ ] If GraphQL enabled, call new GraphQL implementation
- [ ] If GraphQL disabled, use existing REST implementation (now serial)
- [ ] Ensure function signature remains unchanged
- [ ] Add debug logging to indicate which path was taken
- [ ] Test with flag enabled - verify GraphQL path
- [ ] Test with flag disabled - verify REST path
- [ ] Test data parity between both implementations

### Error Handling
- [ ] Create custom `GraphQLError` class extending Error
- [ ] Add error code detection for rate limits (RATE_LIMITED)
- [ ] Add error code detection for node limits (NODE_LIMIT_EXCEEDED)
- [ ] Implement fallback from GraphQL to REST on critical errors
- [ ] Log all GraphQL errors with full context
- [ ] Add Sentry/error tracking integration points
- [ ] Test rate limit error handling
- [ ] Test malformed query error handling
- [ ] Test network timeout handling

## ⚡ Phase 4: Rate Limiting (Days 8-9)

### Token Bucket Implementation
- [ ] Create `src/lib/rateLimit/tokenBucket.ts`
- [ ] Implement `TokenBucket` class with capacity and refill rate
- [ ] Add `take(tokens: number): boolean` method
- [ ] Implement time-based refill logic without timers
- [ ] Add `tokensAvailable(): number` getter
- [ ] Add `timeUntilNextToken(): number` for UI feedback
- [ ] Write unit test for token consumption
- [ ] Write unit test for token refill over time
- [ ] Write test for burst capacity

### Adaptive Rate Limiter
- [ ] Create `src/lib/rateLimit/adaptiveRateLimiter.ts`
- [ ] Initialize with TokenBucket(10 capacity, 2/second refill)
- [ ] Implement `execute<T>(fn: () => Promise<T>): Promise<T>` wrapper
- [ ] Detect 403/429 responses as rate limit errors
- [ ] Extract `retry-after` header when present
- [ ] Implement exponential backoff starting at 1 minute
- [ ] Cap backoff multiplier at 8x (8 minutes max)
- [ ] Add jitter ±10% to prevent thundering herd
- [ ] Reset multiplier on successful request
- [ ] Add metrics collection for rate limit hits
- [ ] Test with simulated rate limit responses
- [ ] Test backoff progression over multiple failures

### Integration with GraphQL Client
- [ ] Wrap GraphQL client execute method with rate limiter
- [ ] Configure initial tokens based on GitHub App vs OAuth
- [ ] Adjust refill rate based on remaining quota from responses
- [ ] Add circuit breaker that pauses all requests for 60s after 5 consecutive rate limits
- [ ] Log rate limiter state changes
- [ ] Test with rapid successive requests
- [ ] Test circuit breaker activation and recovery

## 💾 Phase 5: Caching Layer (Days 10-11)

### Cache Implementation
- [ ] Create `src/lib/cache/githubCache.ts`
- [ ] Use `Map<string, CacheEntry>` for in-memory storage
- [ ] Define `CacheEntry` type with data, etag, timestamp, ttl fields
- [ ] Implement `get(key, fetcher, options)` method
- [ ] Add stale check based on timestamp + ttl
- [ ] Implement `set(key, data, options)` method
- [ ] Add `clear()` and `delete(key)` methods
- [ ] Add max size limit (1000 entries) with LRU eviction
- [ ] Write test for cache hit scenario
- [ ] Write test for cache miss scenario
- [ ] Write test for stale data handling
- [ ] Write test for LRU eviction

### Cache Key Generation
- [ ] Create `generateCommitCacheKey(repos: string[], since: string, until: string, author?: string): string`
- [ ] Sort repositories array for consistent keys
- [ ] Normalize date formats to ISO strings
- [ ] Include author or "all" in key
- [ ] Use SHA-256 hash for key (keep under 250 chars)
- [ ] Test key consistency with same inputs
- [ ] Test key uniqueness with different inputs

### ETag Support
- [ ] Store ETag from GraphQL response headers
- [ ] Add `If-None-Match` header to requests with cached ETag
- [ ] Handle 304 Not Modified responses
- [ ] Update cache timestamp without refetching data
- [ ] Track ETag cache hits in metrics
- [ ] Test with valid ETag (304 response)
- [ ] Test with stale ETag (200 response)

## 📊 Phase 6: Monitoring & Metrics (Days 12-13)

### Performance Instrumentation
- [ ] Create `src/lib/metrics/index.ts`
- [ ] Add counter for GraphQL queries: `graphql_queries_total`
- [ ] Add counter for REST fallbacks: `rest_fallback_total`
- [ ] Add histogram for query duration: `query_duration_seconds`
- [ ] Add gauge for rate limit remaining: `github_rate_limit_remaining`
- [ ] Add counter for cache hits/misses: `cache_hits_total`, `cache_misses_total`
- [ ] Export metrics in Prometheus format if configured
- [ ] Add performance marks for critical paths

### Logging Enhancement
- [ ] Add structured logging for all GraphQL queries
- [ ] Log query cost from rateLimit response field
- [ ] Log number of repositories per batch
- [ ] Log pagination cursor advancement
- [ ] Add correlation IDs to trace request flow
- [ ] Log cache key and hit/miss status
- [ ] Create debug mode that logs full queries (dev only)
- [ ] Add log sampling for high-volume paths

### Error Tracking
- [ ] Instrument all try-catch blocks with error context
- [ ] Add breadcrumbs for debugging: last 10 operations before error
- [ ] Track error rates by error type
- [ ] Add alerts for >1% error rate
- [ ] Add alerts for rate limit remaining <100
- [ ] Create error dashboard queries

## 🧪 Phase 7: Testing (Days 14-15)

### Unit Tests
- [ ] Test GraphQL client with mocked responses
- [ ] Test ID resolution with 150 repositories
- [ ] Test commit fetching with pagination
- [ ] Test data transformation completeness
- [ ] Test token bucket refill math
- [ ] Test rate limiter backoff calculation
- [ ] Test cache key generation determinism
- [ ] Test feature flag toggling
- [ ] Achieve >80% code coverage for new code

### Integration Tests
- [ ] Create test with real GitHub API token (limited to 5 repos)
- [ ] Test full flow: REST → GraphQL → Transform → Cache
- [ ] Verify data parity between REST and GraphQL
- [ ] Test rate limit recovery behavior
- [ ] Test cache invalidation after commits
- [ ] Test pagination with 200+ commits
- [ ] Test author filtering accuracy

### Load Tests
- [ ] Create k6 script in `tests/load/graphql.js`
- [ ] Simulate 100 concurrent users
- [ ] Test with 100 repositories per request
- [ ] Verify no rate limit errors in 5-minute test
- [ ] Verify p95 response time <5 seconds
- [ ] Test cache effectiveness (>60% hit rate)
- [ ] Test memory usage stays under 512MB

### Error Scenario Tests
- [ ] Test with invalid GitHub token
- [ ] Test with revoked app installation
- [ ] Test with deleted repository in list
- [ ] Test with network timeout (5 second)
- [ ] Test with malformed GraphQL response
- [ ] Test with 500 errors from GitHub
- [ ] Verify graceful degradation in all cases

## 🚀 Phase 8: Production Rollout (Week 3)

### Staged Deployment
- [ ] Deploy with `FEATURE_GRAPHQL_COMMITS=false`
- [ ] Verify deployment successful with REST API working
- [ ] Enable for internal testing accounts only
- [ ] Monitor for 24 hours, check error rates
- [ ] Enable for 10% of users (by user ID hash)
- [ ] Monitor for 48 hours, compare REST vs GraphQL metrics
- [ ] Enable for 50% of users
- [ ] Monitor for 48 hours, verify cache hit rates
- [ ] Enable for 100% of users
- [ ] Keep feature flag for emergency rollback

### Performance Validation
- [ ] Confirm API calls reduced by >90%
- [ ] Verify p95 latency <5 seconds
- [ ] Check cache hit rate >60%
- [ ] Validate zero rate limit errors in 24 hours
- [ ] Compare memory usage before/after
- [ ] Verify no increase in error rates

### Documentation
- [ ] Update README.md with GraphQL feature
- [ ] Document environment variables in `.env.example`
- [ ] Create runbook for rate limit issues
- [ ] Document cache invalidation procedures
- [ ] Add GraphQL query examples to docs
- [ ] Update API documentation
- [ ] Create troubleshooting guide
- [ ] Record architecture decision record (ADR)

### Cleanup
- [ ] Remove old concurrent Promise.all code
- [ ] Delete unused REST pagination logic
- [ ] Remove temporary debug logging
- [ ] Archive old rate limit workarounds
- [ ] Update code comments for clarity
- [ ] Remove feature flag after 30 days stable

## 🔍 Future Optimizations

### Progressive Loading UI
- [ ] Implement streaming responses for large datasets
- [ ] Show repositories as they complete
- [ ] Add loading skeleton for better UX
- [ ] Display partial results during fetch

### Webhook Integration
- [ ] Setup webhook endpoint for push events
- [ ] Update cache on webhook receipt
- [ ] Reduce polling frequency for webhook-enabled repos
- [ ] Track webhook reliability metrics

### Background Sync
- [ ] Implement background job for popular repositories
- [ ] Pre-fetch common date ranges
- [ ] Warm cache during off-peak hours
- [ ] Setup job scheduling infrastructure

---

*Remember: Ship the simplest thing that works, then iterate. Don't let perfect be the enemy of good.*