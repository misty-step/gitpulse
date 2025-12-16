# React Components

Shared React components for GitPulse.

## Structure

```
components/
├── ui/                 # ShadCN primitives (Button, Card, Dialog, etc.)
└── *.tsx               # Application components
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `CitationCard.tsx` | Display individual citations with GitHub links |
| `CitationDrawer.tsx` | Side panel for citation details |
| `KPICard.tsx` | Key performance indicator display |
| `IntegrationStatusBanner.tsx` | GitHub integration status |
| `OnboardingGuard.tsx` | Route protection for onboarding flow |
| `AuthLoadingBoundary.tsx` | Clerk authentication loading state |
| `Skeleton.tsx` | Loading skeleton animations |
| `ThemeProvider.tsx` | Light/dark theme context |

## Styling

Uses [Tailwind CSS 4](https://tailwindcss.com/) with [ShadCN/UI](https://ui.shadcn.com/) primitives.

```tsx
// Example component using Tailwind
export function MyComponent({ title }: { title: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
```

## Convex Integration

Use Convex hooks for data fetching:

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function UserProfile({ userId }: { userId: string }) {
  const user = useQuery(api.users.getById, { id: userId });

  if (!user) return <Skeleton />;

  return <div>{user.name}</div>;
}
```

## UI Primitives

ShadCN components in `ui/` directory:

- Button, Card, Dialog, DropdownMenu
- Input, Label, Textarea
- Table, Tabs, Toast
- Skeleton, Progress

## See Also

- [ShadCN/UI Docs](https://ui.shadcn.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
