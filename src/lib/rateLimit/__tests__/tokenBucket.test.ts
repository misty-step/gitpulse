/**
 * Unit tests for TokenBucket rate limiter
 */

import { TokenBucket } from '../tokenBucket';

// Helper to wait for a specific amount of time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('TokenBucket', () => {
  describe('Constructor', () => {
    it('should create a bucket with correct initial state', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      const config = bucket.getConfig();
      expect(config.capacity).toBe(10);
      expect(config.refillRate).toBe(2);
      expect(config.tokens).toBe(10); // Starts full
    });

    it('should respect initialTokens option', () => {
      const bucket = new TokenBucket({
        capacity: 10,
        refillRate: 2,
        initialTokens: 5,
      });

      expect(bucket.tokensAvailable()).toBe(5);
    });

    it('should clamp initialTokens to capacity', () => {
      const bucket = new TokenBucket({
        capacity: 10,
        refillRate: 2,
        initialTokens: 15,
      });

      expect(bucket.tokensAvailable()).toBe(10);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new TokenBucket({ capacity: 0, refillRate: 2 })).toThrow(
        'Token bucket capacity must be greater than 0'
      );

      expect(() => new TokenBucket({ capacity: -5, refillRate: 2 })).toThrow(
        'Token bucket capacity must be greater than 0'
      );
    });

    it('should throw error for invalid refill rate', () => {
      expect(() => new TokenBucket({ capacity: 10, refillRate: 0 })).toThrow(
        'Token bucket refill rate must be greater than 0'
      );

      expect(() => new TokenBucket({ capacity: 10, refillRate: -1 })).toThrow(
        'Token bucket refill rate must be greater than 0'
      );
    });
  });

  describe('take()', () => {
    it('should successfully take tokens when available', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(bucket.take(1)).toBe(true);
      expect(bucket.tokensAvailable()).toBe(9);

      expect(bucket.take(3)).toBe(true);
      expect(bucket.tokensAvailable()).toBe(6);
    });

    it('should fail to take tokens when insufficient', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 2 });

      expect(bucket.take(1)).toBe(true); // 2 -> 1
      expect(bucket.take(1)).toBe(true); // 1 -> 0
      expect(bucket.take(1)).toBe(false); // No tokens left
      expect(bucket.tokensAvailable()).toBe(0);
    });

    it('should throw error for invalid token count', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.take(0)).toThrow('Token count must be greater than 0');
      expect(() => bucket.take(-1)).toThrow('Token count must be greater than 0');
    });

    it('should throw error when requesting more than capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.take(11)).toThrow(
        'Cannot take 11 tokens, bucket capacity is only 10'
      );
    });

    it('should default to taking 1 token', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(bucket.take()).toBe(true);
      expect(bucket.tokensAvailable()).toBe(9);
    });
  });

  describe('Token refill over time', () => {
    it('should refill tokens based on elapsed time', async () => {
      // Create bucket with 2 tokens per second refill rate
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 0 });

      expect(bucket.tokensAvailable()).toBe(0);

      // Wait 1 second - should refill 2 tokens
      await wait(1000);

      const tokens = bucket.tokensAvailable();
      expect(tokens).toBeGreaterThanOrEqual(1.8); // Allow for timing variance
      expect(tokens).toBeLessThanOrEqual(2.2);
    });

    it('should not exceed capacity when refilling', async () => {
      const bucket = new TokenBucket({ capacity: 5, refillRate: 10 });

      // Wait 1 second - would refill 10 tokens, but capacity is 5
      await wait(1000);

      expect(bucket.tokensAvailable()).toBe(5);
    });

    it('should refill gradually over multiple operations', async () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 4, initialTokens: 0 });

      // Wait 500ms - should refill ~2 tokens
      await wait(500);
      expect(bucket.tokensAvailable()).toBeGreaterThanOrEqual(1.5);
      expect(bucket.tokensAvailable()).toBeLessThanOrEqual(2.5);

      // Wait another 500ms - should have ~4 total
      await wait(500);
      expect(bucket.tokensAvailable()).toBeGreaterThanOrEqual(3.5);
      expect(bucket.tokensAvailable()).toBeLessThanOrEqual(4.5);
    });
  });

  describe('Burst capacity', () => {
    it('should allow burst usage up to capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });

      // Can make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        expect(bucket.take(1)).toBe(true);
      }

      // 11th request should fail
      expect(bucket.take(1)).toBe(false);
    });

    it('should recover burst capacity over time', async () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 5, initialTokens: 0 });

      // Empty bucket
      expect(bucket.take(1)).toBe(false);

      // Wait 2 seconds - should refill 10 tokens (5 tokens/sec * 2 sec)
      await wait(2000);

      // Should be able to burst 10 requests again
      for (let i = 0; i < 10; i++) {
        expect(bucket.take(1)).toBe(true);
      }

      expect(bucket.take(1)).toBe(false);
    });
  });

  describe('timeUntilNextToken()', () => {
    it('should return 0 when tokens are available', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(bucket.timeUntilNextToken()).toBe(0);
    });

    it('should calculate wait time when no tokens available', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 0 });

      const waitTime = bucket.timeUntilNextToken();

      // Should be ~500ms (1 token / 2 tokens per second = 0.5 seconds)
      expect(waitTime).toBeGreaterThanOrEqual(400);
      expect(waitTime).toBeLessThanOrEqual(600);
    });

    it('should account for partial tokens', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 4, initialTokens: 0.5 });

      const waitTime = bucket.timeUntilNextToken();

      // Need 0.5 more tokens, at 4 tokens/sec = 0.125 seconds = 125ms
      expect(waitTime).toBeGreaterThanOrEqual(100);
      expect(waitTime).toBeLessThanOrEqual(150);
    });
  });

  describe('timeUntilTokens()', () => {
    it('should return 0 when enough tokens available', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(bucket.timeUntilTokens(5)).toBe(0);
      expect(bucket.timeUntilTokens(10)).toBe(0);
    });

    it('should calculate wait time for multiple tokens', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 0 });

      const waitTime = bucket.timeUntilTokens(4);

      // Need 4 tokens at 2 tokens/sec = 2 seconds = 2000ms
      expect(waitTime).toBeGreaterThanOrEqual(1900);
      expect(waitTime).toBeLessThanOrEqual(2100);
    });

    it('should throw error for invalid token count', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.timeUntilTokens(0)).toThrow('Token count must be greater than 0');
      expect(() => bucket.timeUntilTokens(-1)).toThrow('Token count must be greater than 0');
    });

    it('should throw error when count exceeds capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.timeUntilTokens(11)).toThrow(
        'Cannot wait for 11 tokens, bucket capacity is only 10'
      );
    });
  });

  describe('reset()', () => {
    it('should reset bucket to capacity by default', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      bucket.take(5);
      expect(bucket.tokensAvailable()).toBe(5);

      bucket.reset();
      expect(bucket.tokensAvailable()).toBe(10);
    });

    it('should reset to specified token count', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      bucket.reset(3);
      expect(bucket.tokensAvailable()).toBe(3);
    });

    it('should clamp reset tokens to capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      bucket.reset(15);
      expect(bucket.tokensAvailable()).toBe(10);
    });
  });

  describe('setRefillRate()', () => {
    it('should update refill rate', async () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 1, initialTokens: 0 });

      // Set to 4 tokens per second
      bucket.setRefillRate(4);

      // Wait 500ms - should refill ~2 tokens
      await wait(500);

      const tokens = bucket.tokensAvailable();
      expect(tokens).toBeGreaterThanOrEqual(1.5);
      expect(tokens).toBeLessThanOrEqual(2.5);
    });

    it('should throw error for invalid rate', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.setRefillRate(0)).toThrow('Refill rate must be greater than 0');
      expect(() => bucket.setRefillRate(-1)).toThrow('Refill rate must be greater than 0');
    });
  });

  describe('setCapacity()', () => {
    it('should update capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      bucket.setCapacity(20);

      const config = bucket.getConfig();
      expect(config.capacity).toBe(20);
    });

    it('should cap current tokens to new capacity when reducing', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(bucket.tokensAvailable()).toBe(10);

      bucket.setCapacity(5);

      expect(bucket.tokensAvailable()).toBe(5);
    });

    it('should throw error for invalid capacity', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      expect(() => bucket.setCapacity(0)).toThrow('Capacity must be greater than 0');
      expect(() => bucket.setCapacity(-1)).toThrow('Capacity must be greater than 0');
    });
  });

  describe('getConfig()', () => {
    it('should return current configuration', () => {
      const bucket = new TokenBucket({ capacity: 10, refillRate: 2 });

      bucket.take(3);

      const config = bucket.getConfig();

      expect(config).toEqual({
        capacity: 10,
        refillRate: 2,
        tokens: 7,
      });
    });
  });
});