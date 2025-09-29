/**
 * Adaptive Rate Limiter with exponential backoff
 *
 * Wraps API calls with token bucket rate limiting and implements
 * exponential backoff with jitter when rate limits are hit.
 *
 * Features:
 * - Token bucket for smooth rate limiting
 * - Exponential backoff on rate limit errors
 * - Jitter to prevent thundering herd
 * - Circuit breaker for catastrophic failures
 * - Metrics collection for observability
 */

import { TokenBucket } from './tokenBucket';
import { logger } from '../logger';

const MODULE_NAME = 'adaptiveRateLimiter';

/**
 * Configuration options for AdaptiveRateLimiter
 */
export interface AdaptiveRateLimiterOptions {
  /** Initial capacity of the token bucket */
  capacity?: number;

  /** Initial refill rate (tokens per second) */
  refillRate?: number;

  /** Initial backoff time in milliseconds (default: 60000 = 1 minute) */
  initialBackoff?: number;

  /** Maximum backoff multiplier (default: 8) */
  maxBackoffMultiplier?: number;

  /** Jitter percentage (0-1, default: 0.1 = 10%) */
  jitterPercentage?: number;

  /** Circuit breaker threshold - pause after N consecutive rate limits (default: 5) */
  circuitBreakerThreshold?: number;

  /** Circuit breaker pause duration in milliseconds (default: 60000 = 1 minute) */
  circuitBreakerPause?: number;
}

/**
 * Rate limit error interface
 * Used to identify rate limit errors from API responses
 */
export interface RateLimitError extends Error {
  statusCode?: number;
  headers?: Record<string, string>;
}

/**
 * Metrics for rate limiter performance
 */
export interface RateLimiterMetrics {
  /** Total number of requests executed */
  totalRequests: number;

  /** Number of requests that hit rate limits */
  rateLimitHits: number;

  /** Number of successful requests */
  successfulRequests: number;

  /** Number of failed requests (non-rate-limit errors) */
  failedRequests: number;

  /** Current backoff multiplier */
  currentBackoffMultiplier: number;

  /** Whether circuit breaker is currently open */
  circuitBreakerOpen: boolean;

  /** Number of times circuit breaker has opened */
  circuitBreakerTrips: number;
}

/**
 * Adaptive Rate Limiter
 *
 * Implements token bucket rate limiting with exponential backoff.
 * Automatically adjusts behavior based on rate limit responses.
 *
 * Example:
 * ```typescript
 * const limiter = new AdaptiveRateLimiter({
 *   capacity: 10,
 *   refillRate: 2
 * });
 *
 * const result = await limiter.execute(async () => {
 *   return await fetchFromAPI();
 * });
 * ```
 */
export class AdaptiveRateLimiter {
  private tokenBucket: TokenBucket;
  private backoffMultiplier: number = 1;
  private consecutiveRateLimits: number = 0;
  private circuitBreakerOpenUntil: number = 0;

  private readonly initialBackoff: number;
  private readonly maxBackoffMultiplier: number;
  private readonly jitterPercentage: number;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerPause: number;

  // Metrics
  private metrics: RateLimiterMetrics = {
    totalRequests: 0,
    rateLimitHits: 0,
    successfulRequests: 0,
    failedRequests: 0,
    currentBackoffMultiplier: 1,
    circuitBreakerOpen: false,
    circuitBreakerTrips: 0,
  };

  /**
   * Create a new adaptive rate limiter
   *
   * @param options Configuration options
   */
  constructor(options: AdaptiveRateLimiterOptions = {}) {
    // Initialize token bucket with defaults or provided values
    this.tokenBucket = new TokenBucket({
      capacity: options.capacity ?? 10,
      refillRate: options.refillRate ?? 2,
    });

    // Set backoff configuration
    this.initialBackoff = options.initialBackoff ?? 60000; // 1 minute
    this.maxBackoffMultiplier = options.maxBackoffMultiplier ?? 8;
    this.jitterPercentage = options.jitterPercentage ?? 0.1;

    // Set circuit breaker configuration
    this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 5;
    this.circuitBreakerPause = options.circuitBreakerPause ?? 60000; // 1 minute

    logger.info(MODULE_NAME, 'Adaptive rate limiter initialized', {
      capacity: this.tokenBucket.getConfig().capacity,
      refillRate: this.tokenBucket.getConfig().refillRate,
      initialBackoff: this.initialBackoff,
      maxBackoffMultiplier: this.maxBackoffMultiplier,
    });
  }

