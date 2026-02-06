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
    midnightUtcHour: v.optional(v.number()), // Computed: when local midnight occurs in UTC (0-23)
    dailyReportsEnabled: v.optional(v.boolean()), // Default: true
    weeklyReportsEnabled: v.optional(v.boolean()), // Default: true

    // DEPRECATED: These fields are no longer used. Reports now generate at local midnight.
    // Kept for backwards compatibility during migration.
    reportHourUTC: v.optional(v.number()), // DEPRECATED: Was user's 9am in UTC
    weeklyDayUTC: v.optional(v.number()), // DEPRECATED: Weekly reports now use Sunday midnight

    // Onboarding
    onboardingCompleted: v.optional(v.boolean()), // Whether user completed onboarding wizard
    firstReportStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),

    // Metadata
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_ghId", ["ghId"])
    .index("by_ghLogin", ["ghLogin"])
    .index("by_ghNodeId", ["ghNodeId"])
    .index("by_midnightUtcHour", ["midnightUtcHour"])
    // DEPRECATED indexes - kept for migration compatibility
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

    // Canonicalized presentation for reporting/cache
    canonicalText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    metrics: v.optional(
      v.object({
        additions: v.optional(v.number()),
        deletions: v.optional(v.number()),
        filesChanged: v.optional(v.number()),
      }),
    ),
    contentHash: v.optional(v.string()),
    contentScope: v.optional(
      v.union(v.literal("event"), v.literal("timeslice")),
    ),

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_actor", ["actorId"])
    .index("by_repo", ["repoId"])
    .index("by_ts", ["ts"])
    .index("by_type_and_ts", ["type", "ts"])
    .index("by_actor_and_ts", ["actorId", "ts"])
    .index("by_repo_and_ts", ["repoId", "ts"])
    .index("by_contentHash", ["contentHash"]),

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
    contentHash: v.optional(v.string()),

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
    .index("by_contentHash", ["contentHash"])
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

    // Repositories included (stored at generation time for display)
    repos: v.optional(v.array(v.string())), // ["owner/repo", ...]

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

    cacheKey: v.optional(v.string()),
    coverageScore: v.optional(v.number()),
    coverageBreakdown: v.optional(
      v.array(
        v.object({
          scopeKey: v.string(),
          used: v.number(),
          total: v.number(),
        }),
      ),
    ),
    sections: v.optional(
      v.array(
        v.object({
          title: v.string(),
          bullets: v.array(v.string()),
          citations: v.array(v.string()),
        }),
      ),
    ),

    // Automated standup fields
    isAutoGenerated: v.optional(v.boolean()), // true for automated standups, false/undefined for manual
    scheduleType: v.optional(v.union(v.literal("daily"), v.literal("weekly"))), // null for manual reports

    // Staleness tracking (for intelligent post-sync report generation)
    isStale: v.optional(v.boolean()), // true if new events added since report was generated
    staleDetectedAt: v.optional(v.number()), // timestamp when staleness was detected

    // Diagnostic fields (for observability)
    eventCount: v.optional(v.number()), // Events available for window
    citationCount: v.optional(v.number()), // Citations extracted from markdown
    expectedCitations: v.optional(v.number()), // Events with sourceUrl (citable)

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_endDate", ["userId", "endDate"])
    .index("by_userId_and_schedule", ["userId", "scheduleType", "startDate"])
    .index("by_cacheKey", ["cacheKey"])
    .index("by_userId_and_isStale", ["userId", "isStale"]),

  /**
   * ReportRegenerations table - User-triggered regeneration jobs with progress tracking
   */
  reportRegenerations: defineTable({
    reportId: v.id("reports"),
    userId: v.string(),
    ghLogins: v.array(v.string()),
    kind: v.union(v.literal("daily"), v.literal("weekly")),
    startDate: v.number(),
    endDate: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("collecting"),
      v.literal("generating"),
      v.literal("validating"),
      v.literal("saving"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    progress: v.number(),
    message: v.optional(v.string()),
    error: v.optional(
      v.object({
        message: v.string(),
        stage: v.optional(v.string()),
        stack: v.optional(v.string()),
      }),
    ),
    newReportId: v.optional(v.id("reports")),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_reportId_and_createdAt", ["reportId", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_reportId_and_status", ["reportId", "status"]),

  /**
   * IngestionJobs table - Track GitHub data ingestion
   */
  ingestionJobs: defineTable({
    // Job owner
    userId: v.string(), // Clerk user ID

    // GitHub App linkage
    installationId: v.optional(v.number()),

    // Batch reference (job-per-repo architecture)
    batchId: v.optional(v.id("syncBatches")),

    // Job configuration
    repoFullName: v.string(), // "owner/repo"
    since: v.optional(v.number()), // Start timestamp for incremental ingestion
    until: v.optional(v.number()), // End timestamp
    cursor: v.optional(v.string()), // pagination cursor (page token)
    reposRemaining: v.optional(v.array(v.string())), // queued repos still to sync

    // Trigger metadata for recovery detection
    trigger: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("cron"),
        v.literal("webhook"),
        v.literal("maintenance"),
        v.literal("recovery"),
      ),
    ),

    // Job status
    status: v.string(), // "pending", "running", "completed", "failed"
    progress: v.optional(v.number()), // Percentage (0-100)
    blockedUntil: v.optional(v.number()), // timestamp when job may resume

    // Results
    eventsIngested: v.optional(v.number()),
    embeddingsCreated: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),

    // Timestamps
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    lastUpdatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_repo", ["repoFullName"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_installationId", ["installationId"])
    .index("by_batchId", ["batchId"])
    .index("by_blockedUntil", ["blockedUntil"]),

  /**
   * SyncBatches table - Groups sync jobs for an installation
   *
   * Job-per-repo architecture: Each sync request creates one batch
   * containing N jobs (one per repo). Eliminates chaining bugs.
   */
  syncBatches: defineTable({
    installationId: v.number(),
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("maintenance"),
      v.literal("recovery"),
    ),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    totalRepos: v.number(),
    completedRepos: v.number(),
    failedRepos: v.optional(v.number()),
    eventsIngested: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_installationId", ["installationId"])
    .index("by_status", ["status"])
    .index("by_installationId_and_status", ["installationId", "status"]),

  /**
   * Installations table - GitHub App installations metadata
   */
  installations: defineTable({
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
    targetType: v.optional(v.string()),
    repositorySelection: v.optional(v.string()),
    repositories: v.optional(v.array(v.string())),
    clerkUserId: v.optional(v.string()),
    lastCursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
    status: v.optional(v.string()), // active, suspended, removed
    // Sync orchestration fields (Phase 2)
    syncStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("syncing"),
        v.literal("rate_limited"),
        v.literal("error"),
      ),
    ),
    lastManualSyncAt: v.optional(v.number()),
    nextSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    lastSyncDuration: v.optional(v.number()),
    recoveryAttempts: v.optional(v.number()),
    lastRecoveryAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_installationId", ["installationId"])
    // DEPRECATED: This field is deprecated in Phase 4. Use `userInstallations` table for user-installation mapping.
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_syncStatus", ["syncStatus"])
    .index("by_lastSyncedAt", ["lastSyncedAt"]),

  /**
   * userInstallations table - Stores N:M mapping between Clerk users and GitHub App installations.
   */
  userInstallations: defineTable({
    userId: v.string(), // Clerk user ID (matches users.clerkId)
    installationId: v.number(), // GitHub App installation ID
    role: v.union(v.literal("owner"), v.literal("viewer")), // Role of the user in this installation
    claimedAt: v.number(), // Unix timestamp when the claim was made
    createdAt: v.number(), // For consistency
    updatedAt: v.number(), // For consistency
  })
    .index("by_userId", ["userId"])
    .index("by_installationId", ["installationId"])
    .index("by_user_and_installation", ["userId", "installationId"]),

  /**
   * trackedRepos table - Allows users to specify which repositories within an installation they want to track.
   */
  trackedRepos: defineTable({
    userId: v.string(), // Clerk user ID
    installationId: v.number(), // GitHub App installation ID
    repoFullName: v.string(), // "owner/repo"
    tracked: v.boolean(), // true if tracked, false if explicitly untracked
    createdAt: v.number(), // For consistency
    updatedAt: v.number(), // For consistency
  })
    .index("by_userId", ["userId"])
    .index("by_installationId", ["installationId"])
    .index("by_user_installation_repo", [
      "userId",
      "installationId",
      "repoFullName",
    ]),

  /**
   * userRepoAccessCache table - Caches the list of repositories a user has access to for a given installation.
   */
  userRepoAccessCache: defineTable({
    userId: v.string(), // Clerk user ID
    installationId: v.number(), // GitHub App installation ID
    repos: v.array(v.string()), // Array of "owner/repo" strings
    version: v.number(), // Version of the cache, used for invalidation
    lastRefreshedAt: v.number(), // Unix timestamp when the cache was last refreshed
    createdAt: v.number(), // For consistency
    updatedAt: v.number(), // For consistency
  })
    .index("by_userId", ["userId"])
    .index("by_installationId", ["installationId"])
    .index("by_user_and_installation", ["userId", "installationId"]),

  /**
   * WebhookEvents table - stores raw GitHub webhook envelopes for processing/rehydration
   */
  webhookEvents: defineTable({
    deliveryId: v.string(),
    event: v.string(),
    installationId: v.optional(v.number()),
    payload: v.any(),
    status: v.string(), // pending, processing, completed, failed
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  })
    .index("by_deliveryId", ["deliveryId"])
    .index("by_status", ["status"])
    .index("by_receivedAt", ["receivedAt"]),

  /**
   * CoverageCandidates table - relation between facts and report scopes/windows
   */
  coverageCandidates: defineTable({
    factId: v.id("events"),
    scopeKey: v.string(),
    reportKind: v.string(),
    windowStart: v.number(),
    windowEnd: v.number(),
    createdAt: v.number(),
  })
    .index("by_fact", ["factId"])
    .index("by_scope_and_window", ["scopeKey", "windowStart", "windowEnd"]),

  /**
   * EmbeddingQueue table - pending embedding jobs keyed by content hash
   */
  embeddingQueue: defineTable({
    eventId: v.id("events"),
    contentHash: v.string(),
    status: v.string(), // pending, processing, failed
    attempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_contentHash", ["contentHash"]),

  /**
   * ReportJobHistory table - audit log for scheduler runs
   */
  reportJobHistory: defineTable({
    type: v.union(v.literal("daily"), v.literal("weekly")),
    hourUTC: v.number(),
    dayUTC: v.optional(v.number()),
    usersAttempted: v.number(),
    reportsGenerated: v.number(),
    errors: v.number(),
    durationMs: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),
    createdAt: v.number(),
  }).index("by_type_and_createdAt", ["type", "createdAt"]),

  /**
   * Customers table - links Clerk users to Stripe customer records
   */
  customers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),

  /**
   * Subscriptions table - Stripe subscription state for a user
   */
  subscriptions: defineTable({
    userId: v.string(),
    customerId: v.id("customers"),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    stripeProductId: v.optional(v.string()),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("paused"),
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    paymentMethodBrand: v.optional(v.string()),
    paymentMethodLast4: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"])
    .index("by_status", ["status"])
    .index("by_userId_and_status", ["userId", "status"]),

  /**
   * StripeEvents table - idempotency tracking for Stripe webhooks
   */
  stripeEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    processedAt: v.number(),
    createdAt: v.number(),
  }).index("by_eventId", ["eventId"]),
});
