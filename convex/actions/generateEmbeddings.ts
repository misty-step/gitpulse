"use node";

/**
 * Embedding Generation Actions
 *
 * Generate and store vector embeddings for GitHub events to enable semantic search.
 * Deep module: Simple interface (event IDs) hiding complex embedding generation.
 */

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { embedText, embedBatch } from "../lib/embeddings";

/**
 * Convert event to searchable text representation
 *
 * Combines event type, metadata, and context into embeddi-friendly text.
 * Different strategies per event type for optimal search relevance.
 */
function eventToText(event: Doc<"events">): string {
  const metadata = event.metadata as any;

  switch (event.type) {
    case "pr_opened":
      return `Pull Request #${metadata.prNumber}: ${metadata.title}\n${metadata.body || ""}`;

    case "pr_closed":
      return `Pull Request #${metadata.prNumber} ${metadata.merged ? "merged" : "closed"}: ${metadata.title}`;

    case "pr_review":
      return `Review on PR #${metadata.prNumber}: ${metadata.state}\n${metadata.body || ""}`;

    case "commit":
      return `Commit ${metadata.sha?.slice(0, 7)}: ${metadata.message}`;

    case "pr_comment":
      return `Comment on PR #${metadata.prNumber}: ${metadata.body || ""}`;

    case "issue_opened":
      return `Issue #${metadata.issueNumber}: ${metadata.title}\n${metadata.body || ""}`;

    case "issue_closed":
      return `Issue #${metadata.issueNumber} closed: ${metadata.title}`;

    case "issue_comment":
      return `Comment on Issue #${metadata.issueNumber}: ${metadata.body || ""}`;

    default:
      // Fallback: stringify metadata
      return `${event.type}: ${JSON.stringify(metadata)}`;
  }
}

/**
 * Generate embedding for a single event
 *
 * @param eventId - Event ID to generate embedding for
 * @returns Embedding record ID
 *
 * @example
 * const embeddingId = await ctx.runAction(api.actions.generateEmbeddings.generate, {
 *   eventId: eventId as Id<"events">
 * });
 */
export const generate = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<Id<"embeddings">> => {
    return runGenerateEmbedding(ctx, args.eventId);
  },
});

export const generateInternal = internalAction({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args): Promise<Id<"embeddings">> => {
    return runGenerateEmbedding(ctx, args.eventId);
  },
});

/**
 * Generate embeddings for multiple events in batch
 *
 * Rate-limited to 100 events per batch to avoid API limits.
 * Processes in parallel for better throughput.
 *
 * @param eventIds - Array of event IDs (max 100)
 * @returns Array of embedding record IDs
 *
 * @example
 * const embeddingIds = await ctx.runAction(api.actions.generateEmbeddings.generateBatch, {
 *   eventIds: eventIds as Id<"events">[]
 * });
 */
export const generateBatch = action({
  args: {
    eventIds: v.array(v.id("events")),
  },
  handler: async (ctx, args): Promise<Id<"embeddings">[]> => {
    // Rate limit: max 100 events per batch
    if (args.eventIds.length > 100) {
      throw new Error(`Batch too large: ${args.eventIds.length} events (max 100)`);
    }

    // Fetch all events
    const events: (Doc<"events"> | null)[] = await Promise.all(
      args.eventIds.map((id: Id<"events">) =>
        ctx.runQuery(internal.events.getById, { id })
      )
    );

    // Filter out missing events
    const validEvents: Doc<"events">[] = events.filter((e): e is Doc<"events"> => e !== null);
    if (validEvents.length === 0) {
      throw new Error("No valid events found");
    }

    // Get API keys
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!voyageApiKey && !openaiApiKey) {
      throw new Error("No embedding API keys configured");
    }

    // Convert events to text
    const texts = validEvents.map(eventToText);

    // Generate embeddings in batch
    const results = await embedBatch(texts, voyageApiKey, openaiApiKey);

    // Store embeddings in parallel
    const embeddingIds: Id<"embeddings">[] = await Promise.all(
      validEvents.map((event: Doc<"events">, i: number) =>
        ctx.runMutation(internal.embeddings.create, {
          scope: "event",
          refId: event._id,
          vector: results[i].vector,
          provider: results[i].provider,
          model: results[i].model,
          dimensions: results[i].dimensions,
          metadata: {
            type: event.type,
            ts: event.ts,
            actorId: event.actorId,
            repoId: event.repoId,
          },
        })
      )
    );

    return embeddingIds;
  },
});

/**
 * Process events without embeddings
 *
 * Finds up to 100 events that don't have embeddings and generates them.
 * Useful for backfilling after ingestion.
 *
 * @param limit - Max events to process (default: 100)
 * @returns Number of embeddings created
 *
 * @example
 * const count = await ctx.runAction(api.actions.generateEmbeddings.processUnembedded, {
 *   limit: 50
 * });
 */
export const processUnembedded = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<number> => {
    const limit = args.limit ?? 100;

    // Find events without embeddings
    const eventsWithoutEmbeddings: Doc<"events">[] = await ctx.runQuery(
      internal.events.listWithoutEmbeddings,
      { limit }
    );

    if (eventsWithoutEmbeddings.length === 0) {
      return 0;
    }

    // Generate embeddings in batch
    const eventIds: Id<"events">[] = eventsWithoutEmbeddings.map((e: Doc<"events">) => e._id);
    await ctx.runAction(api.actions.generateEmbeddings.generateBatch, { eventIds });

    return eventIds.length;
  },
});

async function runGenerateEmbedding(
  ctx: ActionCtx,
  eventId: Id<"events">
): Promise<Id<"embeddings">> {
  const event: Doc<"events"> | null = await ctx.runQuery(internal.events.getById, {
    id: eventId,
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const voyageApiKey = process.env.VOYAGE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!voyageApiKey && !openaiApiKey) {
    throw new Error("No embedding API keys configured (VOYAGE_API_KEY or OPENAI_API_KEY)");
  }

  const text = eventToText(event);
  const result = await embedText(text, voyageApiKey, openaiApiKey);

  return ctx.runMutation(internal.embeddings.create, {
    scope: "event",
    refId: eventId,
    vector: result.vector,
    provider: result.provider,
    model: result.model,
    dimensions: result.dimensions,
    metadata: {
      type: event.type,
      ts: event.ts,
      actorId: event.actorId,
      repoId: event.repoId,
    },
  });
}
