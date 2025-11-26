/**
 * Custom Test Assertions
 *
 * Shared assertion helpers for common validation patterns.
 * These provide clear error messages and reduce test duplication.
 *
 * Usage:
 *   expectValidContentHash(hash);
 *   expectValidCitation("https://github.com/org/repo/pull/123");
 *   expectValidCoverageScore(0.85, { min: 0.8, max: 1.0 });
 */

import { expect } from "@jest/globals";

// ============================================================================
// Content Hash Assertions
// ============================================================================

/**
 * Asserts that a string is a valid SHA-256 content hash
 *
 * @param hash - The hash string to validate
 * @throws If hash is not a 64-character hexadecimal string
 *
 * @example
 *   expectValidContentHash(contentHash);
 *   // Expects: /^[a-f0-9]{64}$/
 */
export function expectValidContentHash(hash: string | undefined): void {
  expect(hash).toBeDefined();
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
}

/**
 * Asserts that two hashes are identical (for idempotency tests)
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @throws If hashes differ
 *
 * @example
 *   const first = computeHash(data);
 *   const second = computeHash(data);
 *   expectIdenticalHashes(first, second);
 */
export function expectIdenticalHashes(
  hash1: string,
  hash2: string,
): void {
  expectValidContentHash(hash1);
  expectValidContentHash(hash2);
  expect(hash1).toBe(hash2);
}

/**
 * Asserts that two hashes are different (for collision tests)
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @throws If hashes are identical
 *
 * @example
 *   const hashA = computeHash(dataA);
 *   const hashB = computeHash(dataB);
 *   expectDifferentHashes(hashA, hashB);
 */
export function expectDifferentHashes(
  hash1: string,
  hash2: string,
): void {
  expectValidContentHash(hash1);
  expectValidContentHash(hash2);
  expect(hash1).not.toBe(hash2);
}

// ============================================================================
// GitHub URL / Citation Assertions
// ============================================================================

/**
 * Asserts that a URL is a valid GitHub citation
 *
 * Valid formats:
 * - https://github.com/owner/repo/pull/123
 * - https://github.com/owner/repo/issues/456
 * - https://github.com/owner/repo/commit/abc123
 *
 * @param url - The URL to validate
 * @throws If URL is not a valid GitHub citation
 *
 * @example
 *   expectValidCitation("https://github.com/acme/repo/pull/42");
 */
export function expectValidCitation(url: string): void {
  expect(url).toMatch(
    /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/(pull|issues|commit)\/[\w]+$/,
  );
}

/**
 * Asserts that all URLs in an array are valid GitHub citations
 *
 * @param urls - Array of URLs to validate
 * @throws If any URL is invalid
 *
 * @example
 *   expectValidCitations([
 *     "https://github.com/acme/repo/pull/1",
 *     "https://github.com/acme/repo/pull/2",
 *   ]);
 */
export function expectValidCitations(urls: string[]): void {
  expect(urls).toBeInstanceOf(Array);
  urls.forEach((url) => expectValidCitation(url));
}

/**
 * Asserts that citations array is deduplicated (no duplicates)
 *
 * @param citations - Array of citation URLs
 * @throws If duplicates exist
 *
 * @example
 *   expectDeduplicatedCitations(report.citations);
 */
export function expectDeduplicatedCitations(citations: string[]): void {
  const unique = new Set(citations);
  expect(citations.length).toBe(unique.size);
}

/**
 * Asserts that all citations are from allowed URLs
 *
 * @param citations - Actual citations used
 * @param allowedUrls - Allowed URL list
 * @throws If any citation is not in allowedUrls
 *
 * @example
 *   expectCitationsFromAllowedUrls(
 *     report.citations,
 *     ["https://github.com/acme/repo/pull/1"]
 *   );
 */
export function expectCitationsFromAllowedUrls(
  citations: string[],
  allowedUrls: string[],
): void {
  citations.forEach((citation) => {
    expect(allowedUrls).toContain(citation);
  });
}

// ============================================================================
// Coverage Score Assertions
// ============================================================================

/**
 * Asserts that a coverage score is valid and within expected bounds
 *
 * @param score - Coverage score to validate (0-1 range)
 * @param options - Optional bounds { min, max, precision }
 * @throws If score is invalid or out of bounds
 *
 * @example
 *   expectValidCoverageScore(0.85);
 *   expectValidCoverageScore(0.85, { min: 0.8, max: 1.0 });
 *   expectValidCoverageScore(0.8567, { precision: 2 }); // Check to 2 decimals
 */
