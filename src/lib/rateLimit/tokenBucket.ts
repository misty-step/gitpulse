/**
 * Token Bucket rate limiting algorithm
 *
 * Implements a token bucket for rate limiting with configurable capacity
 * and refill rate. Uses lazy refill (calculates on demand) rather than
 * timers for better performance and predictability.
 *
 * @see https://en.wikipedia.org/wiki/Token_bucket
 */

/**
 * Token Bucket configuration options
 */
export interface TokenBucketOptions {
  /** Maximum number of tokens the bucket can hold */
  capacity: number;

  /** Number of tokens to add per second */
  refillRate: number;

  /** Optional: Initial number of tokens (defaults to capacity) */
  initialTokens?: number;
}

/**
 * Token Bucket rate limiter
 *
 * The token bucket algorithm allows burst behavior while enforcing
 * an average rate limit. Tokens are added at a constant rate, and
 * requests consume tokens. When no tokens are available, requests
 * must wait.
 *
 * Example:
 * ```typescript
 * const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });
 *
 * if (bucket.take(1)) {
 *   // Proceed with API call
 * } else {
 *   // Wait or reject request
 *   const waitTime = bucket.timeUntilNextToken();
 * }
 * ```
 */
export class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRate: number;
  private lastRefillTime: number;

  /**
   * Create a new token bucket
   *
   * @param options Configuration options
   */
  constructor(options: TokenBucketOptions) {
    if (options.capacity <= 0) {
      throw new Error('Token bucket capacity must be greater than 0');
    }

    if (options.refillRate <= 0) {
      throw new Error('Token bucket refill rate must be greater than 0');
    }

    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.tokens = options.initialTokens ?? options.capacity;
    this.lastRefillTime = Date.now();

    // Clamp initial tokens to capacity
    if (this.tokens > this.capacity) {
      this.tokens = this.capacity;
    }
  }

  /**
   * Refill tokens based on elapsed time
   *
   * This is called internally before checking or consuming tokens.
   * It calculates how many tokens to add based on time elapsed since
   * the last refill.
   *
   * @private
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;

    if (elapsedSeconds > 0) {
      // Calculate tokens to add based on elapsed time
      const tokensToAdd = elapsedSeconds * this.refillRate;

      // Add tokens but don't exceed capacity
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

      // Update last refill time
      this.lastRefillTime = now;
    }
  }

  /**
   * Attempt to take tokens from the bucket
   *
   * Returns true if tokens were available and consumed, false otherwise.
   * This method does not wait or block.
   *
   * @param count Number of tokens to take (default: 1)
   * @returns true if tokens were taken, false if insufficient tokens
   */
  take(count: number = 1): boolean {
    if (count <= 0) {
      throw new Error('Token count must be greater than 0');
    }

    if (count > this.capacity) {
      throw new Error(`Cannot take ${count} tokens, bucket capacity is only ${this.capacity}`);
    }

    // Refill tokens based on elapsed time
    this.refill();

    // Check if we have enough tokens
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get the number of tokens currently available
   *
   * This includes tokens that have been refilled since the last operation.
   *
   * @returns Number of tokens available (may be fractional)
   */
  tokensAvailable(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get the time in milliseconds until the next token is available
   *
   * Useful for implementing backoff strategies or providing user feedback.
   *
   * @returns Time in milliseconds until at least one token is available (0 if tokens are available now)
   */
  timeUntilNextToken(): number {
    this.refill();

    // If tokens are available, no wait time
    if (this.tokens >= 1) {
      return 0;
    }

    // Calculate time needed to refill one token
    const tokensNeeded = 1 - this.tokens;
    const secondsNeeded = tokensNeeded / this.refillRate;
    return Math.ceil(secondsNeeded * 1000);
  }

  /**
   * Get the time in milliseconds until a specific number of tokens is available
   *
   * @param count Number of tokens needed
   * @returns Time in milliseconds until the specified number of tokens is available
   */
  timeUntilTokens(count: number): number {
    if (count <= 0) {
      throw new Error('Token count must be greater than 0');
    }

    if (count > this.capacity) {
      throw new Error(`Cannot wait for ${count} tokens, bucket capacity is only ${this.capacity}`);
    }

    this.refill();

    // If we have enough tokens, no wait time
    if (this.tokens >= count) {
      return 0;
    }

    // Calculate time needed to refill required tokens
    const tokensNeeded = count - this.tokens;
    const secondsNeeded = tokensNeeded / this.refillRate;
    return Math.ceil(secondsNeeded * 1000);
  }

  /**
   * Reset the bucket to its initial state
   *
   * Useful for testing or manual intervention.
   *
   * @param tokens Optional number of tokens to reset to (defaults to capacity)
   */
  reset(tokens?: number): void {
    this.tokens = tokens ?? this.capacity;
    this.lastRefillTime = Date.now();

    // Clamp to capacity
    if (this.tokens > this.capacity) {
      this.tokens = this.capacity;
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current bucket configuration
   */
  getConfig(): { capacity: number; refillRate: number; tokens: number } {
    this.refill();
    return {
      capacity: this.capacity,
      refillRate: this.refillRate,
      tokens: this.tokens,
    };
  }

  /**
   * Update the refill rate dynamically
   *
   * Useful for adaptive rate limiting based on server responses.
   *
   * @param newRate New refill rate (tokens per second)
   */
  setRefillRate(newRate: number): void {
    if (newRate <= 0) {
      throw new Error('Refill rate must be greater than 0');
    }

    // Refill with old rate before changing
    this.refill();

    this.refillRate = newRate;
  }

  /**
   * Update the capacity dynamically
   *
   * Useful for adaptive rate limiting based on server responses.
   * If new capacity is less than current tokens, tokens are capped.
   *
   * @param newCapacity New maximum capacity
   */
  setCapacity(newCapacity: number): void {
    if (newCapacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }

    // Refill before changing capacity
    this.refill();

    this.capacity = newCapacity;

    // Cap tokens to new capacity
    if (this.tokens > this.capacity) {
      this.tokens = this.capacity;
    }
  }
}