  /**
   * Execute a function with rate limiting and backoff
   *
   * Automatically handles token consumption, rate limit detection,
   * exponential backoff, and circuit breaking.
   *
   * @param fn Function to execute
   * @returns Promise resolving to the function's return value
   * @throws Error if circuit breaker is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      const waitTime = this.circuitBreakerOpenUntil - Date.now();
      logger.warn(MODULE_NAME, 'Circuit breaker is open, request rejected', {
        waitTimeMs: waitTime,
      });

      throw new Error(
        `Circuit breaker is open. Wait ${Math.ceil(waitTime / 1000)} seconds before retrying.`
      );
    }

    // Wait for token availability
    await this.waitForToken();

    try {
      // Execute the function
      const result = await fn();

      // Success - reset backoff
      this.onSuccess();

      return result;
    } catch (error) {
      // Check if this is a rate limit error
      if (this.isRateLimitError(error)) {
        await this.onRateLimitError(error as RateLimitError);
        throw error;
      }

      // Other error - track but don't backoff
      this.metrics.failedRequests++;
      logger.error(MODULE_NAME, 'Request failed with non-rate-limit error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Wait for a token to become available
   *
   * Uses token bucket to implement rate limiting.
   * Blocks until a token is available.
   *
   * @private
   */
  private async waitForToken(): Promise<void> {
    // Try to take a token
    if (this.tokenBucket.take(1)) {
      return;
    }

    // No token available - wait
    const waitTime = this.tokenBucket.timeUntilNextToken();
    logger.debug(MODULE_NAME, 'Waiting for token availability', {
      waitTimeMs: waitTime,
    });

    await this.sleep(waitTime);

    // Try again (should succeed now)
    if (!this.tokenBucket.take(1)) {
      logger.warn(MODULE_NAME, 'Token still not available after waiting');
    }
  }

  /**
   * Check if an error is a rate limit error
   *
   * Detects 403/429 status codes which indicate rate limiting.
   *
   * @param error Error to check
   * @returns true if this is a rate limit error
   * @private
   */
  private isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as RateLimitError;

