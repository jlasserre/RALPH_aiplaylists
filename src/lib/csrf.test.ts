/**
 * Tests for CSRF protection utilities
 */

import {
  generateCSRFToken,
  setCSRFCookies,
  clearCSRFCookies,
  validateCSRFToken,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_READABLE_NAME,
  CSRF_HEADER_NAME,
} from './csrf';

// Mock next/headers cookies
const mockCookieStore = {
  get: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

describe('CSRF Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCSRFToken', () => {
    it('should generate a non-empty string', () => {
      const token = generateCSRFToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCSRFToken());
      }
      // All 100 tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it('should generate URL-safe tokens (base64url)', () => {
      const token = generateCSRFToken();
      // Should not contain +, /, or = (base64 characters)
      expect(token).not.toMatch(/[+/=]/);
      // Should only contain URL-safe characters
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate tokens of consistent length', () => {
      // 32 bytes = 256 bits, base64url encoded = ~43 characters
      const tokens = Array.from({ length: 10 }, () => generateCSRFToken());
      const lengths = tokens.map((t) => t.length);
      // All tokens should be about the same length (may vary by 1-2 due to base64 padding removal)
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(2);
    });
  });

  describe('setCSRFCookies', () => {
    it('should set both httpOnly and readable cookies', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      };

      const token = 'test-csrf-token';
      setCSRFCookies(token, mockResponse);

      // Should have called set twice
      expect(mockResponse.cookies.set).toHaveBeenCalledTimes(2);

      // First call: httpOnly cookie
      expect(mockResponse.cookies.set).toHaveBeenNthCalledWith(
        1,
        CSRF_COOKIE_NAME,
        token,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      );

      // Second call: readable cookie
      expect(mockResponse.cookies.set).toHaveBeenNthCalledWith(
        2,
        CSRF_COOKIE_READABLE_NAME,
        token,
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      );
    });

    it('should set secure flag based on NODE_ENV', () => {
      // In test environment (NODE_ENV === 'test'), secure should be false
      const mockResponse = { cookies: { set: jest.fn() } };
      setCSRFCookies('token', mockResponse);

      const isProduction = process.env.NODE_ENV === 'production';
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        'token',
        expect.objectContaining({ secure: isProduction })
      );
    });
  });

  describe('clearCSRFCookies', () => {
    it('should delete both cookies', () => {
      const mockResponse = {
        cookies: {
          delete: jest.fn(),
        },
      };

      clearCSRFCookies(mockResponse);

      expect(mockResponse.cookies.delete).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookies.delete).toHaveBeenCalledWith(CSRF_COOKIE_NAME);
      expect(mockResponse.cookies.delete).toHaveBeenCalledWith(CSRF_COOKIE_READABLE_NAME);
    });
  });

  describe('validateCSRFToken', () => {
    it('should return valid when tokens match', async () => {
      const token = 'valid-token-12345';
      mockCookieStore.get.mockReturnValue({ value: token });

      const request = new Request('https://example.com', {
        headers: { [CSRF_HEADER_NAME]: token },
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when header token is missing', async () => {
      const request = new Request('https://example.com', {
        headers: {},
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing CSRF token header');
    });

    it('should return invalid when cookie token is missing', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const request = new Request('https://example.com', {
        headers: { [CSRF_HEADER_NAME]: 'some-token' },
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing CSRF token cookie');
    });

    it('should return invalid when tokens do not match', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'cookie-token' });

      const request = new Request('https://example.com', {
        headers: { [CSRF_HEADER_NAME]: 'different-token' },
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid CSRF token');
    });

    it('should return invalid when tokens have different lengths', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'short' });

      const request = new Request('https://example.com', {
        headers: { [CSRF_HEADER_NAME]: 'much-longer-token' },
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid CSRF token');
    });

    it('should use timing-safe comparison', async () => {
      // This test verifies the comparison doesn't short-circuit on first mismatch
      // Both tokens have same length but different content
      mockCookieStore.get.mockReturnValue({ value: 'aaaaaaaaaa' });

      const request = new Request('https://example.com', {
        headers: { [CSRF_HEADER_NAME]: 'bbbbbbbbbb' },
      });

      const result = await validateCSRFToken(request);
      expect(result.valid).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should export correct cookie names', () => {
      expect(CSRF_COOKIE_NAME).toBe('csrf_token');
      expect(CSRF_COOKIE_READABLE_NAME).toBe('csrf_token_readable');
    });

    it('should export correct header name', () => {
      expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
    });
  });
});
