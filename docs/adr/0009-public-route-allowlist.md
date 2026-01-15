# 0009 – Public Route Allowlist Pattern

## Status
Accepted

## Context
Clerk middleware protects all routes by default. Some routes must be public:
- Landing page (`/`)
- Auth flows (`/sign-in`, `/sign-up`)
- Webhook receivers (`/api/webhooks/*`)
- Health probes (`/api/health`)

Initial approach used inline patterns in middleware, which drifted between environment configurations and was hard to test.

Alternatives considered:
1. **Inline patterns in middleware**: Simple but error-prone, no single source of truth.
2. **Environment-based config**: Flexible but harder to test and audit.
3. **Immutable allowlist with wrapper**: Single array, readonly, type-safe. Changes require code review.

## Decision
Use immutable allowlist in `lib/auth/publicRoutes.ts`:
- `PUBLIC_ROUTES` is `as const` readonly array
- `createPublicRouteMatcher()` wraps Clerk's mutable-array requirement
- Middleware imports matcher, not raw patterns
- Tests can import `PUBLIC_ROUTES` to verify contract

```typescript
export const PUBLIC_ROUTES = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
  "/preview(.*)",
] as const;
```

## Consequences
**Benefits:**
- Single source of truth for public routes
- TypeScript ensures patterns are string literals
- Changes require explicit code review
- Tests can verify route behavior without middleware mocking

**Tradeoffs:**
- Adding routes requires code change + deploy
- Pattern syntax must match Clerk's expectations (regex-like)
- Preview routes (`/preview(.*`) added for pre-launch marketing

**Security implications:**
- Webhook routes must verify HMAC signatures internally
- Health routes intentionally unauthenticated for load balancer probes
- Any new public route is a potential attack surface—review carefully

**Related ADR:**
- ADR 0001 covers health endpoint contract specifically
