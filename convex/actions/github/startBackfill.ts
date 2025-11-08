"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";

/**
 * Start backfill ingestion for GitHub App installation
 *
 * Algorithm per DESIGN.md startBackfill:
 * 1. Validate scope + user permissions, fetch installation token
 * 2. Create/continue ingestionJob doc with cursor
 * 3. While rate-limit budget > threshold and repos remaining:
 *    - Fetch next page via GraphQL search or REST with If-None-Match
 *    - For each timeline item, map to canonical fact and upsert
 *    - Update cursor, budget, progress
 * 4. Persist stats, pause job when rate-limit low; scheduler resumes after reset
 *
 * This is a stub - full implementation in Phase 1 Task 4.
 */
export const startBackfill = action({
  args: {
    installationId: v.number(),
    repositories: v.array(v.string()),
    since: v.number(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("startBackfill called (stub)", {
      installationId: args.installationId,
      repositories: args.repositories,
      since: new Date(args.since).toISOString(),
      until: args.until ? new Date(args.until).toISOString() : "now",
    });

    // TODO: Phase 1 Task 4 - Implement backfill logic
    // - Fetch installation token
    // - Create ingestionJob
    // - Loop through repos with rate-limit awareness
    // - Store events via canonical fact service

    throw new Error("startBackfill not yet implemented - see Phase 1 Task 4");
  },
});
