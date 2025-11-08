import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { CanonicalEvent } from "./canonicalizeEvent";
import { computeContentHash } from "./contentHash";

interface GitHubRepositoryPayload {
  id?: number;
  node_id?: string;
  full_name?: string;
  name?: string;
  owner?: { login?: string };
  description?: string | null;
  html_url?: string;
  url?: string;
  homepage?: string | null;
  language?: string | null;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  watchers_count?: number;
  size?: number;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string | null;
}

interface PersistOptions {
  installationId?: number;
  repoPayload?: GitHubRepositoryPayload | null;
}

interface PersistResult {
  status: "inserted" | "duplicate" | "skipped";
  eventId?: Id<"events">;
}

export async function persistCanonicalEvent(
  ctx: ActionCtx,
  canonical: CanonicalEvent,
  options: PersistOptions = {}
): Promise<PersistResult> {
  const actorId = await ensureActor(ctx, canonical.actor);
  if (!actorId) {
    console.warn("[canonical] missing actor metadata, skipping", {
      type: canonical.type,
      actor: canonical.actor,
    });
    return { status: "skipped" };
  }

  const repoId = await ensureRepo(ctx, canonical, options.repoPayload);
  if (!repoId) {
    console.warn("[canonical] missing repo metadata, skipping", {
      type: canonical.type,
      repo: canonical.repo,
    });
    return { status: "skipped" };
  }

  const contentHash = computeContentHash({
    canonicalText: canonical.canonicalText,
    sourceUrl: canonical.sourceUrl,
    metrics: canonical.metrics,
  });

  const existing = await ctx.runQuery(internal.events.getByContentHash, {
    contentHash,
  });
  if (existing) {
    return { status: "duplicate", eventId: existing._id };
  }

  const eventId = await ctx.runMutation(internal.events.upsertCanonical, {
    type: canonical.type,
    ghId: canonical.ghId,
    ghNodeId: canonical.ghNodeId,
    actorId,
    repoId,
    ts: canonical.ts,
    canonicalText: canonical.canonicalText,
    sourceUrl: canonical.sourceUrl,
    metrics: canonical.metrics,
    contentHash,
    metadata: canonical.metadata,
    contentScope: canonical.contentScope,
  });

  await enqueueEmbedding(ctx, eventId, contentHash);

  return { status: "inserted", eventId };
}

async function ensureActor(
  ctx: ActionCtx,
  actor: CanonicalEvent["actor"]
): Promise<Id<"users"> | null> {
  if (typeof actor.ghId !== "number" || !actor.ghLogin) {
    return null;
  }

  return ctx.runMutation(api.users.upsert, {
    ghId: actor.ghId,
    ghLogin: actor.ghLogin,
    ghNodeId: actor.ghNodeId ?? actor.ghLogin,
    name: actor.name ?? undefined,
    avatarUrl: actor.avatarUrl ?? undefined,
  });
}

async function ensureRepo(
  ctx: ActionCtx,
  canonical: CanonicalEvent,
  repoPayload?: GitHubRepositoryPayload | null
): Promise<Id<"repos"> | null> {
  if (!repoPayload) {
    return null;
  }

  const fullName =
    repoPayload.full_name ?? canonical.repo.fullName ?? canonical.repo.name;
  if (
    typeof repoPayload.id !== "number" ||
    !repoPayload.node_id ||
    !fullName ||
    !(repoPayload.owner?.login || canonical.repo.owner) ||
    !repoPayload.name ||
    typeof repoPayload.private !== "boolean" ||
    typeof repoPayload.fork !== "boolean" ||
    typeof repoPayload.archived !== "boolean"
  ) {
    return null;
  }

  const now = Date.now();

  return ctx.runMutation(api.repos.upsert, {
    ghId: repoPayload.id,
    ghNodeId: repoPayload.node_id,
    fullName,
    name: repoPayload.name,
    owner: repoPayload.owner?.login ?? canonical.repo.owner ?? "unknown",
    description: repoPayload.description ?? undefined,
    url: repoPayload.html_url ?? repoPayload.url ?? `https://github.com/${fullName}`,
    homepage: repoPayload.homepage ?? undefined,
    language: repoPayload.language ?? undefined,
    isPrivate: repoPayload.private,
    isFork: repoPayload.fork,
    isArchived: repoPayload.archived,
    stars: repoPayload.stargazers_count ?? repoPayload.watchers_count ?? undefined,
    forks: repoPayload.forks_count ?? undefined,
    openIssues: repoPayload.open_issues_count ?? undefined,
    watchers: repoPayload.watchers_count ?? undefined,
    size: repoPayload.size ?? undefined,
    ghCreatedAt: toMillis(repoPayload.created_at) ?? now,
    ghUpdatedAt: toMillis(repoPayload.updated_at) ?? now,
    ghPushedAt: toMillis(repoPayload.pushed_at ?? undefined) ?? undefined,
  });
}

function toMillis(value?: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function enqueueEmbedding(
  ctx: ActionCtx,
  eventId: Id<"events">,
  contentHash: string
) {
  await ctx.runMutation(internal.embeddingQueue.enqueue, {
    eventId,
    contentHash,
  });

  await ctx.scheduler.runAfter(
    0,
    internal.actions.embeddings.ensureBatch.ensureBatch,
    {}
  );
}
