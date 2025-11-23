import { query } from "./_generated/server";
import type {
  IntegrationJobSummary,
  IntegrationStatus,
} from "@/lib/integrationStatus";

const STALE_EVENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function summarizeJob(job: any): IntegrationJobSummary | null {
  if (!job) return null;
  return {
    status: job.status,
    createdAt: job.createdAt,
    progress: job.progress ?? null,
    blockedUntil: job.blockedUntil ?? null,
  };
}

export const getStatus = query({
  args: {},
  handler: async (ctx): Promise<IntegrationStatus> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { kind: "unauthenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return { kind: "missing_user" };
    }

    const installations = await ctx.db
      .query("installations")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .collect();

    const installCount = installations.length;
    const lastSyncedAtValue = installations.reduce<number>(
      (latest, installation) => {
        const candidate =
          installation.lastSyncedAt ?? installation.updatedAt ?? 0;
        return candidate > latest ? candidate : latest;
      },
      0,
    );
    const lastSyncedAt = lastSyncedAtValue > 0 ? lastSyncedAtValue : null;

    const latestEvent = await ctx.db
      .query("events")
      .withIndex("by_actor_and_ts", (q) => q.eq("actorId", user._id))
      .order("desc")
      .first();

    const lastEventTs = latestEvent?.ts ?? null;

    const latestJob = await ctx.db
      .query("ingestionJobs")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", identity.subject),
      )
      .order("desc")
      .first();

    const jobSummary = summarizeJob(latestJob);

    if (installCount === 0) {
      return {
        kind: "missing_installation",
        installCount: 0,
        lastEventTs,
        lastSyncedAt,
        lastJob: jobSummary,
      };
    }

    if (!lastEventTs) {
      return {
        kind: "no_events",
        installCount,
        lastEventTs: null,
        lastSyncedAt,
        lastJob: jobSummary,
      };
    }

    const now = Date.now();
    if (now - lastEventTs > STALE_EVENT_WINDOW_MS) {
      return {
        kind: "stale_events",
        installCount,
        lastEventTs,
        staleSince: lastEventTs,
        lastSyncedAt,
        lastJob: jobSummary,
      };
    }

    return {
      kind: "healthy",
      installCount,
      lastEventTs,
      lastSyncedAt,
      lastJob: jobSummary,
    };
  },
});
