/**
 * CSRF protection utilities for write endpoints
 *
 * Uses a double-submit cookie pattern where:
 * 1. A CSRF token is generated on auth and stored in an httpOnly cookie
 * 2. The client reads the token from a separate non-httpOnly cookie
 * 3. The client sends the token in request headers
 * 4. The server validates the header token against the cookie token
 */

import { cookies } from 'next/headers';

/**
 * Cookie name for the httpOnly CSRF token (server-side validation)
 */
export const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Cookie name for the readable CSRF token (client-side access)
 * This cookie is NOT httpOnly so JavaScript can read it
 */
export const CSRF_COOKIE_READABLE_NAME = 'csrf_token_readable';

/**
 * Header name for the CSRF token sent by the client
 */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure random token
 */
export function generateCSRFToken(): string {
  // Generate 32 random bytes and convert to base64url
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Set CSRF token cookies on a response
 * Call this after successful OAuth authentication
 *
 * @param token The CSRF token to set
 * @param response The response object to set cookies on
 */
export function setCSRFCookies(
  token: string,
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }
): void {
  const cookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days (same as refresh token)
  };

  // Set httpOnly cookie for server-side validation
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    ...cookieOptions,
    httpOnly: true,
  });

  // Set readable cookie for client-side access
  response.cookies.set(CSRF_COOKIE_READABLE_NAME, token, {
    ...cookieOptions,
    httpOnly: false,
  });
}

/**
 * Clear CSRF token cookies
 * Call this on logout or when clearing auth
 */
export function clearCSRFCookies(
  response: { cookies: { delete: (name: string) => void } }
): void {
  response.cookies.delete(CSRF_COOKIE_NAME);
  response.cookies.delete(CSRF_COOKIE_READABLE_NAME);
}

/**
 * Validate the CSRF token from request headers against the cookie
 *
 * @param request The incoming request
 * @returns Object with success boolean and error message if failed
 */
export async function validateCSRFToken(
  request: Request
): Promise<{ valid: boolean; error?: string }> {
  // Get the token from the header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF token header' };
  }

  // Get the token from the cookie
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF token cookie' };
  }

  // Compare tokens using timing-safe comparison
  if (!timingSafeEqual(headerToken, cookieToken)) {
    return { valid: false, error: 'Invalid CSRF token' };
  }

  return { valid: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Compares two strings in constant time
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Get the CSRF token from cookies (for use in API routes that need to return it)
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null;
}
