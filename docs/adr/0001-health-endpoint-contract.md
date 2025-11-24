# 0001 – Health Endpoint Contract

## Status
Accepted

## Context
We split `/api/health` into fast liveness (default) and deep Convex-aware mode (`?deep=1`). External monitors (UptimeRobot, load balancers, k8s probes) need unauthenticated access. We intentionally treat any Convex degradation as a blocker for deep health to avoid serving partial functionality.

## Decision
- Make `/api/health(.*)` public via middleware allowlist so health probes never require auth.
- Keep liveness mode dependency-free and always HTTP 200.
- In deep mode, map Convex states to HTTP codes:
  - `ok` → 200
  - `degraded | error | missing URL | timeout` → 503 and `status: "error"`
- Enforce shared cache headers and consistent body/HEAD semantics via a dedicated health module.
- Public route matcher is generated from an immutable allowlist; callers never deal with Clerk's mutable matcher API.

## Consequences
- Instances are removed from pools when Convex is degraded, prioritizing correctness over availability for deep probes.
- Future changes to the health contract flow through the health module, minimizing change amplification.
- Public-route drift is test-guarded; HEAD/GET parity is covered by tests.
