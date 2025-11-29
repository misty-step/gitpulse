/**
 * Tests for Vector Search Actions
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { createMockActionCtx } from "../../../tests/__mocks__/convexCtx";

// Mock the Convex API
jest.mock("../../_generated/api", () => ({}));

// Import handler after mocks
 
const { search } = require("../vectorSearch");

type SearchResult = { _id: string; _score: number };

// Helper to create properly typed mock - vectorSearch(tableName, indexName, opts)
const createVectorSearchMock = (results: SearchResult[]) =>
  jest.fn<(...args: unknown[]) => Promise<SearchResult[]>>().mockResolvedValue(results);

describe("vectorSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockVector = Array(1024).fill(0.1);
  const mockSearchResults: SearchResult[] = [
    { _id: "emb_1", _score: 0.95 },
    { _id: "emb_2", _score: 0.87 },
    { _id: "emb_3", _score: 0.75 },
  ];

  describe("basic search", () => {
    it("performs vector search with default limit", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      const result = await search.handler(ctx, { vector: mockVector });

      expect(result).toEqual(mockSearchResults);
      expect(vectorSearch).toHaveBeenCalledWith("embeddings", "by_vector", {
        vector: mockVector,
        limit: 10,
        filter: undefined,
      });
    });

    it("uses custom limit", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      await search.handler(ctx, { vector: mockVector, limit: 5 });

      expect(vectorSearch).toHaveBeenCalledWith(
        "embeddings",
        "by_vector",
        expect.objectContaining({ limit: 5 }),
      );
    });

    it("caps limit at 256", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      await search.handler(ctx, { vector: mockVector, limit: 1000 });

      expect(vectorSearch).toHaveBeenCalledWith(
        "embeddings",
        "by_vector",
        expect.objectContaining({ limit: 256 }),
      );
    });
  });

  describe("scope filtering", () => {
    it("applies scope filter when provided", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      await search.handler(ctx, { vector: mockVector, scope: "event" });

      expect(vectorSearch).toHaveBeenCalledWith(
        "embeddings",
        "by_vector",
        expect.objectContaining({
          filter: expect.any(Function),
        }),
      );
    });

    it("does not apply filter when scope not provided", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      await search.handler(ctx, { vector: mockVector });

      expect(vectorSearch).toHaveBeenCalledWith(
        "embeddings",
        "by_vector",
        expect.objectContaining({ filter: undefined }),
      );
    });
  });

  describe("return values", () => {
    it("returns search results with scores", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });

      const result = await search.handler(ctx, { vector: mockVector });

      expect(result).toHaveLength(3);
      expect(result[0]._score).toBe(0.95);
    });

    it("returns empty array when no matches", async () => {
      const vectorSearch = createVectorSearchMock([]);
      const ctx = createMockActionCtx({ vectorSearch });

      const result = await search.handler(ctx, { vector: mockVector });

      expect(result).toHaveLength(0);
    });
  });

  describe("vector dimensions", () => {
    it("accepts 1024-dim vectors (Voyage)", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });
      const voyageVector = Array(1024).fill(0.1);

      const result = await search.handler(ctx, { vector: voyageVector });

      expect(result).toBeDefined();
    });

    it("accepts 1536-dim vectors (OpenAI)", async () => {
      const vectorSearch = createVectorSearchMock(mockSearchResults);
      const ctx = createMockActionCtx({ vectorSearch });
      const openaiVector = Array(1536).fill(0.1);

      const result = await search.handler(ctx, { vector: openaiVector });

      expect(result).toBeDefined();
    });
  });
});
