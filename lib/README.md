# Frontend Library Utilities

Shared utilities for Next.js frontend. Deep modules following Ousterhout's principle - simple interfaces hiding implementation complexity.

## Deep Modules

| Module | Interface | Hides |
|--------|-----------|-------|
| `errors.ts` | `handleConvexError()`, `withErrorHandling()` | Error classification, toast choreography, retry logic |
| `health/` | `makeHealthResponse()` | Convex health checks, cache headers, liveness vs deep modes |
| `auth/publicRoutes.ts` | `publicRouteMatcher` | Route matching for Clerk middleware |
| `github/verifySignature.ts` | `verifyWebhookSignature()` | HMAC-SHA256 webhook verification |

## Key Files

| File | Purpose |
|------|---------|
| `errors.ts` | Convex error handling with user-friendly toasts |
| `analytics.ts` | Funnel event tracking (`trackFunnel`, `trackOnce`) |
| `integrationStatus.ts` | GitHub integration status types and helpers |
| `metrics.ts` | Client-side metric logging |

## Usage

```typescript
import { handleConvexError, withErrorHandling } from "@/lib/errors";
import { trackFunnel } from "@/lib/analytics";

// Error handling wrapper
const result = await withErrorHandling(
  () => mutation({ arg }),
  { operation: "save settings", showLoading: true }
);

// Funnel tracking
trackFunnel("github_connected");
```

## See Also

- [convex/lib/README.md](../convex/lib/README.md) - Backend utilities
