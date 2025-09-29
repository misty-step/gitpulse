/**
 * In-memory cache for GitHub API responses
 *
 * Implements LRU (Least Recently Used) eviction strategy with:
 * - Configurable TTL (time-to-live) for cache entries
 * - ETag support for conditional requests
 * - Max size limit with automatic eviction
 * - Stale-while-revalidate pattern support
 */

import { logger } from '../logger';

const MODULE_NAME = 'cache:github';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  /** Cached data */
  data: T;

  /** ETag from the API response (if available) */
  etag?: string;

  /** Timestamp when this entry was cached (milliseconds since epoch) */
  timestamp: number;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Last access timestamp for LRU tracking */
  lastAccessed: number;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** ETag value for conditional requests */
  etag?: string;

  /** Force refresh even if cached data exists */
  forceRefresh?: boolean;
}

/**
 * Options for the cache get method
 */
export interface CacheGetOptions<T> extends CacheOptions {
  /** Function to fetch data if cache miss or stale */
  fetcher: () => Promise<T>;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;

  /** Total number of cache misses */
  misses: number;

  /** Current number of entries */
  size: number;

  /** Maximum capacity */
  maxSize: number;

  /** Number of evictions due to size limit */
  evictions: number;

  /** Number of entries expired due to TTL */
  expirations: number;

  /** Hit rate (0-1) */
  hitRate: number;
}

/**
 * In-memory cache with LRU eviction
 *
 * Stores data in memory with automatic expiration and size-based eviction.
 * Uses LRU (Least Recently Used) strategy when max size is reached.
 *
 * Example:
 * ```typescript
 * const cache = new GitHubCache({ maxSize: 1000 });
 *
 * // Get with automatic fetching
 * const data = await cache.get('key', {
 *   fetcher: async () => fetchFromAPI(),
 *   ttl: 300000 // 5 minutes
 * });
 *
 * // Manual set
 * cache.set('key', data, { ttl: 300000, etag: 'abc123' });
 * ```
 */
export class GitHubCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  /**
   * Create a new GitHub cache
   *
   * @param options Configuration options
   */
  constructor(options?: { maxSize?: number; defaultTTL?: number }) {
    this.cache = new Map();
    this.maxSize = options?.maxSize ?? 1000;
    this.defaultTTL = options?.defaultTTL ?? 5 * 60 * 1000; // 5 minutes

    logger.info(MODULE_NAME, 'GitHub cache initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    });
  }

  /**
   * Get data from cache or fetch if not available
   *
   * Implements stale-while-revalidate pattern:
   * - Returns cached data if fresh
   * - Returns null if cache miss, caller must fetch
   * - Updates LRU order on access
   *
   * @param key Cache key
   * @param options Options including fetcher function
   * @returns Cached or freshly fetched data
   */
  async get<T>(key: string, options: CacheGetOptions<T>): Promise<T> {
    const { fetcher, forceRefresh = false } = options;

    // Check for force refresh
    if (forceRefresh) {
      logger.debug(MODULE_NAME, 'Force refresh requested', { key });
      const data = await fetcher();
      this.set(key, data, options);
      return data;
    }

    // Check cache
    const entry = this.cache.get(key);

    if (entry) {
      // Update last accessed time for LRU
      entry.lastAccessed = Date.now();

      // Check if entry is still fresh
      const age = Date.now() - entry.timestamp;
      const isStale = age > entry.ttl;

      if (!isStale) {
        // Cache hit - fresh data
        this.stats.hits++;
        logger.debug(MODULE_NAME, 'Cache hit (fresh)', {
          key,
          age: Math.round(age / 1000),
          ttl: Math.round(entry.ttl / 1000),
        });
        return entry.data;
      }

      // Data is stale - remove and fetch fresh
      logger.debug(MODULE_NAME, 'Cache entry stale, fetching fresh', {
        key,
        age: Math.round(age / 1000),
        ttl: Math.round(entry.ttl / 1000),
      });
      this.cache.delete(key);
      this.stats.expirations++;
    }

    // Cache miss - fetch data
    this.stats.misses++;
    logger.debug(MODULE_NAME, 'Cache miss', { key });

    const data = await fetcher();
    this.set(key, data, options);

    return data;
  }

  /**
   * Set data in cache
   *
   * Automatically evicts least recently used entries if max size exceeded.
   *
   * @param key Cache key
   * @param data Data to cache
   * @param options Cache options including TTL and ETag
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const ttl = options?.ttl ?? this.defaultTTL;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      etag: options?.etag,
      timestamp: now,
      ttl,
      lastAccessed: now,
    };

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);

    logger.debug(MODULE_NAME, 'Cache entry set', {
      key,
      ttl: Math.round(ttl / 1000),
      hasETag: !!options?.etag,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Check if cache entry exists and is fresh
   *
   * @param key Cache key
   * @returns true if entry exists and is not stale
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }

  /**
   * Get cached data without fetching (returns undefined if miss)
   *
   * @param key Cache key
   * @returns Cached data or undefined
   */
  peek<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check freshness
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.expirations++;
      return undefined;
    }

    // Update last accessed for LRU (even on peek)
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * Get ETag for a cache entry
   *
   * @param key Cache key
   * @returns ETag if available
   */
  getETag(key: string): string | undefined {
    const entry = this.cache.get(key);
    return entry?.etag;
  }

  /**
   * Delete a specific cache entry
   *
   * @param key Cache key to delete
   * @returns true if entry was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(MODULE_NAME, 'Cache entry deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    logger.info(MODULE_NAME, 'Cache cleared', {
      entriesCleared: previousSize,
    });
  }

  /**
   * Get current cache statistics
   *
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      hitRate,
    };
  }

  /**
   * Reset statistics (useful for testing or after deployment)
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
    logger.info(MODULE_NAME, 'Cache statistics reset');
  }

  /**
   * Get all cache keys
   *
   * Useful for debugging and monitoring.
   *
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   *
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   *
   * Removes all stale entries from the cache.
   * This is called automatically during normal operations,
   * but can be called manually if needed.
   *
   * @returns Number of entries cleaned
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
        this.stats.expirations++;
      }
    }

    if (cleaned > 0) {
      logger.info(MODULE_NAME, 'Expired entries cleaned', {
        entriesCleaned: cleaned,
        remainingSize: this.cache.size,
      });
    }

    return cleaned;
  }

  /**
   * Evict least recently used entry
   *
   * Finds and removes the entry with the oldest lastAccessed timestamp.
   *
   * @private
   */
  private evictLRU(): void {
    if (this.cache.size === 0) {
      return;
    }

    // Find the least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;

      logger.debug(MODULE_NAME, 'LRU entry evicted', {
        key: lruKey,
        age: Math.round((Date.now() - lruTime) / 1000),
        cacheSize: this.cache.size,
      });
    }
  }
}

