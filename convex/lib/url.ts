/**
 * Normalize GitHub/HTTP URLs for consistent comparisons.
 *
 * - Trims whitespace
 * - Removes trailing slash (except for root URLs like https://github.com)
 */
export function normalizeUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }

  // Avoid stripping double slashes in protocols, only drop a single trailing slash.
  const withoutTrailingSlash =
    trimmed.length > 1 && trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;

  return withoutTrailingSlash;
}
