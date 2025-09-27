/**
 * Simple in-memory cache for generated summaries
 * Uses sessionStorage to persist cache during the session
 * Automatically expires entries after 5 minutes
 */

import { CommitSummary, DateRange, ActivityMode } from '@/types/dashboard';

interface CacheEntry {
  summary: CommitSummary;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_PREFIX = 'gitpulse_summary_cache_';

/**
 * Generate a cache key from summary parameters
 * Creates a deterministic hash from user, repos, date range, and filters
 */
export function generateCacheKey(
  user: string | undefined,
  activityMode: ActivityMode,
  dateRange: DateRange,
  repositories: readonly string[],
  organizations: readonly string[],
  contributors: readonly string[]
): string {
  const keyParts = [
    user || 'anonymous',
    activityMode,
    dateRange.since,
    dateRange.until,
    [...repositories].sort().join(','),
    [...organizations].sort().join(','),
    [...contributors].sort().join(',')
  ];

  // Create a simple hash from the key parts
  const keyString = keyParts.join('|');
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `${CACHE_PREFIX}${Math.abs(hash)}`;
}

/**
 * Store a summary in the cache
 */
export function cacheSummary(
  key: string,
  summary: CommitSummary
): void {
  try {
    const entry: CacheEntry = {
      summary,
      timestamp: Date.now()
    };

    sessionStorage.setItem(key, JSON.stringify(entry));

    // Clean up old cache entries
    cleanExpiredCache();
  } catch (error) {
    // Silently fail if storage is full or unavailable
    console.warn('Failed to cache summary:', error);
  }
}

/**
 * Retrieve a cached summary if it exists and hasn't expired
 */
export function getCachedSummary(key: string): CommitSummary | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // Check if cache entry has expired
    if (age > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }

    console.log(`Using cached summary (${Math.floor(age / 1000)}s old)`);
    return entry.summary;
  } catch (error) {
    // If parsing fails, remove the corrupted entry
    sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * Clear a specific cache entry
 */
export function clearCacheEntry(key: string): void {
  sessionStorage.removeItem(key);
}

/**
 * Clear all summary cache entries
 */
export function clearAllSummaryCache(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Clean up expired cache entries
 */
function cleanExpiredCache(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          const age = Date.now() - entry.timestamp;

          if (age > CACHE_TTL) {
            keysToRemove.push(key);
          }
        }
      } catch {
        // Remove corrupted entries
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  entries: number;
  totalSize: number;
  oldestAge: number | null;
} {
  let entries = 0;
  let totalSize = 0;
  let oldestAge: number | null = null;

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      entries++;
      const value = sessionStorage.getItem(key);
      if (value) {
        totalSize += value.length;

        try {
          const entry: CacheEntry = JSON.parse(value);
          const age = Date.now() - entry.timestamp;
          if (oldestAge === null || age > oldestAge) {
            oldestAge = age;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }

  return {
    entries,
    totalSize,
    oldestAge: oldestAge ? Math.floor(oldestAge / 1000) : null
  };
}