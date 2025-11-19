/**
 * User queries and mutations
 */

import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

/**
 * Get user by GitHub login
 */
export const getByGhLogin = query({
  args: { ghLogin: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_ghLogin", (q) => q.eq("ghLogin", args.ghLogin))
      .first();
  },
});

/**
 * List all users by GitHub login (for detecting duplicates)
 */
export const listByGhLogin = query({
  args: { ghLogin: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_ghLogin", (q) => q.eq("ghLogin", args.ghLogin))
      .collect();
  },
});

/**
 * Get user by GitHub ID
 */
export const getByGhId = query({
  args: { ghId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_ghId", (q) => q.eq("ghId", args.ghId))
      .first();
  },
});

/**
 * Get user by Clerk ID
 */
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

/**
 * List all users (paginated)
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db.query("users").take(limit);
  },
});

/**
 * Create or update user from GitHub data
 */
export const upsert = mutation({
  args: {
    ghId: v.number(),
    ghLogin: v.string(),
    ghNodeId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    blog: v.optional(v.string()),
    twitterUsername: v.optional(v.string()),
    publicRepos: v.optional(v.number()),
    publicGists: v.optional(v.number()),
    followers: v.optional(v.number()),
    following: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_ghId", (q) => q.eq("ghId", args.ghId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing user
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Sync user from Clerk authentication
 *
 * Links Clerk identity to GitHub user profile.
 * Call this on sign-in to ensure authenticated user exists in database.
 */
export const syncFromClerk = mutation({
  args: {
    ghLogin: v.string(), // GitHub username to link
  },
  handler: async (ctx, args) => {
    // Get Clerk identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated - call syncFromClerk only for authenticated users");
    }

    // Find GitHub user by login
    const ghUser = await ctx.db
      .query("users")
      .withIndex("by_ghLogin", (q) => q.eq("ghLogin", args.ghLogin))
      .first();

    if (!ghUser) {
      throw new Error(`GitHub user not found: ${args.ghLogin}. Ingest repository data first.`);
    }

    // Check if Clerk user already linked to different GitHub user
    const existingClerkUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (existingClerkUser && existingClerkUser._id !== ghUser._id) {
      throw new Error(
        `Clerk account already linked to GitHub user: ${existingClerkUser.ghLogin}`
      );
    }

    // Update GitHub user with Clerk identity
    const now = Date.now();
    await ctx.db.patch(ghUser._id, {
      clerkId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      // Update name/email from Clerk if not set
      name: ghUser.name ?? identity.name,
      email: ghUser.email ?? identity.email,
      updatedAt: now,
    });

    return ghUser._id;
  },
});

/**
 * Update user's GitHub OAuth tokens
 *
 * Called from GitHub OAuth callback to store access/refresh tokens.
 * Supports automated daily/weekly standups by enabling GitHub API access.
 */
export const updateGitHubAuth = mutation({
  args: {
    clerkId: v.string(),
    githubAccessToken: v.string(),
    githubRefreshToken: v.optional(v.string()),
    githubTokenExpiry: v.number(),
    githubUsername: v.string(),
    githubProfile: v.object({
      id: v.number(),
      login: v.string(),
      nodeId: v.string(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
      company: v.optional(v.string()),
      location: v.optional(v.string()),
      blog: v.optional(v.string()),
      twitterUsername: v.optional(v.string()),
      publicRepos: v.optional(v.number()),
      publicGists: v.optional(v.number()),
      followers: v.optional(v.number()),
      following: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Try to locate an existing user record via Clerk linkage first
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    // Fallback: match by GitHub identity (ingestion might have created it earlier)
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_ghId", (q) => q.eq("ghId", args.githubProfile.id))
        .first();
    }

    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_ghLogin", (q) => q.eq("ghLogin", args.githubProfile.login))
        .first();
    }

    const baseProfile = {
      ghId: args.githubProfile.id,
      ghLogin: args.githubProfile.login,
      ghNodeId: args.githubProfile.nodeId,
    };

    const optionalProfile: Record<string, unknown> = {};
    if (args.githubProfile.name !== undefined) optionalProfile.name = args.githubProfile.name;
    if (args.githubProfile.email !== undefined) optionalProfile.email = args.githubProfile.email;
    if (args.githubProfile.avatarUrl !== undefined) optionalProfile.avatarUrl = args.githubProfile.avatarUrl;
    if (args.githubProfile.bio !== undefined) optionalProfile.bio = args.githubProfile.bio;
    if (args.githubProfile.company !== undefined) optionalProfile.company = args.githubProfile.company;
    if (args.githubProfile.location !== undefined) optionalProfile.location = args.githubProfile.location;
    if (args.githubProfile.blog !== undefined) optionalProfile.blog = args.githubProfile.blog;
    if (args.githubProfile.twitterUsername !== undefined)
      optionalProfile.twitterUsername = args.githubProfile.twitterUsername;
    if (args.githubProfile.publicRepos !== undefined)
      optionalProfile.publicRepos = args.githubProfile.publicRepos;
    if (args.githubProfile.publicGists !== undefined)
      optionalProfile.publicGists = args.githubProfile.publicGists;
    if (args.githubProfile.followers !== undefined)
      optionalProfile.followers = args.githubProfile.followers;
    if (args.githubProfile.following !== undefined)
      optionalProfile.following = args.githubProfile.following;

    if (!user) {
      // No existing record — create a fresh user linked to Clerk and GitHub
      console.info(
        "[users.updateGitHubAuth] Creating new user from GitHub OAuth",
        { clerkId: args.clerkId, ghLogin: args.githubProfile.login }
      );
      const userId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        githubAccessToken: args.githubAccessToken,
        githubRefreshToken: args.githubRefreshToken,
        githubTokenExpiry: args.githubTokenExpiry,
        githubUsername: args.githubUsername,
        onboardingCompleted: false,
        createdAt: now,
        updatedAt: now,
        ...baseProfile,
        ...optionalProfile,
      });

      return userId;
    }

    const patch: Record<string, unknown> = {
      githubAccessToken: args.githubAccessToken,
      githubTokenExpiry: args.githubTokenExpiry,
      githubUsername: args.githubUsername,
      updatedAt: now,
      ...baseProfile,
      ...optionalProfile,
    };

    if (!user.clerkId) {
      patch.clerkId = args.clerkId;
      console.info("[users.updateGitHubAuth] Linking existing GitHub user to Clerk account", {
        clerkId: args.clerkId,
        ghLogin: args.githubProfile.login,
      });
    }

    if (args.githubRefreshToken) {
      patch.githubRefreshToken = args.githubRefreshToken;
    }

    await ctx.db.patch(user._id, patch);

    return user._id;
  },
});

/**
 * Calculate UTC hour for a given timezone's 9am
 *
 * Uses Intl.DateTimeFormat to determine the offset from UTC.
 * Creates a date for "9am today in the target timezone" and returns the UTC hour.
 */
function calculateReportHourUTC(timezone: string): number {
  // Create a date for today at 9am in the target timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  // Create Date object for 9am local time (in UTC)
  const localNineAM = new Date(Date.UTC(year, month, day, 9, 0, 0));

  // Format the date in the target timezone to get the local time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });

  // Get what hour it is in the target timezone when UTC is at 9:00
  // We need to reverse-engineer: if we want 9am in target timezone, what's the UTC hour?
  // Approach: Test each UTC hour until we find which one produces 9am in target timezone
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const testDate = new Date(Date.UTC(year, month, day, utcHour, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      day: "numeric",
    }).formatToParts(testDate);

    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const dayPart = parseInt(parts.find((p) => p.type === "day")?.value || "0");

    // Check if this UTC hour produces 9am in the target timezone on the same day
    if (hour === 9 && dayPart === day) {
      return utcHour;
    }
  }

  // Fallback: return a reasonable default (9am UTC)
  return 9;
}

