/**
 * Content-addressable hashing utilities
 *
 * Uses Node.js crypto for deterministic SHA-256 hashing.
 * This module has "use node" directive and should ONLY be imported
 * by other files with "use node" (actions or action-specific libraries).
 */

"use node";

import { createHash } from "crypto";
import type { CanonicalMetrics } from "./canonicalizeEvent";

export interface ContentHashInput {
  canonicalText: string;
  sourceUrl: string;
  metrics?: CanonicalMetrics;
}

export function computeContentHash(input: ContentHashInput): string {
  const normalizedText = input.canonicalText.trim();
  const normalizedUrl = input.sourceUrl.trim();
  const metricsString = input.metrics ? stableStringify(input.metrics) : "";
  const payload = `${normalizedText}::${normalizedUrl}::${metricsString}`;

  return createHash("sha256").update(payload).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const content = entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",");

  return `{${content}}`;
}
