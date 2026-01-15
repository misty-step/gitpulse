# React Hooks

Deep modules for React state management. Each hook hides async coordination complexity behind a simple interface.

## Hooks

| Hook | Interface | Hides |
|------|-----------|-------|
| `useAuthenticatedConvexUser()` | `{ clerkUser, convexUser, isLoading }` | Clerk + Convex loading choreography, query skipping |
| `useIntegrationStatus()` | `{ status, isLoading }` | GitHub integration status polling |

## Usage

```typescript
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";

function Profile() {
  const { convexUser, isLoading, isAuthenticated } = useAuthenticatedConvexUser();

  if (isLoading) return <Skeleton />;
  if (!isAuthenticated) return <SignInPrompt />;

  return <div>{convexUser?.ghLogin}</div>;
}
```

## Design Rationale

These hooks follow the deep module principle - they expose minimal state while hiding:

- **Auth loading choreography**: Clerk loads async, then Convex queries must wait for Clerk ID
- **Query skipping edge cases**: Convex `useQuery` with "skip" returns undefined forever
- **Multi-system coordination**: Two async systems (Clerk + Convex) with interdependencies

Without these hooks, every component would duplicate the loading state logic.

## See Also

- [components/README.md](../components/README.md) - UI components using these hooks
