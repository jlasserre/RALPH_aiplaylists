/**
 * Spotify API client for making authenticated requests
 * Handles track search, playlist management, and recommendations
 */

import type { SpotifyTrack, UserPlaylist } from '@/types';
import {
  type BackoffConfig,
  DEFAULT_BACKOFF_CONFIG,
  getBackoffResult,
  delay,
} from './backoff';

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
 * Spotify playlist item from /me/playlists response
 */
interface SpotifyPlaylistItem {
  id: string;
  name: string;
  owner: {
    id: string;
    display_name: string | null;
  };
  images: Array<{ url: string; width: number | null; height: number | null }>;
  tracks: {
    total: number;
  };
}

/**
 * Spotify playlists response type (paginated)
 */
interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylistItem[];
  total: number;
  next: string | null;
  previous: string | null;
  offset: number;
  limit: number;
}

/**
 * Spotify playlist track item from /playlists/{id}/tracks response
 */
interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack | null;
  added_at: string | null;
  added_by: {
    id: string;
  } | null;
}

/**
 * Spotify playlist tracks response type (paginated)
 */
interface SpotifyPlaylistTracksResponse {
  items: SpotifyPlaylistTrackItem[];
  total: number;
  next: string | null;
  previous: string | null;
  offset: number;
  limit: number;
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
 * Options for SpotifyClient configuration
 */
export interface SpotifyClientOptions {
  /** Configuration for exponential backoff retry logic */
  backoff?: BackoffConfig;
  /** Whether to enable automatic retries for rate limiting and server errors (default: true) */
  enableRetries?: boolean;
}

/**
 * Client for interacting with the Spotify Web API
 */
export class SpotifyClient {
  private accessToken: string;
  private backoffConfig: BackoffConfig;
  private enableRetries: boolean;

  /**
   * Creates a new SpotifyClient instance
   * @param accessToken - Spotify access token for authentication
   * @param options - Client configuration options
   */
  constructor(accessToken: string, options: SpotifyClientOptions = {}) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    this.accessToken = accessToken;
    this.backoffConfig = options.backoff ?? DEFAULT_BACKOFF_CONFIG;
    this.enableRetries = options.enableRetries ?? true;
  }

