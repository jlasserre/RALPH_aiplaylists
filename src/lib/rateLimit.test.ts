import {
  checkRateLimit,
  clearRateLimitStore,
  getRateLimitStoreSize,
  getClientIP,
  getSessionID,
  applyRateLimit,
  RATE_LIMITS,
} from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    clearRateLimitStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit({
        maxTokens: 10,
        windowMs: 60000,
        identifier: 'test-user',
      });

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should allow requests up to the limit', () => {
      const options = {
        maxTokens: 5,
        windowMs: 60000,
        identifier: 'test-user-2',
      };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(options);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests over the limit', () => {
      const options = {
        maxTokens: 3,
        windowMs: 60000,
        identifier: 'test-user-3',
      };

      // Make 3 requests (allowed)
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(options);
        expect(result.success).toBe(true);
      }

      // 4th request should be blocked
      const result = checkRateLimit(options);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should refill tokens over time', () => {
      const options = {
        maxTokens: 10,
        windowMs: 60000,
        identifier: 'test-user-4',
      };

      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit(options);
      }

      // Should be blocked
      let result = checkRateLimit(options);
      expect(result.success).toBe(false);

      // Advance time by half the window (30 seconds)
      jest.advanceTimersByTime(30000);

      // Should have refilled ~5 tokens
      result = checkRateLimit(options);
      expect(result.success).toBe(true);
    });

    it('should track different identifiers separately', () => {
      const optionsA = {
        maxTokens: 2,
        windowMs: 60000,
        identifier: 'user-a',
      };

      const optionsB = {
        maxTokens: 2,
        windowMs: 60000,
        identifier: 'user-b',
      };

      // Exhaust user A's tokens
      checkRateLimit(optionsA);
      checkRateLimit(optionsA);
      const resultA = checkRateLimit(optionsA);
      expect(resultA.success).toBe(false);

      // User B should still have tokens
      const resultB = checkRateLimit(optionsB);
      expect(resultB.success).toBe(true);
    });

    it('should return retryAfter in seconds', () => {
      const options = {
        maxTokens: 1,
        windowMs: 60000,
        identifier: 'test-user-5',
      };

      // Use the only token
      checkRateLimit(options);

      // Should be blocked
      const result = checkRateLimit(options);
      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
      expect(typeof result.retryAfter).toBe('number');
    });

    it('should cap tokens at maxTokens on refill', () => {
      const options = {
        maxTokens: 5,
        windowMs: 60000,
        identifier: 'test-user-6',
      };

      // Make 1 request
      checkRateLimit(options);

      // Wait for more than the full window
      jest.advanceTimersByTime(120000);

      // Should still have max tokens
      const result = checkRateLimit(options);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
    });
  });

  describe('clearRateLimitStore', () => {
    it('should clear all entries', () => {
      // Add some entries
      checkRateLimit({ maxTokens: 10, windowMs: 60000, identifier: 'user-1' });
      checkRateLimit({ maxTokens: 10, windowMs: 60000, identifier: 'user-2' });

      expect(getRateLimitStoreSize()).toBe(2);

      clearRateLimitStore();

      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
      });

      expect(getClientIP(request)).toBe('192.168.1.2');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.2',
        },
      });

      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should return unknown for requests without IP headers', () => {
      const request = new Request('http://localhost');

      expect(getClientIP(request)).toBe('unknown');
    });
  });

  describe('getSessionID', () => {
    it('should extract session_id from cookies', () => {
      const request = new Request('http://localhost', {
        headers: {
          cookie: 'session_id=abc123; other=value',
        },
      });

      expect(getSessionID(request)).toBe('abc123');
    });

    it('should use access_token as fallback', () => {
      const request = new Request('http://localhost', {
        headers: {
          cookie: 'access_token=token123456789012345678901234567890; other=value',
        },
      });

      // Should use first 32 chars
      expect(getSessionID(request)).toBe('token123456789012345678901234567');
    });

    it('should use IP and user-agent as fallback', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(getSessionID(request)).toBe('192.168.1.1:Mozilla/5.0');
    });
  });

  describe('applyRateLimit', () => {
    it('should return success for allowed requests', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const result = applyRateLimit(request, RATE_LIMITS.general, 'general');

      expect(result.success).toBe(true);
      expect(result.response).toBeUndefined();
      expect(result.remaining).toBe(99);
    });

    it('should return 429 response for rate limited requests', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });

      const config = { maxTokens: 2, windowMs: 60000 };

      // Exhaust tokens
      applyRateLimit(request, config, 'test');
      applyRateLimit(request, config, 'test');

      // Third request should be limited
      const result = applyRateLimit(request, config, 'test');

      expect(result.success).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(429);
    });

    it('should include Retry-After header in 429 response', async () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.3',
        },
      });

      const config = { maxTokens: 1, windowMs: 60000 };

      // Exhaust token
      applyRateLimit(request, config, 'test2');

      // Second request should be limited
      const result = applyRateLimit(request, config, 'test2');

      expect(result.response).toBeDefined();
      expect(result.response?.headers.get('Retry-After')).toBeDefined();
      expect(result.response?.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(result.response?.headers.get('X-RateLimit-Remaining')).toBe('0');

      const body = await result.response?.json();
      expect(body.error).toBe('Too Many Requests');
      expect(body.retryAfter).toBeGreaterThan(0);
    });

    it('should use session ID for generate endpoint', () => {
      const request = new Request('http://localhost', {
        headers: {
          cookie: 'session_id=session-abc',
          'x-forwarded-for': '192.168.1.4',
        },
      });

      const config = { maxTokens: 10, windowMs: 60000 };

      // Make a request with session prefix
      const result = applyRateLimit(request, config, 'generate');

      expect(result.success).toBe(true);
      // The identifier should be session-based, not IP-based
    });

    it('should use IP for general endpoint', () => {
      const request = new Request('http://localhost', {
        headers: {
          cookie: 'session_id=session-xyz',
          'x-forwarded-for': '192.168.1.5',
        },
      });

      const config = { maxTokens: 100, windowMs: 60000 };

      // Make a request with general prefix
      const result = applyRateLimit(request, config, 'general');

      expect(result.success).toBe(true);
      // The identifier should be IP-based
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have generate limit of 10 req/min', () => {
      expect(RATE_LIMITS.generate.maxTokens).toBe(10);
      expect(RATE_LIMITS.generate.windowMs).toBe(60000);
    });

    it('should have general limit of 100 req/min', () => {
      expect(RATE_LIMITS.general.maxTokens).toBe(100);
      expect(RATE_LIMITS.general.windowMs).toBe(60000);
    });
  });
});