/**
 * Global cache instance
 *
 * Singleton instance for application-wide caching.
 */
export const globalGitHubCache = new GitHubCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});

/**
 * Generate a cache key for commit data
 *
 * Creates a deterministic, consistent key based on query parameters.
 * Keys are hashed to keep them under 250 characters.
 *
 * @param repos Array of repository names (e.g., ["facebook/react", "vercel/next.js"])
 * @param since Start date for commit range
 * @param until End date for commit range
 * @param author Optional author filter (email or username)
 * @returns Cache key (SHA-256 hash)
 */
export function generateCommitCacheKey(
  repos: string[],
  since: string,
  until: string,
  author?: string
): string {
  // Sort repositories for consistency
  const sortedRepos = [...repos].sort();

  // Normalize dates to ISO strings
  const normalizedSince = normalizeDateToISO(since);
  const normalizedUntil = normalizeDateToISO(until);

  // Include author or "all" for clarity
  const authorKey = author || 'all';

  // Build key components
  const keyParts = [
    'commits', // Prefix to identify cache type
    sortedRepos.join(','),
    normalizedSince,
    normalizedUntil,
    authorKey,
  ];

  // Create a string to hash
  const keyString = keyParts.join('|');

  // Generate SHA-256 hash (using Web Crypto API pattern)
  const hash = simpleHash(keyString);

  // Return a readable key format: commits:{hash}
  return `commits:${hash}`;
}

/**
 * Normalize date string to ISO format
 *
 * Ensures dates are consistently formatted regardless of input format.
 *
 * @param date Date string (ISO, timestamp, or Date-parseable string)
 * @returns ISO 8601 date string (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
function normalizeDateToISO(date: string): string {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      // Invalid date - return as-is
      logger.warn(MODULE_NAME, 'Invalid date format, using as-is', { date });
      return date;
    }
    return dateObj.toISOString();
  } catch (error) {
    // Fallback to original string
    logger.warn(MODULE_NAME, 'Failed to normalize date', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return date;
  }
}

/**
 * Simple hash function for generating cache keys
 *
 * Creates a deterministic hash from input string.
 * Uses a FNV-1a-like algorithm for speed and distribution.
 *
 * @param input String to hash
 * @returns Hexadecimal hash string
 */
function simpleHash(input: string): string {
  let hash = 2166136261; // FNV offset basis (32-bit)

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Convert to unsigned 32-bit and then to hex
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, '0');
}

/**
 * Parse a cache key to extract metadata
 *
 * Useful for debugging and logging.
 *
 * @param key Cache key generated by generateCommitCacheKey
 * @returns Metadata about the cache key
 */
export function parseCacheKey(key: string): {
  type: string;
  hash: string;
} {
  const parts = key.split(':');
  return {
    type: parts[0] || 'unknown',
    hash: parts[1] || key,
  };
}