    // Check for 403 Forbidden or 429 Too Many Requests
    return err.statusCode === 403 || err.statusCode === 429;
  }

  /**
   * Handle rate limit error
   *
   * Implements exponential backoff with jitter and circuit breaking.
   *
   * @param error Rate limit error
   * @private
   */
  private async onRateLimitError(error: RateLimitError): Promise<void> {
    this.metrics.rateLimitHits++;
    this.consecutiveRateLimits++;

    // Calculate backoff time
    let backoffTime = this.calculateBackoffTime(error);

    logger.warn(MODULE_NAME, 'Rate limit hit, backing off', {
      consecutiveRateLimits: this.consecutiveRateLimits,
      backoffTimeMs: backoffTime,
      backoffMultiplier: this.backoffMultiplier,
    });

    // Increase backoff multiplier (capped at max)
    this.backoffMultiplier = Math.min(
      this.backoffMultiplier * 2,
      this.maxBackoffMultiplier
    );
    this.metrics.currentBackoffMultiplier = this.backoffMultiplier;

    // Check circuit breaker threshold
    if (this.consecutiveRateLimits >= this.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }

    // Wait for backoff period
    await this.sleep(backoffTime);
  }

  /**
   * Calculate backoff time with jitter
   *
   * Uses exponential backoff with jitter to prevent thundering herd.
   * Respects retry-after header if present.
   *
   * @param error Rate limit error
   * @returns Backoff time in milliseconds
   * @private
   */
  private calculateBackoffTime(error: RateLimitError): number {
    // Check for retry-after header
    const retryAfter = this.extractRetryAfter(error);
    if (retryAfter) {
      logger.info(MODULE_NAME, 'Using retry-after header for backoff', {
        retryAfterSeconds: retryAfter,
      });
      return retryAfter * 1000; // Convert to milliseconds
    }

    // Calculate exponential backoff
    const baseBackoff = this.initialBackoff * this.backoffMultiplier;

    // Add jitter (±10%)
    const jitter = this.addJitter(baseBackoff);

    return jitter;
  }

  /**
   * Extract retry-after value from error headers
   *
   * Supports both seconds (integer) and HTTP date format.
   *
   * @param error Rate limit error
   * @returns Number of seconds to wait, or null if not present
   * @private
   */
  private extractRetryAfter(error: RateLimitError): number | null {
    if (!error.headers) {
      return null;
    }

    // Look for retry-after header (case-insensitive)
    const retryAfter = Object.keys(error.headers).find(
      (key) => key.toLowerCase() === 'retry-after'
    );

    if (!retryAfter) {
      return null;
    }

    const value = error.headers[retryAfter];

    // Try parsing as integer (seconds)
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }

    // Try parsing as HTTP date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const secondsUntil = Math.ceil((date.getTime() - Date.now()) / 1000);
      return Math.max(0, secondsUntil);
    }

    return null;
  }

  /**
   * Add jitter to a time value
   *
   * Adds random variation (±jitterPercentage) to prevent
   * thundering herd when multiple clients back off simultaneously.
   *
   * @param time Base time in milliseconds
   * @returns Time with jitter applied
   * @private
   */
  private addJitter(time: number): number {
    const jitterAmount = time * this.jitterPercentage;
    const jitter = (Math.random() * 2 - 1) * jitterAmount; // Random value between -jitterAmount and +jitterAmount
    return Math.ceil(time + jitter);
  }

  /**
   * Handle successful request
   *
   * Resets backoff multiplier and consecutive rate limit counter.
   *
   * @private
   */
  private onSuccess(): void {
    this.metrics.successfulRequests++;

    // Reset backoff on success
    if (this.backoffMultiplier > 1) {
      logger.info(MODULE_NAME, 'Request successful, resetting backoff', {
        previousMultiplier: this.backoffMultiplier,
      });
      this.backoffMultiplier = 1;
      this.metrics.currentBackoffMultiplier = 1;
    }

    // Reset consecutive rate limits
    this.consecutiveRateLimits = 0;
  }

  /**
   * Open the circuit breaker
   *
   * Pauses all requests for the configured duration.
   *
   * @private
   */
  private openCircuitBreaker(): void {
    this.circuitBreakerOpenUntil = Date.now() + this.circuitBreakerPause;
    this.metrics.circuitBreakerOpen = true;
    this.metrics.circuitBreakerTrips++;

    logger.error(MODULE_NAME, 'Circuit breaker opened due to consecutive rate limits', {
      consecutiveRateLimits: this.consecutiveRateLimits,
      pauseDurationMs: this.circuitBreakerPause,
      reopensAt: new Date(this.circuitBreakerOpenUntil).toISOString(),
    });
  }

  /**
   * Check if circuit breaker is currently open
   *
   * @returns true if circuit breaker is open
   * @private
   */
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();

    // Check if circuit breaker was open and should now close
    if (this.circuitBreakerOpenUntil > 0 && now >= this.circuitBreakerOpenUntil) {
      logger.info(MODULE_NAME, 'Circuit breaker closing');
      this.circuitBreakerOpenUntil = 0;
      this.consecutiveRateLimits = 0;
      this.metrics.circuitBreakerOpen = false;
    }

    return this.circuitBreakerOpenUntil > now;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms Milliseconds to sleep
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current metrics
   *
   * @returns Current rate limiter metrics
   */
  getMetrics(): Readonly<RateLimiterMetrics> {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   *
   * Useful for testing or after deployment to start fresh.
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      successfulRequests: 0,
      failedRequests: 0,
      currentBackoffMultiplier: this.backoffMultiplier,
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      circuitBreakerTrips: 0,
    };

    logger.info(MODULE_NAME, 'Rate limiter metrics reset');
  }

  /**
   * Get token bucket configuration
   *
   * @returns Current token bucket state
   */
  getTokenBucketConfig() {
    return this.tokenBucket.getConfig();
  }

  /**
   * Update refill rate dynamically
   *
   * Useful for adapting to server-reported rate limits.
   *
   * @param newRate New refill rate (tokens per second)
   */
  setRefillRate(newRate: number): void {
    this.tokenBucket.setRefillRate(newRate);
    logger.info(MODULE_NAME, 'Rate limiter refill rate updated', {
      newRate,
    });
  }

  /**
   * Update capacity dynamically
   *
   * Useful for adapting to server-reported rate limits.
   *
   * @param newCapacity New capacity
   */
  setCapacity(newCapacity: number): void {
    this.tokenBucket.setCapacity(newCapacity);
    logger.info(MODULE_NAME, 'Rate limiter capacity updated', {
      newCapacity,
    });
  }

  /**
   * Manually close circuit breaker
   *
   * Use with caution - primarily for testing or manual intervention.
   */
  closeCircuitBreaker(): void {
    if (this.isCircuitBreakerOpen()) {
      logger.warn(MODULE_NAME, 'Circuit breaker manually closed');
      this.circuitBreakerOpenUntil = 0;
      this.consecutiveRateLimits = 0;
      this.metrics.circuitBreakerOpen = false;
    }
  }
}