/**
 * Spotify API client for making authenticated requests
 * Handles track search, playlist management, and recommendations
 */

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
}
