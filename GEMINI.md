# GEMINI.md

## Project Overview

**GitPulse** is an AI-powered GitHub activity analytics platform. It generates citation-backed reports (daily standups, weekly retrospectives) from GitHub events, ensuring every claim links to a verifiable source.

**Core Philosophy:** Deep Modules & Information Hiding (Ousterhout).

## Tech Stack

*   **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5.7, Tailwind CSS 4.
*   **Backend:** Convex (Serverless functions, Database, Vector Search).
*   **Auth:** Clerk (Session management, GitHub OAuth).
*   **AI:** Voyage AI (Embeddings), Gemini 2.5 Flash (Report generation).
*   **Testing:** Jest (Unit/Integration), Playwright (E2E).
*   **Package Manager:** `pnpm`.

## Architecture & Data Flow

1.  **Ingestion:** GitHub Webhooks (Real-time) & Backfills -> Canonical Fact Store.
2.  **Storage:** Convex Database (12 tables).
    *   `events`: Deduplicated via SHA-256 content hash.
    *   `embeddings`: 1024-dim Voyage vectors.
3.  **Intelligence:**
    *   **Content Addressing:** Events are hashed to prevent duplicate processing.
    *   **Report Generation:** Deterministic caching based on input hash.
4.  **Module Boundaries:**
    *   `convex/lib/githubApp.ts`: Encapsulates GitHub Auth/API.
    *   `convex/lib/canonicalFactService.ts`: Handles data normalization & deduplication.
    *   `convex/lib/reportOrchestrator.ts`: Manages LLM interaction & citations.

## Key Directories

*   `app/`: Next.js App Router (Frontend).
*   `convex/`: Backend logic (Schema, Actions, Queries, Mutations).
    *   `schema.ts`: Database schema definition.
    *   `actions/`: External side effects (GitHub API, LLM calls).
    *   `queries/` & `mutations/`: Internal DB operations.
*   `lib/`: Shared utilities (Pure functions).
*   `components/`: React components (UI).
*   `e2e/`: Playwright end-to-end tests.
*   `tests/`: Unit & Integration tests.

## Development Commands

### Setup & Run
```bash
pnpm install            # Install dependencies
pnpm dev                # Start Next.js + Convex dev server (concurrently)
npx convex dev          # Start Convex dev server only
npx convex dashboard    # Open Convex dashboard
```

### Quality & Testing
```bash
pnpm typecheck          # TypeScript check
pnpm lint               # ESLint
pnpm format             # Prettier
pnpm test               # Run Jest tests
pnpm test:coverage      # Run Jest with coverage
pnpm test:e2e           # Run Playwright tests
```

### Deployment
*   **Preview:** Vercel automatically deploys PRs with isolated Convex backends.
*   **Production:** Vercel deploys `master` branch.

## Conventions & Style

*   **TypeScript:** Strict mode. No `any`.
*   **Imports:** Use `@/` alias for project root.
*   **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
*   **Testing:**
    *   Write tests *next to* the code they test (co-location).
    *   Use Factories (`tests/utils/factories.ts`) for test data.
    *   Avoid mocking internal implementation details; test behavior.
*   **Convex:**
    *   Keep logic in `convex/lib` (Deep Modules).
    *   Expose minimal surface area in `actions`/`mutations`.
    *   Use `internal.*` for cross-function calls within Convex.

## Environment Variables

Managed via `.env.local` (local) and Convex Dashboard (production/preview).
*   `NEXT_PUBLIC_CONVEX_URL`
*   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
*   `CLERK_SECRET_KEY`
*   `GITHUB_TOKEN` (Convex Env)
*   `GOOGLE_API_KEY` (Convex Env)
*   `VOYAGE_API_KEY` (Convex Env)
