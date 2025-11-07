import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * GitPulse Database Schema - Convex
 *
 * Migrated from Prisma (Postgres) to Convex
 * Key differences:
 * - No SQL, uses Convex queries/mutations
 * - Native vector search (no pgvector needed)
 * - Real-time reactive queries
 * - Automatic indexing
 */

export default defineSchema({
  /**
   * Users table - GitHub user profiles
   */
  users: defineTable({
    // Clerk authentication
    clerkId: v.optional(v.string()), // Clerk user ID (subject from JWT)
    tokenIdentifier: v.optional(v.string()), // Unique token from Clerk

    // GitHub OAuth (for automated standups)
    githubAccessToken: v.optional(v.string()), // OAuth access token
    githubRefreshToken: v.optional(v.string()), // OAuth refresh token
    githubTokenExpiry: v.optional(v.number()), // Unix timestamp when token expires
    githubUsername: v.optional(v.string()), // GitHub username from OAuth (may differ from ghLogin)

    // GitHub identifiers
    ghId: v.number(), // GitHub user ID
    ghLogin: v.string(), // GitHub username
    ghNodeId: v.string(), // GitHub GraphQL node ID

    // Profile data
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    blog: v.optional(v.string()),
    twitterUsername: v.optional(v.string()),

    // GitHub stats
    publicRepos: v.optional(v.number()),
    publicGists: v.optional(v.number()),
    followers: v.optional(v.number()),
    following: v.optional(v.number()),

    // Automated standup settings
    timezone: v.optional(v.string()), // IANA timezone (e.g., "America/Los_Angeles")
    reportHourUTC: v.optional(v.number()), // Pre-calculated: user's 9am → UTC hour (0-23)
    dailyReportsEnabled: v.optional(v.boolean()), // Default: true
    weeklyReportsEnabled: v.optional(v.boolean()), // Default: true
    weeklyDayUTC: v.optional(v.number()), // Day of week in UTC (0=Sun, 6=Sat)

    // Onboarding
    onboardingCompleted: v.optional(v.boolean()), // Whether user completed onboarding wizard

    // Metadata
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_ghId", ["ghId"])
    .index("by_ghLogin", ["ghLogin"])
    .index("by_ghNodeId", ["ghNodeId"])
    .index("by_reportHourUTC", ["reportHourUTC"])
    .index("by_weeklySchedule", ["weeklyDayUTC", "reportHourUTC"]),

  /**
   * Repositories table - GitHub repositories
   */
  repos: defineTable({
    // GitHub identifiers
    ghId: v.number(),
    ghNodeId: v.string(),
    fullName: v.string(), // "owner/repo"

    // Repository data
    name: v.string(),
    owner: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    homepage: v.optional(v.string()),
    language: v.optional(v.string()),
    isPrivate: v.boolean(),
    isFork: v.boolean(),
    isArchived: v.boolean(),

    // Stats
    stars: v.optional(v.number()),
    forks: v.optional(v.number()),
    openIssues: v.optional(v.number()),
    watchers: v.optional(v.number()),
    size: v.optional(v.number()),

    // Timestamps
    ghCreatedAt: v.number(),
    ghUpdatedAt: v.number(),
    ghPushedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ghId", ["ghId"])
    .index("by_ghNodeId", ["ghNodeId"])
    .index("by_fullName", ["fullName"])
    .index("by_owner", ["owner"]),

  /**
   * Events table - GitHub activity events
   *
   * Types:
   * - pr_opened: Pull request created
   * - pr_closed: Pull request merged/closed
   * - pr_review: Pull request reviewed
   * - commit: Commit pushed
   * - issue_opened: Issue created
   * - issue_closed: Issue closed
   * - issue_comment: Comment on issue
   * - pr_comment: Comment on PR
   */
  events: defineTable({
    // Event type and identifiers
    type: v.string(), // Event type enum (see above)
    ghId: v.optional(v.string()), // GitHub event/object ID
    ghNodeId: v.optional(v.string()),

    // References
    actorId: v.id("users"), // User who performed action
    repoId: v.id("repos"), // Repository where event occurred

    // Event timestamp
    ts: v.number(), // Unix timestamp when event occurred

    // Event metadata (JSON)
    // Structure varies by event type, examples:
    // pr_opened: { prNumber, title, url, additions, deletions, changedFiles }
    // commit: { sha, message, url, additions, deletions, changedFiles }
    // review: { prNumber, state, body, url }
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_actor", ["actorId"])
    .index("by_repo", ["repoId"])
    .index("by_ts", ["ts"])
    .index("by_type_and_ts", ["type", "ts"])
    .index("by_actor_and_ts", ["actorId", "ts"])
    .index("by_repo_and_ts", ["repoId", "ts"]),

  /**
   * Embeddings table - Vector embeddings for semantic search
   *
   * Scopes:
   * - event: Single event (PR, commit, etc.)
   * - pr_thread: Full PR with all comments
   * - commit: Commit with message and diff
   * - issue: Issue with description and comments
   */
  embeddings: defineTable({
    // Embedding metadata
    scope: v.string(), // Scope type (event, pr_thread, commit, issue)
    refId: v.string(), // Reference ID (Event._id, etc.)

    // Vector embedding (OpenAI ada-002: 1536 dims, Voyage-3-large: 1024 dims)
    vector: v.array(v.float64()),

    // Provider metadata
    provider: v.string(), // "openai", "voyage", "google"
    model: v.string(), // "text-embedding-3-small", "voyage-3-large", etc.
    dimensions: v.number(), // Vector dimensions

    // Searchable metadata (for filtering)
    // Structure: { repo, user, type, timestamp, url, ... }
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_scope", ["scope"])
    .index("by_refId", ["refId"])
    .vectorIndex("by_vector", {
      vectorField: "vector",
      dimensions: 1024, // Default to Voyage-3-large dimensions
      filterFields: ["scope", "provider", "model"],
    }),

  /**
   * Reports table - Generated reports
   */
  reports: defineTable({
    // Report owner
    userId: v.string(), // Clerk user ID

    // Report specification
    title: v.string(),
    description: v.optional(v.string()),

    // Time range
    startDate: v.number(),
    endDate: v.number(),

    // Users included in report
    ghLogins: v.array(v.string()),

    // Generated content
    markdown: v.string(),
    html: v.string(),
    json: v.optional(v.string()),

    // Citations (GitHub URLs referenced)
    citations: v.array(v.string()),

    // Generation metadata
    promptVersion: v.string(),
    provider: v.string(), // "google", "openai"
    model: v.string(), // "gemini-2.5-flash", "gpt-5-mini"
    generatedAt: v.number(),

    // Automated standup fields
    isAutoGenerated: v.optional(v.boolean()), // true for automated standups, false/undefined for manual
    scheduleType: v.optional(v.union(v.literal("daily"), v.literal("weekly"))), // null for manual reports

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_endDate", ["userId", "endDate"])
    .index("by_userId_and_schedule", ["userId", "scheduleType", "startDate"]),

  /**
   * IngestionJobs table - Track GitHub data ingestion
   */
  ingestionJobs: defineTable({
    // Job owner
    userId: v.string(), // Clerk user ID

    // Job configuration
    repoFullName: v.string(), // "owner/repo"
    since: v.optional(v.number()), // Start timestamp for incremental ingestion
    until: v.optional(v.number()), // End timestamp

    // Job status
    status: v.string(), // "pending", "running", "completed", "failed"
    progress: v.optional(v.number()), // Percentage (0-100)

    // Results
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
    errorMessage: v.optional(v.string()),

    // Timestamps
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_repo", ["repoFullName"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
});
