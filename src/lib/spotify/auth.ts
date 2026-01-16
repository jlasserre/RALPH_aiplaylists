/**
 * PKCE (Proof Key for Code Exchange) utilities for Spotify OAuth
 *
 * Implements RFC 7636 for secure OAuth authorization code flow.
 * Used to generate code verifier, code challenge, and state for CSRF protection.
 */

/**
 * Generates a cryptographically random code verifier for PKCE.
 * The verifier is a high-entropy random string between 43-128 characters.
 *
 * @param length - Length of the verifier (default: 64, min: 43, max: 128)
 * @returns A URL-safe random string
 */
export function generateCodeVerifier(length: number = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters');
  }

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Convert to URL-safe base64 (RFC 4648 Section 5)
  return base64UrlEncode(array).slice(0, length);
}

/**
 * Generates a code challenge from the code verifier using SHA-256.
 * The challenge is the base64url-encoded SHA-256 hash of the verifier.
 *
 * @param verifier - The code verifier string
 * @returns A promise that resolves to the base64url-encoded challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Generates a random state string for CSRF protection.
 * Used to verify that OAuth callbacks match initiated requests.
 *
 * @param length - Length of the state string (default: 32)
 * @returns A URL-safe random string
 */
export function generateRandomState(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return base64UrlEncode(array).slice(0, length);
}

/**
 * Encodes a Uint8Array to a URL-safe base64 string.
 * Replaces '+' with '-', '/' with '_', and removes '=' padding.
 *
 * @param buffer - The buffer to encode
 * @returns A URL-safe base64 string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert Uint8Array to binary string
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  // Encode to base64 and make URL-safe
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
