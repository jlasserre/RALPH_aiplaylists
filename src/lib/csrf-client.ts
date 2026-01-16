/**
 * Client-side CSRF utilities
 *
 * Provides helpers for reading the CSRF token from cookies
 * and including it in fetch requests to protected endpoints.
 */

/**
 * Cookie name for the readable CSRF token (must match server-side)
 */
const CSRF_COOKIE_READABLE_NAME = 'csrf_token_readable';

/**
 * Header name for the CSRF token (must match server-side)
 */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Read the CSRF token from the readable cookie
 * Returns null if the cookie is not found
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    // Server-side rendering - no cookies available
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_READABLE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create headers object with CSRF token included
 * Use this when making fetch requests to protected endpoints
 *
 * @param additionalHeaders Optional additional headers to include
 * @returns Headers object with CSRF token and any additional headers
 */
export function createHeadersWithCSRF(
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    ...additionalHeaders,
  };

  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  return headers;
}

/**
 * Wrapper for fetch that automatically includes the CSRF token
 * Use this for POST/PUT/DELETE requests to protected endpoints
 *
 * @param url The URL to fetch
 * @param options Fetch options (method, body, etc.)
 * @returns Promise resolving to the fetch Response
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCSRFToken();

  const headers = new Headers(options.headers);
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
