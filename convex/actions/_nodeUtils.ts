/**
 * Node.js Utilities for Actions
 *
 * This file contains utility functions that require Node.js APIs.
 * It MUST have "use node" directive and should only be imported by other actions.
 */

"use node";

import { createHash } from "crypto";
import jwt from "jsonwebtoken";

/**
 * Compute SHA-256 content hash for deduplication
 */
export function computeContentHashNode(
  canonicalText: string,
  sourceUrl: string,
  metrics?: Record<string, unknown>
): string {
  const normalizedText = canonicalText.trim();
  const normalizedUrl = sourceUrl.trim();
  const metricsString = metrics ? stableStringify(metrics) : "";
  const payload = `${normalizedText}::${normalizedUrl}::${metricsString}`;

  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Stable JSON stringify for deterministic hashing
 */
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

/**
 * Sign JWT for GitHub App authentication
 */
export function signJwt(payload: object, privateKey: string, options: jwt.SignOptions): string {
  return jwt.sign(payload, privateKey, options);
}
