/**
 * Rate limiting utility for API routes
 * Uses in-memory store with sliding window algorithm
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  maxTokens: number;      // Maximum requests allowed in the window
  windowMs: number;       // Time window in milliseconds
  identifier: string;     // Unique identifier for the rate limit (e.g., IP address, session ID)
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;        // Unix timestamp when the limit resets
  retryAfter?: number;    // Seconds until retry is allowed (only if limited)
}

// In-memory store for rate limit entries
// Key format: `${prefix}:${identifier}`
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries(maxAge: number = 10 * 60 * 1000): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;
  const cutoff = now - maxAge;

  for (const [key, entry] of store.entries()) {
    if (entry.lastRefill < cutoff) {
      store.delete(key);
    }
  }
}

/**
 * Check and consume a rate limit token
 * Uses token bucket algorithm with refill
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const { maxTokens, windowMs, identifier } = options;
  const now = Date.now();

  // Cleanup old entries periodically
  cleanupOldEntries(windowMs * 2);

  let entry = store.get(identifier);

  if (!entry) {
    // First request - create new entry with full tokens minus one
    entry = {
      tokens: maxTokens - 1,
      lastRefill: now,
    };
    store.set(identifier, entry);

    return {
      success: true,
      remaining: entry.tokens,
      resetAt: now + windowMs,
    };
  }

  // Calculate token refill based on time passed
  const timePassed = now - entry.lastRefill;
  const refillRate = maxTokens / windowMs; // tokens per ms
  const tokensToAdd = timePassed * refillRate;

  // Refill tokens (capped at max)
  entry.tokens = Math.min(maxTokens, entry.tokens + tokensToAdd);
  entry.lastRefill = now;

  // Check if we have tokens available
  if (entry.tokens < 1) {
    // Rate limited
    const resetAt = now + windowMs;
    const retryAfter = Math.ceil((1 - entry.tokens) / refillRate / 1000);

    return {
      success: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, retryAfter),
    };
  }

  // Consume a token
  entry.tokens -= 1;
  store.set(identifier, entry);

  return {
    success: true,
    remaining: Math.floor(entry.tokens),
    resetAt: now + windowMs,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // LLM generation - more restrictive (10 req/min per session)
  generate: {
    maxTokens: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // General API - less restrictive (100 req/min per IP)
  general: {
    maxTokens: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Get client IP from request headers
 * Handles common proxy headers
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Get session ID from cookies or generate one
 */
export function getSessionID(request: Request): string {
  const cookies = request.headers.get('cookie');
  if (cookies) {
    // Look for a session identifier in cookies
    const sessionMatch = cookies.match(/(?:^|;\s*)session_id=([^;]+)/);
    if (sessionMatch) {
      return sessionMatch[1];
    }

    // Fall back to access_token cookie as session identifier
    const tokenMatch = cookies.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1].substring(0, 32); // Use first 32 chars as identifier
    }
  }

  // If no session, use IP + User-Agent hash as identifier
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a Response with 429 status if rate limited
 */
export function applyRateLimit(
  request: Request,
  config: { maxTokens: number; windowMs: number },
  prefix: string
): { success: boolean; response?: Response; remaining: number; resetAt: number } {
  const identifier = prefix === 'generate'
    ? `${prefix}:${getSessionID(request)}`
    : `${prefix}:${getClientIP(request)}`;

  const result = checkRateLimit({
    ...config,
    identifier,
  });

  if (!result.success) {
    const response = new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': String(config.maxTokens),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
        },
      }
    );

    return { success: false, response, remaining: 0, resetAt: result.resetAt };
  }

  return { success: true, remaining: result.remaining, resetAt: result.resetAt };
}

/**
 * Clear the rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Get current store size (for testing/monitoring)
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}
