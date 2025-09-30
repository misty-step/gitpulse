# GitPulse TODO - Active Work Items

> Focus: Implementation tasks only. Testing happens in tests/, documentation in DoD, deployment in runbooks.

## Rate Limiting

### Adaptive Rate Limiter
- [x] Create `src/lib/rateLimit/adaptiveRateLimiter.ts`
- [x] Initialize with TokenBucket(10 capacity, 2/second refill)
- [x] Implement `execute<T>(fn: () => Promise<T>): Promise<T>` wrapper
- [x] Detect 403/429 responses as rate limit errors
- [x] Extract `retry-after` header when present
- [x] Implement exponential backoff starting at 1 minute
- [x] Cap backoff multiplier at 8x (8 minutes max)
- [x] Add jitter ±10% to prevent thundering herd
- [x] Reset multiplier on successful request
- [x] Add metrics collection for rate limit hits

### GraphQL Client Integration
- [x] Wrap GraphQL client execute method with rate limiter
- [x] Configure initial tokens based on GitHub App vs OAuth
- [x] Adjust refill rate based on remaining quota from responses
- [x] Add circuit breaker that pauses all requests for 60s after 5 consecutive rate limits
- [x] Log rate limiter state changes

## Caching Layer

### Core Cache Implementation
- [x] Create `src/lib/cache/githubCache.ts`
- [x] Use `Map<string, CacheEntry>` for in-memory storage
- [x] Define `CacheEntry` type with data, etag, timestamp, ttl fields
- [x] Implement `get(key, fetcher, options)` method
- [x] Add stale check based on timestamp + ttl
- [x] Implement `set(key, data, options)` method
- [x] Add `clear()` and `delete(key)` methods
- [x] Add max size limit (1000 entries) with LRU eviction

### Cache Key Generation
- [x] Create `generateCommitCacheKey(repos: string[], since: string, until: string, author?: string): string`
- [x] Sort repositories array for consistent keys
- [x] Normalize date formats to ISO strings
- [x] Include author or "all" in key
- [x] Use SHA-256 hash for key (keep under 250 chars)

### ETag Support
- [x] Store ETag from GraphQL response headers
- [x] Add `If-None-Match` header to requests with cached ETag
- [x] Handle 304 Not Modified responses
- [x] Update cache timestamp without refetching data
- [x] Track ETag cache hits in metrics

## Monitoring & Instrumentation

### Performance Metrics
- [x] Create `src/lib/metrics/index.ts`
- [x] Add counter for GraphQL queries: `graphql_queries_total`
- [x] Add counter for REST fallbacks: `rest_fallback_total`
- [x] Add histogram for query duration: `query_duration_seconds`
- [x] Add gauge for rate limit remaining: `github_rate_limit_remaining`
- [x] Add counter for cache hits/misses: `cache_hits_total`, `cache_misses_total`
- [x] Export metrics in Prometheus format if configured
- [x] Add performance marks for critical paths

### Structured Logging
- [x] Add structured logging for all GraphQL queries
- [x] Log query cost from rateLimit response field
- [x] Log number of repositories per batch
- [x] Log pagination cursor advancement
- [x] Add correlation IDs to trace request flow
- [x] Log cache key and hit/miss status
- [x] Create debug mode that logs full queries (dev only)
- [x] Add log sampling for high-volume paths

### Error Tracking
- [x] Instrument all try-catch blocks with error context
- [x] Add breadcrumbs for debugging: last 10 operations before error
- [x] Track error rates by error type