/**
 * Calculate weekly day/hour in UTC for Monday 9am in target timezone
 */
function calculateWeeklyScheduleUTC(timezone: string): { dayUTC: number; hourUTC: number } {
  // Similar approach: find which UTC day/hour corresponds to Monday 9am in target timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Find a Monday in the current month
  let day = 1;
  let testDate = new Date(year, month, day);
  while (testDate.getDay() !== 1) {
    // 1 = Monday
    day++;
    testDate = new Date(year, month, day);
  }

  // Now find which UTC hour on which day produces Monday 9am in target timezone
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const utcDate = new Date(Date.UTC(year, month, day, utcHour, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "long",
    }).formatToParts(utcDate);

    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const weekday = parts.find((p) => p.type === "weekday")?.value;

    if (hour === 9 && weekday === "Monday") {
      // Get the UTC day of week
      const utcDayOfWeek = utcDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      return { dayUTC: utcDayOfWeek, hourUTC: utcHour };
    }
  }

  // Fallback: Monday 9am UTC
  return { dayUTC: 1, hourUTC: 9 };
}

/**
 * Update user settings (timezone, report schedule)
 *
 * Calculates UTC hours from timezone for efficient cron queries.
 * Pre-calculation per ultrathink: avoid runtime timezone math in cron jobs.
 */
