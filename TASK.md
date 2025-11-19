# TASK: Multi-Account Architecture Redesign

## Problem Statement

GitPulse needs to support users tracking their GitHub activity across multiple accounts and organizations. Current architecture conflates user identity with installation ownership, preventing proper multi-account support.

## Current Architecture Analysis

### Data Relationships (Current)

```
User → has ONE ghId/ghLogin (conflates Clerk identity with GitHub identity)
Installation → has optional clerkUserId (1:1 assumed)
Events → tied to actorId (user) and repoId
Reports → query by ghLogins array
```

### Fundamental Issues

1. **Identity Conflation** - Clerk user ID treated as equivalent to GitHub user ID
2. **Implicit 1:1 Relationship** - `clerkUserId` on installation assumes single owner
3. **Bandaid Solutions** - Adding multiple `clerkUserId` references doesn't model actual relationships
4. **Unanswered Questions** - "What repos should I track?" vs "What installations give me access?"

## GitHub's Actual Model

An installation is NOT "your account" - it's a **permission scope** that grants access to a set of repositories.

```
Installation (permission grant)
  └── grants access to: Repositories (all or selected)
        └── contain: Events (all actors' activity)
              └── performed by: Actors (any GitHub user)
```

Key insight: When phrazzld commits to misty-step/gitpulse, the event's actor is phrazzld regardless of which installation provides access to that repo.

## Proposed Architecture

### Correct Data Model

```
User (Clerk identity)
  └── claims: Installations (N:M via join table)
        └── grants access to: Repositories
              └── contain: Events
                    └── have: Actor (ghLogin)
```

### Report Query Pattern

```typescript
// FROM: repos accessible via user's claimed installations
// WHERE: actor.ghLogin IN [user's selected ghLogins]
// BETWEEN: date range
```

This properly separates:
1. **Access control** - which installations you've claimed
2. **Repo selection** - which repos you care about (optional refinement)
3. **Actor filtering** - whose activity to include in reports

## Schema Changes

### 1. New `userInstallations` Table (Many-to-Many Join)

```typescript
userInstallations: defineTable({
  userId: v.string(),           // Clerk user ID
  installationId: v.number(),   // GitHub App installation ID
  claimedAt: v.number(),        // Timestamp when user claimed this
})
  .index("by_userId", ["userId"])
  .index("by_installationId", ["installationId"])
  .index("by_userId_and_installationId", ["userId", "installationId"])
```

### 2. Optional `trackedRepos` Table (Per-User Repo Selection)

```typescript
trackedRepos: defineTable({
  userId: v.string(),           // Clerk user ID
  repoId: v.id("repos"),        // Repository to track
  enabled: v.boolean(),         // Whether to include in reports
  addedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_and_enabled", ["userId", "enabled"])
```

### 3. Remove `clerkUserId` from Installations

Installations don't "belong to" users; users "claim" installations. The `clerkUserId` field creates false 1:1 semantics.

### 4. Update Query Functions

- `getUserInstallations(userId)` - Get all installations claimed by user
- `getAccessibleRepos(userId)` - Aggregate repos from all user's installations
- `getReportEvents(userId, dateRange, ghLogins)` - Events from accessible repos by selected actors

## Benefits of This Architecture

### Proper Domain Modeling
- Reflects how GitHub actually works (installations as permission scopes)
- Clean separation of concerns

### Team Support
- Multiple users can claim the same org installation
- Each user sees their own activity in that org
- Future: team reports showing multiple actors

### Flexibility
- User can track subset of repos from an installation
- Reports can include or exclude specific repos
- Actor filtering independent of repo access

### Clear Mental Model
- "I've linked these GitHub App installations to my account"
- "These repos are accessible via my linked installations"
- "My reports show my activity in these repos"

## Migration Path

### Phase 1: Schema Addition
1. Create `userInstallations` table
2. Migrate existing `clerkUserId` data to join table entries
3. Keep `clerkUserId` on installations temporarily for backwards compat

### Phase 2: Query Updates
4. Update `listByClerkUser` to use join table
5. Update report generation to aggregate via join table
6. Update ingestion queries

### Phase 3: UI Updates
7. Settings page to manage claimed installations
8. Show available (unclaimed) installations for linking
9. Optional: per-repo enable/disable

### Phase 4: Cleanup
10. Remove `clerkUserId` from installations table
11. Remove deprecated queries

## Use Cases Enabled

### Primary: Combined Personal + Org Activity
- User phrazzld claims both phrazzld installation and misty-step installation
- Reports aggregate activity across all repos from both
- Single unified view of "my work"

### Future: Team Reports
- Multiple users claim misty-step installation
- Each sees their own activity
- Admin view could show team-wide activity

### Future: Selective Tracking
- User enables/disables specific repos
- Focus reports on active projects
- Reduce noise from archived repos

## Implementation Priority

1. **Immediate** - Add `userInstallations` table, migrate existing data
2. **Short-term** - Update report queries to use join table
3. **Medium-term** - UI for claiming/managing installations
4. **Future** - Per-repo selection, team features

---

*This redesign transforms a bandaid solution into a proper architectural foundation for multi-account support.*