  /**
   * Makes an authenticated request to the Spotify API with exponential backoff retry
   * @param endpoint - API endpoint (without base URL)
   * @param options - Fetch options
   * @returns Response data as JSON
   * @throws SpotifyAuthError on 401 responses
   * @throws SpotifyRateLimitError on 429 responses (after retries exhausted)
   * @throws SpotifyAPIError on other error responses (5xx retried, 4xx not retried)
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${SPOTIFY_API_BASE_URL}${endpoint}`;

    let lastStatusCode: number | undefined;
    let lastRetryAfter: number | null = null;
    let attempt = 1;
    const maxAttempts = this.enableRetries ? (this.backoffConfig.maxRetries ?? DEFAULT_BACKOFF_CONFIG.maxRetries) + 1 : 1;

    while (attempt <= maxAttempts) {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle successful responses
      if (response.ok) {
        // Handle empty responses (e.g., DELETE requests)
        if (response.status === 204) {
          return {} as T;
        }
        return response.json();
      }

      // Check if we should retry
      const statusCode = response.status;
      const retryAfter = this.extractRetryAfter(response);

      // Store for potential error creation after loop
      lastStatusCode = statusCode;
      lastRetryAfter = retryAfter;

      // For auth errors, don't retry - throw immediately
      if (statusCode === 401) {
        throw new SpotifyAuthError();
      }

      // Determine if this error is retryable
      const isRetryableStatus = statusCode === 429 || statusCode >= 500;
      const backoffResult = getBackoffResult(
        attempt,
        statusCode,
        retryAfter,
        this.backoffConfig
      );

      // If not retryable status or retries disabled or exhausted, throw immediately
      if (!this.enableRetries || !isRetryableStatus || !backoffResult.shouldRetry) {
        await this.handleErrorResponse(response);
      }

      // Wait before retrying
      await delay(backoffResult.delayMs);
      attempt++;
    }

    // All retries exhausted, throw the appropriate error
    if (lastStatusCode === 429) {
      throw new SpotifyRateLimitError(
        'Rate limit exceeded. Please try again later.',
        lastRetryAfter
      );
    }

    throw new SpotifyAPIError(
      `Spotify API error: ${lastStatusCode} (after ${maxAttempts} attempts)`,
      lastStatusCode ?? 500,
      true
    );
  }

  /**
   * Extracts Retry-After header value in seconds
   * @param response - Fetch response
   * @returns Retry-After value in seconds or null
   */
  private extractRetryAfter(response: Response): number | null {
    const retryAfterHeader = response.headers.get('Retry-After');
    if (retryAfterHeader) {
      const value = parseInt(retryAfterHeader, 10);
      return isNaN(value) ? null : value;
    }
    return null;
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

  /**
   * Gets the current user's Spotify profile
   * @returns User profile with id
   */
  async getCurrentUser(): Promise<{ id: string }> {
    return this.get<{ id: string }>('/me');
  }

  /**
   * Creates a new playlist for the current user
   * @param userId - Spotify user ID
   * @param name - Playlist name
   * @param description - Optional playlist description
   * @param isPublic - Whether the playlist is public (default false)
   * @returns Created playlist with id and external_urls
   */
  async createPlaylist(
    userId: string,
    name: string,
    description?: string,
    isPublic: boolean = false
  ): Promise<{ id: string; external_urls: { spotify: string } }> {
    return this.post(`/users/${userId}/playlists`, {
      name,
      description,
      public: isPublic,
    });
  }

  /**
   * Adds tracks to a playlist
   * @param playlistId - Spotify playlist ID
   * @param trackUris - Array of Spotify track URIs to add
   * @returns Snapshot ID of the updated playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[]
  ): Promise<{ snapshot_id: string }> {
    // Spotify API allows max 100 tracks per request
    if (trackUris.length > 100) {
      throw new SpotifyAPIError(
        'Cannot add more than 100 tracks at once',
        400,
        false
      );
    }
    return this.post(`/playlists/${playlistId}/tracks`, {
      uris: trackUris,
    });
  }

  /**
   * Removes tracks from a playlist
   * @param playlistId - Spotify playlist ID
   * @param trackUris - Array of Spotify track URIs to remove
   * @returns Snapshot ID of the updated playlist
   */
  async removeTracksFromPlaylist(
    playlistId: string,
    trackUris: string[]
  ): Promise<{ snapshot_id: string }> {
    // Spotify API allows max 100 tracks per request
    if (trackUris.length > 100) {
      throw new SpotifyAPIError(
        'Cannot remove more than 100 tracks at once',
        400,
        false
      );
    }
    return this.delete(`/playlists/${playlistId}/tracks`, {
      tracks: trackUris.map((uri) => ({ uri })),
    });
  }

  /**
   * Gets track recommendations based on a seed track
   * Uses the Spotify Recommendations API to find similar tracks
   * @param seedTrackId - Spotify track ID to use as seed
   * @param limit - Maximum number of recommendations to return (1-100, default 20)
   * @returns Array of recommended SpotifyTrack objects
   */
  async getRecommendations(
    seedTrackId: string,
    limit: number = 20
  ): Promise<SpotifyTrack[]> {
    // Validate limit is within Spotify's allowed range
    const clampedLimit = Math.min(Math.max(1, limit), 100);

    const response = await this.get<{ tracks: SpotifyTrack[] }>(
      `/recommendations?seed_tracks=${encodeURIComponent(seedTrackId)}&limit=${clampedLimit}`
    );

    return response.tracks || [];
  }

  /**
   * Gets the current user's playlists
   * Fetches from /v1/me/playlists endpoint with pagination support
   * @param limit - Maximum playlists to fetch (default 50, will paginate if more are needed)
   * @returns Array of UserPlaylist objects with isOwned flag
   */
  async getUserPlaylists(limit: number = 50): Promise<UserPlaylist[]> {
    // Clamp limit to valid range (minimum 1)
    const maxToFetch = Math.max(1, limit);

    // Get current user ID for determining ownership
    const currentUser = await this.getCurrentUser();
    const currentUserId = currentUser.id;

    // Spotify allows max 50 per request, use page size up to 50 or the requested limit
    const pageSize = Math.min(maxToFetch, 50);
    const playlists: UserPlaylist[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && playlists.length < maxToFetch) {
      const response = await this.get<SpotifyPlaylistsResponse>(
        `/me/playlists?limit=${pageSize}&offset=${offset}`
      );

      const items = response.items || [];

      for (const item of items) {
        if (playlists.length >= maxToFetch) break;

        playlists.push({
          id: item.id,
          name: item.name,
          owner: {
            id: item.owner.id,
            display_name: item.owner.display_name,
          },
          isOwned: item.owner.id === currentUserId,
          images: item.images || [],
          tracks: {
            total: item.tracks?.total || 0,
          },
        });
      }

      // Check if there are more pages
      hasMore = response.next !== null && items.length === pageSize;
      offset += pageSize;
    }

    return playlists;
  }

  /**
   * Gets tracks from a playlist
   * Fetches from /v1/playlists/{id}/tracks endpoint with pagination support
   * @param playlistId - Spotify playlist ID
   * @param limit - Maximum tracks to fetch (default 100, will paginate if more are needed)
   * @returns Array of SpotifyTrack objects (excludes null/deleted tracks)
   */
  async getPlaylistTracks(
    playlistId: string,
    limit: number = 100
  ): Promise<SpotifyTrack[]> {
    // Clamp limit to valid range (minimum 1)
    const maxToFetch = Math.max(1, limit);

    // Spotify allows max 100 per request
    const pageSize = Math.min(maxToFetch, 100);
    const tracks: SpotifyTrack[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && tracks.length < maxToFetch) {
      const response = await this.get<SpotifyPlaylistTracksResponse>(
        `/playlists/${playlistId}/tracks?limit=${pageSize}&offset=${offset}`
      );

      const items = response.items || [];

      for (const item of items) {
        if (tracks.length >= maxToFetch) break;

        // Skip null tracks (deleted/unavailable tracks)
        if (item.track) {
          tracks.push(item.track);
        }
      }

      // Check if there are more pages
      hasMore = response.next !== null && items.length === pageSize;
      offset += pageSize;
    }

    return tracks;
  }
}