export const updateSettings = mutation({
  args: {
    clerkId: v.string(),
    timezone: v.string(),
    dailyReportsEnabled: v.boolean(),
    weeklyReportsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User not found for Clerk ID: ${args.clerkId}`);
    }

    // Calculate UTC hours for 9am in user's timezone
    const reportHourUTC = calculateReportHourUTC(args.timezone);
    const weeklySchedule = calculateWeeklyScheduleUTC(args.timezone);

    // Update settings
    const now = Date.now();
    await ctx.db.patch(user._id, {
      timezone: args.timezone,
      reportHourUTC,
      dailyReportsEnabled: args.dailyReportsEnabled,
      weeklyReportsEnabled: args.weeklyReportsEnabled,
      weeklyDayUTC: weeklySchedule.dayUTC,
      updatedAt: now,
    });

    return {
      success: true,
      reportHourUTC,
      weeklyDayUTC: weeklySchedule.dayUTC,
      weeklyHourUTC: weeklySchedule.hourUTC,
    };
  },
});

/**
 * Mark onboarding as completed
 *
 * Called when user finishes onboarding wizard.
 * Sets timezone/schedule defaults if not already set.
 */
export const completeOnboarding = mutation({
  args: {
    clerkId: v.string(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User not found for Clerk ID: ${args.clerkId}`);
    }

    // Use provided timezone or detect from browser
    const timezone = args.timezone || user.timezone || "America/Los_Angeles";
    const reportHourUTC = calculateReportHourUTC(timezone);
    const weeklySchedule = calculateWeeklyScheduleUTC(timezone);

    // Update with onboarding complete + smart defaults
    const now = Date.now();
    await ctx.db.patch(user._id, {
      onboardingCompleted: true,
      timezone,
      reportHourUTC,
      dailyReportsEnabled: true, // Default: both enabled
      weeklyReportsEnabled: true,
      weeklyDayUTC: weeklySchedule.dayUTC,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Get users by report hour (for daily standups cron)
 *
 * Internal query called by daily report cron jobs.
 * Uses by_reportHourUTC index for efficient lookup.
 */
export const getUsersByReportHour = internalQuery({
  args: {
    reportHourUTC: v.number(),
    dailyEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_reportHourUTC", (q) => q.eq("reportHourUTC", args.reportHourUTC))
      .filter((q) => q.eq(q.field("dailyReportsEnabled"), args.dailyEnabled))
      .collect();
  },
});

/**
 * Get users by weekly schedule (for weekly retros cron)
 *
 * Internal query called by weekly report cron jobs.
 * Uses by_weeklySchedule compound index for efficient lookup.
 */
export const getUsersByWeeklySchedule = internalQuery({
  args: {
    weeklyDayUTC: v.number(),
    reportHourUTC: v.number(),
    weeklyEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_weeklySchedule", (q) =>
        q.eq("weeklyDayUTC", args.weeklyDayUTC).eq("reportHourUTC", args.reportHourUTC)
      )
      .filter((q) => q.eq(q.field("weeklyReportsEnabled"), args.weeklyEnabled))
      .collect();
  },
});
