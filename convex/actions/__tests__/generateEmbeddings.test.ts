/**
 * Tests for Embedding Generation Actions
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";
import { createAsyncMock } from "../../../tests/utils/jestMocks";
import * as embeddingsModule from "../../lib/embeddings";
import * as contentHashModule from "../../lib/contentHash";

// Mock the Convex API with string values
jest.mock("../../_generated/api", () => ({
  api: {
    actions: {
      generateEmbeddings: {
        generateBatch: "api.actions.generateEmbeddings.generateBatch",
      },
    },
  },
  internal: {
    events: {
      getById: "internal.events.getById",
      listWithoutEmbeddings: "internal.events.listWithoutEmbeddings",
    },
    embeddings: {
      create: "internal.embeddings.create",
    },
  },
}));

// Mock embedding functions
jest.mock("../../lib/embeddings", () => ({
  embedText: jest.fn(),
  embedBatch: jest.fn(),
}));

// Mock content hash
jest.mock("../../lib/contentHash", () => ({
  computeContentHash: jest.fn(),
}));

// Mock process.env
const mockEnv = {
  VOYAGE_API_KEY: "voyage-test-key",
  OPENAI_API_KEY: "openai-test-key",
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

Object.defineProperty(process, "env", {
  value: mockEnv,
  writable: true,
});

const embedText = embeddingsModule.embedText as jest.MockedFunction<
  typeof embeddingsModule.embedText
>;
const embedBatch = embeddingsModule.embedBatch as jest.MockedFunction<
  typeof embeddingsModule.embedBatch
>;
const computeContentHash =
  contentHashModule.computeContentHash as jest.MockedFunction<
    typeof contentHashModule.computeContentHash
  >;

// Import handlers after mocks are set up
 
const { generate, generateBatch, processUnembedded } = require("../generateEmbeddings");

describe("generateEmbeddings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env
    process.env = { ...mockEnv };
  });

  const mockEvent = {
    _id: "event_123",
    type: "pr_opened",
    canonicalText: "PR #42 opened",
    sourceUrl: "https://github.com/org/repo/pull/42",
    ts: Date.now(),
    actorId: "user_123",
    repoId: "repo_123",
    metadata: {
      prNumber: 42,
      title: "Test PR",
      body: "This is a test pull request",
    },
  };

  const mockEmbeddingResult = {
    vector: Array(1024).fill(0.1),
    provider: "voyage" as const,
    model: "voyage-code-3",
    dimensions: 1024,
  };

  describe("generate (single event)", () => {
    it("generates embedding for a valid event", async () => {
      const runQuery = createAsyncMock().mockResolvedValue(mockEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      const result = await generate.handler(ctx, { eventId: "event_123" });

      expect(result).toBe("embedding_123");
      expect(embedText).toHaveBeenCalledWith(
        expect.stringContaining("Pull Request #42"),
        "voyage-test-key",
        "openai-test-key",
      );
    });

    it("throws error when event not found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue(null);
      const ctx = createMockActionCtx({ runQuery });

      await expect(
        generate.handler(ctx, { eventId: "nonexistent" }),
      ).rejects.toThrow("Event not found");
    });

    it("throws error when no API keys configured", async () => {
      process.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv; // Remove API keys

      const runQuery = createAsyncMock().mockResolvedValue(mockEvent);
      const ctx = createMockActionCtx({ runQuery });

      await expect(
        generate.handler(ctx, { eventId: "event_123" }),
      ).rejects.toThrow("No embedding API keys configured");
    });

    it("stores embedding with correct metadata", async () => {
      const runQuery = createAsyncMock().mockResolvedValue(mockEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(runMutation).toHaveBeenCalledWith(
        "internal.embeddings.create",
        expect.objectContaining({
          scope: "event",
          refId: "event_123",
          provider: "voyage",
          model: "voyage-code-3",
          dimensions: 1024,
          contentHash: "hash123",
          metadata: expect.objectContaining({
            type: "pr_opened",
            actorId: "user_123",
            repoId: "repo_123",
          }),
        }),
      );
    });
  });

  describe("generateBatch", () => {
    it("generates embeddings for multiple events", async () => {
      const mockEvent2 = { ...mockEvent, _id: "event_456", metadata: { ...mockEvent.metadata, prNumber: 43 } };

      const runQuery = createAsyncMock()
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockEvent2);
      const runMutation = createAsyncMock()
        .mockResolvedValueOnce("embedding_1")
        .mockResolvedValueOnce("embedding_2");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedBatch.mockResolvedValue([mockEmbeddingResult, mockEmbeddingResult]);

      const result = await generateBatch.handler(ctx, {
        eventIds: ["event_123", "event_456"],
      });

      expect(result).toEqual(["embedding_1", "embedding_2"]);
      expect(embedBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String), expect.any(String)]),
        "voyage-test-key",
        "openai-test-key",
      );
    });

    it("throws error when batch too large", async () => {
      const ctx = createMockActionCtx({});
      const largeEventIds = Array(101).fill("event_id");

      await expect(
        generateBatch.handler(ctx, { eventIds: largeEventIds }),
      ).rejects.toThrow("Batch too large: 101 events (max 100)");
    });

    it("throws error when no valid events found", async () => {
      const runQuery = createAsyncMock().mockResolvedValue(null);
      const ctx = createMockActionCtx({ runQuery });

      await expect(
        generateBatch.handler(ctx, { eventIds: ["nonexistent"] }),
      ).rejects.toThrow("No valid events found");
    });

    it("throws error when no API keys configured", async () => {
      process.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv; // Remove API keys

      const runQuery = createAsyncMock().mockResolvedValue(mockEvent);
      const ctx = createMockActionCtx({ runQuery });

      await expect(
        generateBatch.handler(ctx, { eventIds: ["event_123"] }),
      ).rejects.toThrow("No embedding API keys configured");
    });

    it("filters out missing events", async () => {
      const runQuery = createAsyncMock()
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(null); // Second event not found
      const runMutation = createAsyncMock().mockResolvedValue("embedding_1");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedBatch.mockResolvedValue([mockEmbeddingResult]);

      const result = await generateBatch.handler(ctx, {
        eventIds: ["event_123", "nonexistent"],
      });

      expect(result).toHaveLength(1);
      expect(embedBatch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe("processUnembedded", () => {
    it("processes events without embeddings", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockEvent]);
      const runAction = createAsyncMock().mockResolvedValue(["embedding_1"]);
      const ctx = createMockActionCtx({ runQuery, runAction });

      const result = await processUnembedded.handler(ctx, {});

      expect(result).toBe(1);
      expect(runAction).toHaveBeenCalledWith(
        "api.actions.generateEmbeddings.generateBatch",
        { eventIds: ["event_123"] },
      );
    });

    it("returns 0 when no events need embedding", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([]);
      const ctx = createMockActionCtx({ runQuery });

      const result = await processUnembedded.handler(ctx, {});

      expect(result).toBe(0);
    });

    it("respects the limit parameter", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockEvent]);
      const runAction = createAsyncMock().mockResolvedValue(["embedding_1"]);
      const ctx = createMockActionCtx({ runQuery, runAction });

      await processUnembedded.handler(ctx, { limit: 50 });

      expect(runQuery).toHaveBeenCalledWith(
        "internal.events.listWithoutEmbeddings",
        { limit: 50 },
      );
    });

    it("uses default limit of 100", async () => {
      const runQuery = createAsyncMock().mockResolvedValue([mockEvent]);
      const runAction = createAsyncMock().mockResolvedValue(["embedding_1"]);
      const ctx = createMockActionCtx({ runQuery, runAction });

      await processUnembedded.handler(ctx, {});

      expect(runQuery).toHaveBeenCalledWith(
        "internal.events.listWithoutEmbeddings",
        { limit: 100 },
      );
    });
  });

  describe("eventToText conversion", () => {
    it("formats pr_opened events", async () => {
      const runQuery = createAsyncMock().mockResolvedValue(mockEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Pull Request #42: Test PR\nThis is a test pull request",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats pr_closed events (merged)", async () => {
      const closedEvent = {
        ...mockEvent,
        type: "pr_closed",
        metadata: {
          prNumber: 42,
          title: "Test PR",
          merged: true,
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(closedEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Pull Request #42 merged: Test PR",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats pr_closed events (not merged)", async () => {
      const closedEvent = {
        ...mockEvent,
        type: "pr_closed",
        metadata: {
          prNumber: 42,
          title: "Test PR",
          merged: false,
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(closedEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Pull Request #42 closed: Test PR",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats commit events", async () => {
      const commitEvent = {
        ...mockEvent,
        type: "commit",
        metadata: {
          sha: "abc123def456",
          message: "feat: add new feature",
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(commitEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Commit abc123d: feat: add new feature",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats pr_review events", async () => {
      const reviewEvent = {
        ...mockEvent,
        type: "pr_review",
        metadata: {
          prNumber: 42,
          state: "APPROVED",
          body: "LGTM!",
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(reviewEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Review on PR #42: APPROVED\nLGTM!",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats issue_opened events", async () => {
      const issueEvent = {
        ...mockEvent,
        type: "issue_opened",
        metadata: {
          issueNumber: 100,
          title: "Bug report",
          body: "Found a bug",
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(issueEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        "Issue #100: Bug report\nFound a bug",
        expect.any(String),
        expect.any(String),
      );
    });

    it("formats unknown event types with fallback", async () => {
      const unknownEvent = {
        ...mockEvent,
        type: "unknown_type",
        metadata: {
          customField: "value",
        },
      };

      const runQuery = createAsyncMock().mockResolvedValue(unknownEvent);
      const runMutation = createAsyncMock().mockResolvedValue("embedding_123");
      const ctx = createMockActionCtx({ runQuery, runMutation });

      embedText.mockResolvedValue(mockEmbeddingResult);
      computeContentHash.mockReturnValue("hash123");

      await generate.handler(ctx, { eventId: "event_123" });

      expect(embedText).toHaveBeenCalledWith(
        expect.stringContaining("unknown_type"),
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
