/**
 * Spotify API client for making authenticated requests
 * Handles track search, playlist management, and recommendations
 */

import type { SpotifyTrack } from '@/types';

/**
 * Spotify search response type
 */
interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
}

/**
 * Custom error class for Spotify authentication errors (401)
 */
export class SpotifyAuthError extends Error {
  constructor(message: string = 'Authentication required. Please log in again.') {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

/**
 * Custom error class for Spotify rate limiting errors (429)
 */
export class SpotifyRateLimitError extends Error {
  public readonly retryAfter: number | null;

  constructor(
    message: string = 'Rate limit exceeded. Please try again later.',
    retryAfter: number | null = null
  ) {
    super(message);
    this.name = 'SpotifyRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Custom error class for general Spotify API errors
 */
export class SpotifyAPIError extends Error {
  public readonly statusCode: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'SpotifyAPIError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

/**
 * Normalizes a string for fuzzy matching
 * - Converts to lowercase
 * - Removes accents and diacritics
 * - Removes special characters and punctuation
 * - Collapses multiple spaces
 * @param str - String to normalize
 * @returns Normalized string
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[''`]/g, '') // Remove apostrophes
    .replace(/[^\w\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Calculates Levenshtein distance between two strings
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance between strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity ratio between two strings (0 to 1)
 * @param a - First string
 * @param b - Second string
 * @returns Similarity ratio (1 = identical, 0 = completely different)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Checks if two strings match with fuzzy tolerance
 * @param query - Search query string
 * @param candidate - Candidate string to match against
 * @param threshold - Minimum similarity threshold (0-1, default 0.8)
 * @returns True if strings match within threshold
 */
export function fuzzyMatch(
  query: string,
  candidate: string,
  threshold: number = 0.8
): boolean {
  const normalizedQuery = normalizeString(query);
  const normalizedCandidate = normalizeString(candidate);

  // Exact match after normalization
  if (normalizedQuery === normalizedCandidate) return true;

  // Check if one contains the other
  if (
    normalizedCandidate.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCandidate)
  ) {
    return true;
  }

  // Calculate similarity and check against threshold
  return calculateSimilarity(normalizedQuery, normalizedCandidate) >= threshold;
}

/**
 * Client for interacting with the Spotify Web API
 */
export class SpotifyClient {
  private accessToken: string;

  /**
   * Creates a new SpotifyClient instance
   * @param accessToken - Spotify access token for authentication
   */
  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    this.accessToken = accessToken;
  }

  /**
   * Makes an authenticated request to the Spotify API
   * @param endpoint - API endpoint (without base URL)
   * @param options - Fetch options
   * @returns Response data as JSON
   * @throws SpotifyAuthError on 401 responses
   * @throws SpotifyRateLimitError on 429 responses
   * @throws SpotifyAPIError on other error responses
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${SPOTIFY_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle error responses
    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // Handle empty responses (e.g., DELETE requests)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Handles error responses from the Spotify API
   * @param response - Fetch response object
   * @throws SpotifyAuthError on 401 responses
   * @throws SpotifyRateLimitError on 429 responses
   * @throws SpotifyAPIError on other error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const statusCode = response.status;

    // Authentication error - token expired or invalid
    if (statusCode === 401) {
      throw new SpotifyAuthError();
    }

    // Rate limiting
    if (statusCode === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
      throw new SpotifyRateLimitError(
        'Rate limit exceeded. Please try again later.',
        retryAfter
      );
    }

    // Try to get error message from response body
    let errorMessage: string;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody.error?.message ||
        errorBody.message ||
        `Spotify API error: ${statusCode}`;
    } catch {
      errorMessage = `Spotify API error: ${statusCode}`;
    }

    // Server errors are retryable
    const isRetryable = statusCode >= 500;

    throw new SpotifyAPIError(errorMessage, statusCode, isRetryable);
  }

  /**
   * Makes a GET request to the Spotify API
   * @param endpoint - API endpoint
   * @returns Response data
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.fetch<T>(endpoint, { method: 'GET' });
  }

  /**
   * Makes a POST request to the Spotify API
   * @param endpoint - API endpoint
   * @param body - Request body
   * @returns Response data
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Makes a PUT request to the Spotify API
   * @param endpoint - API endpoint
   * @param body - Request body
   * @returns Response data
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Makes a DELETE request to the Spotify API
   * @param endpoint - API endpoint
   * @param body - Request body
   * @returns Response data
   */
  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Searches for a track on Spotify by title and artist
   * Uses fuzzy matching to handle slight variations in title/artist names
   * @param title - Track title
   * @param artist - Artist name
   * @returns SpotifyTrack if found, null otherwise
   */
  async searchTrack(title: string, artist: string): Promise<SpotifyTrack | null> {
    // Build search query using Spotify's query syntax
    const query = `track:${title} artist:${artist}`;
    const encodedQuery = encodeURIComponent(query);

    const response = await this.get<SpotifySearchResponse>(
      `/search?q=${encodedQuery}&type=track&limit=10`
    );

    const tracks = response.tracks?.items || [];

    if (tracks.length === 0) {
      return null;
    }

    // Find the best match using fuzzy matching
    for (const track of tracks) {
      const titleMatch = fuzzyMatch(title, track.name);
      const artistMatch = track.artists.some((a) =>
        fuzzyMatch(artist, a.name)
      );

      if (titleMatch && artistMatch) {
        return track;
      }
    }

    // No match found with fuzzy matching - return null
    return null;
  }
}