export function expectValidCoverageScore(
  score: number | undefined,
  options: {
    min?: number;
    max?: number;
    precision?: number;
  } = {},
): void {
  const { min = 0, max = 1, precision = 2 } = options;

  expect(score).toBeDefined();
  expect(typeof score).toBe("number");
  expect(score).toBeGreaterThanOrEqual(min);
  expect(score).toBeLessThanOrEqual(max);

  // Check precision if specified
  if (precision !== undefined && score !== undefined) {
    const rounded = Number(score.toFixed(precision));
    expect(score).toBeCloseTo(rounded, precision);
  }
}

/**
 * Asserts that coverage score meets a minimum threshold
 *
 * @param score - Actual coverage score
 * @param threshold - Minimum required score
 * @throws If score is below threshold
 *
 * @example
 *   expectCoverageAboveThreshold(0.85, 0.8); // Pass
 *   expectCoverageAboveThreshold(0.75, 0.8); // Fail
 */
export function expectCoverageAboveThreshold(
  score: number,
  threshold: number,
): void {
  expectValidCoverageScore(score);
  expect(score).toBeGreaterThanOrEqual(threshold);
}

/**
 * Asserts that coverage breakdown is valid
 *
 * @param breakdown - Coverage breakdown array
 * @throws If breakdown is invalid
 *
 * @example
 *   expectValidCoverageBreakdown(report.coverageBreakdown);
 */
export function expectValidCoverageBreakdown(
  breakdown: Array<{ scopeKey: string; used: number; available: number }> | undefined,
): void {
  expect(breakdown).toBeDefined();
  expect(breakdown).toBeInstanceOf(Array);

  breakdown?.forEach((entry) => {
    expect(entry).toHaveProperty("scopeKey");
    expect(entry).toHaveProperty("used");
    expect(entry).toHaveProperty("available");
    expect(entry.used).toBeGreaterThanOrEqual(0);
    expect(entry.available).toBeGreaterThanOrEqual(0);
    expect(entry.used).toBeLessThanOrEqual(entry.available);
  });
}

// ============================================================================
// Report Assertions
// ============================================================================

/**
 * Asserts that a report has required sections/headings
 *
 * @param markdown - Report markdown content
 * @param requiredHeadings - Array of required heading patterns
 * @throws If any required heading is missing
 *
 * @example
 *   expectReportHasRequiredSections(
 *     report.markdown,
 *     ["## Work Completed", "## Key Decisions"]
 *   );
 */
export function expectReportHasRequiredSections(
  markdown: string,
  requiredHeadings: string[],
): void {
  requiredHeadings.forEach((heading) => {
    expect(markdown).toContain(heading);
  });
}

/**
 * Asserts that a report meets minimum word count
 *
 * @param markdown - Report markdown content
 * @param minWords - Minimum word count
 * @throws If word count is below minimum
 *
 * @example
 *   expectReportMeetsWordCount(report.markdown, 50);
 */
export function expectReportMeetsWordCount(
  markdown: string,
  minWords: number,
): void {
  const wordCount = markdown.trim().split(/\s+/).length;
  expect(wordCount).toBeGreaterThanOrEqual(minWords);
}

/**
 * Asserts that a report has valid LLM generation metadata
 *
 * @param report - Report object with provider/model fields
 * @throws If metadata is invalid
 *
 * @example
 *   expectValidLLMMetadata(report);
 */
export function expectValidLLMMetadata(report: {
  provider: string;
  model: string;
  generatedAt?: number;
}): void {
  expect(report.provider).toBeDefined();
  expect(report.model).toBeDefined();
  expect(["google", "openai", "system"]).toContain(report.provider);

  if (report.provider === "google") {
    expect(report.model).toMatch(/^gemini-/);
  } else if (report.provider === "openai") {
    expect(report.model).toMatch(/^gpt-/);
  } else if (report.provider === "system") {
    expect(report.model).toBe("none");
  }

  if (report.generatedAt !== undefined) {
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.generatedAt).toBeLessThanOrEqual(Date.now());
  }
}

// ============================================================================
// Event Assertions
// ============================================================================

