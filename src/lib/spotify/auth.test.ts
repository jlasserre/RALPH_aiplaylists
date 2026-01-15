/**
 * Tests for PKCE utility functions
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomState,
} from './auth';

describe('generateCodeVerifier', () => {
  it('generates a string of default length (64 characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(64);
  });

  it('generates a string of specified length', () => {
    const verifier = generateCodeVerifier(43);
    expect(verifier).toHaveLength(43);

    const verifier2 = generateCodeVerifier(128);
    expect(verifier2).toHaveLength(128);
  });

  it('throws error for length less than 43', () => {
    expect(() => generateCodeVerifier(42)).toThrow(
      'Code verifier length must be between 43 and 128 characters'
    );
  });

  it('throws error for length greater than 128', () => {
    expect(() => generateCodeVerifier(129)).toThrow(
      'Code verifier length must be between 43 and 128 characters'
    );
  });

  it('generates URL-safe characters only', () => {
    const verifier = generateCodeVerifier();
    // URL-safe base64: alphanumeric, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call', () => {
    const verifier1 = generateCodeVerifier();
    const verifier2 = generateCodeVerifier();
    expect(verifier1).not.toBe(verifier2);
  });
});

describe('generateCodeChallenge', () => {
  it('generates a base64url-encoded SHA-256 hash', async () => {
    const verifier = 'test_verifier_string_for_hashing_purposes_here';
    const challenge = await generateCodeChallenge(verifier);

    // Should be URL-safe base64
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates consistent output for same input', async () => {
    const verifier = 'consistent_test_verifier_value_12345678901234567890';
    const challenge1 = await generateCodeChallenge(verifier);
    const challenge2 = await generateCodeChallenge(verifier);

    expect(challenge1).toBe(challenge2);
  });

  it('generates different output for different inputs', async () => {
    const challenge1 = await generateCodeChallenge('verifier_one_1234567890123456789012345678901');
    const challenge2 = await generateCodeChallenge('verifier_two_1234567890123456789012345678901');

    expect(challenge1).not.toBe(challenge2);
  });

  it('produces a 43-character output for SHA-256 (256 bits = 43 base64url chars)', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // SHA-256 produces 32 bytes = 256 bits
    // Base64 encoding: 32 * 8 / 6 = 42.67, rounded up = 43 characters (without padding)
    expect(challenge).toHaveLength(43);
  });

  it('generates verifiable challenge from known test vector', async () => {
    // Test vector: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // This is from the RFC 7636 appendix B example
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await generateCodeChallenge(verifier);

    // The expected challenge for this verifier (SHA-256 hash, base64url encoded)
    // Pre-computed expected value
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('generateRandomState', () => {
  it('generates a string of default length (32 characters)', () => {
    const state = generateRandomState();
    expect(state).toHaveLength(32);
  });

  it('generates a string of specified length', () => {
    const state = generateRandomState(16);
    expect(state).toHaveLength(16);

    const state2 = generateRandomState(64);
    expect(state2).toHaveLength(64);
  });

  it('generates URL-safe characters only', () => {
    const state = generateRandomState();
    // URL-safe base64: alphanumeric, -, _
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call', () => {
    const state1 = generateRandomState();
    const state2 = generateRandomState();
    expect(state1).not.toBe(state2);
  });
});