/**
 * Asserts that an event has valid canonicalized fields
 *
 * @param event - Event object with canonical fields
 * @throws If canonical fields are invalid
 *
 * @example
 *   expectValidCanonicalEvent(event);
 */
export function expectValidCanonicalEvent(event: {
  canonicalText?: string;
  sourceUrl?: string;
  contentHash?: string;
  metrics?: { additions?: number; deletions?: number; filesChanged?: number };
}): void {
  if (event.canonicalText !== undefined) {
    expect(event.canonicalText.length).toBeGreaterThan(0);
  }

  if (event.sourceUrl !== undefined) {
    expect(event.sourceUrl).toMatch(/^https:\/\/github\.com\//);
  }

  if (event.contentHash !== undefined) {
    expectValidContentHash(event.contentHash);
  }

  if (event.metrics !== undefined) {
    if (event.metrics.additions !== undefined) {
      expect(event.metrics.additions).toBeGreaterThanOrEqual(0);
    }
    if (event.metrics.deletions !== undefined) {
      expect(event.metrics.deletions).toBeGreaterThanOrEqual(0);
    }
    if (event.metrics.filesChanged !== undefined) {
      expect(event.metrics.filesChanged).toBeGreaterThanOrEqual(0);
    }
  }
}

/**
 * Asserts that event type is valid
 *
 * @param type - Event type string
 * @throws If type is not a valid event type
 *
 * @example
 *   expectValidEventType(event.type);
 */
export function expectValidEventType(type: string): void {
  const validTypes = [
    "pr_opened",
    "pr_closed",
    "pr_review",
    "commit",
    "issue_opened",
    "issue_closed",
    "issue_comment",
    "pr_comment",
  ];
  expect(validTypes).toContain(type);
}

// ============================================================================
// HTTP Response Assertions
// ============================================================================

/**
 * Asserts that an HTTP response has expected status code
 *
 * @param response - Response object with status
 * @param expectedStatus - Expected status code
 * @throws If status doesn't match
 *
 * @example
 *   expectResponseStatus(response, 200);
 */
export function expectResponseStatus(
  response: { status: number },
  expectedStatus: number,
): void {
  expect(response.status).toBe(expectedStatus);
}

/**
 * Asserts that an HTTP response has required headers
 *
 * @param response - Response object with headers
 * @param requiredHeaders - Object of required header key-value pairs
 * @throws If any required header is missing or incorrect
 *
 * @example
 *   expectResponseHeaders(response, {
 *     "Content-Type": "application/json",
 *     "Authorization": "Bearer token",
 *   });
 */
export function expectResponseHeaders(
  response: { headers: Headers | Record<string, string> },
  requiredHeaders: Record<string, string>,
): void {
  Object.entries(requiredHeaders).forEach(([key, value]) => {
    if (response.headers instanceof Headers) {
      expect(response.headers.get(key)).toBe(value);
    } else {
      expect(response.headers[key]).toBe(value);
    }
  });
}

// ============================================================================
// Convex Document Assertions
// ============================================================================

/**
 * Asserts that a Convex document has required ID field
 *
 * @param doc - Document object with _id
 * @throws If _id is missing or invalid
 *
 * @example
 *   expectValidConvexId(user);
 */
export function expectValidConvexId(doc: { _id?: string }): void {
  expect(doc._id).toBeDefined();
  expect(typeof doc._id).toBe("string");
  expect(doc._id!.length).toBeGreaterThan(0);
}

/**
 * Asserts that timestamps are valid and chronological
 *
 * @param doc - Document with createdAt/updatedAt timestamps
 * @throws If timestamps are invalid or out of order
 *
 * @example
 *   expectValidTimestamps(event);
 */
export function expectValidTimestamps(doc: {
  createdAt?: number;
  updatedAt?: number;
}): void {
  if (doc.createdAt !== undefined) {
    expect(doc.createdAt).toBeGreaterThan(0);
    expect(doc.createdAt).toBeLessThanOrEqual(Date.now());
  }

  if (doc.updatedAt !== undefined) {
    expect(doc.updatedAt).toBeGreaterThan(0);
    expect(doc.updatedAt).toBeLessThanOrEqual(Date.now());
  }

  if (doc.createdAt !== undefined && doc.updatedAt !== undefined) {
    expect(doc.updatedAt).toBeGreaterThanOrEqual(doc.createdAt);
  }
}
