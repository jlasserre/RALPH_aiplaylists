/**
 * Tests for SpotifyClient
 */

import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from './api';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SpotifyClient', () => {
  let client: SpotifyClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SpotifyClient('test-access-token');
  });

  describe('constructor', () => {
    it('should create client with access token', () => {
      const spotifyClient = new SpotifyClient('my-token');
      expect(spotifyClient).toBeInstanceOf(SpotifyClient);
    });

    it('should throw error when access token is empty', () => {
      expect(() => new SpotifyClient('')).toThrow('Access token is required');
    });
  });

  describe('fetch wrapper', () => {
    it('should add Authorization header to requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      });

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return JSON response data', async () => {
      const mockData = { id: '123', name: 'Test' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await client.get('/me');

      expect(result).toEqual(mockData);
    });

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('No content');
        },
      });

      const result = await client.delete('/test');

      expect(result).toEqual({});
    });
  });

  describe('HTTP methods', () => {
    describe('get', () => {
      it('should make GET request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ result: 'data' }),
        });

        await client.get('/endpoint');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.spotify.com/v1/endpoint',
          expect.objectContaining({ method: 'GET' })
        );
      });
    });

    describe('post', () => {
      it('should make POST request with body', async () => {
        const body = { name: 'Test Playlist' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: '123' }),
        });

        await client.post('/users/me/playlists', body);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.spotify.com/v1/users/me/playlists',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(body),
          })
        );
      });

      it('should make POST request without body', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });

        await client.post('/endpoint');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.spotify.com/v1/endpoint',
          expect.objectContaining({
            method: 'POST',
            body: undefined,
          })
        );
      });
    });

    describe('put', () => {
      it('should make PUT request with body', async () => {
        const body = { uris: ['spotify:track:123'] };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });

        await client.put('/playlists/123/tracks', body);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.spotify.com/v1/playlists/123/tracks',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(body),
          })
        );
      });
    });

    describe('delete', () => {
      it('should make DELETE request with body', async () => {
        const body = { tracks: [{ uri: 'spotify:track:123' }] };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });

        await client.delete('/playlists/123/tracks', body);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.spotify.com/v1/playlists/123/tracks',
          expect.objectContaining({
            method: 'DELETE',
            body: JSON.stringify(body),
          })
        );
      });
    });
  });

  describe('error handling', () => {
    describe('401 Authentication error', () => {
      it('should throw SpotifyAuthError on 401 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'The access token expired' },
          }),
        });

        await expect(client.get('/me')).rejects.toThrow(SpotifyAuthError);
      });

      it('should include default message in SpotifyAuthError', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers(),
          json: async () => ({}),
        });

        try {
          await client.get('/me');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAuthError);
          expect((error as SpotifyAuthError).message).toContain(
            'Authentication required'
          );
        }
      });
    });

    describe('429 Rate limit error', () => {
      it('should throw SpotifyRateLimitError on 429 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({
            'Retry-After': '30',
          }),
          json: async () => ({
            error: { message: 'Rate limit exceeded' },
          }),
        });

        await expect(client.get('/search')).rejects.toThrow(
          SpotifyRateLimitError
        );
      });

      it('should include Retry-After value in SpotifyRateLimitError', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({
            'Retry-After': '45',
          }),
          json: async () => ({}),
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyRateLimitError);
          expect((error as SpotifyRateLimitError).retryAfter).toBe(45);
        }
      });

      it('should handle missing Retry-After header', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(),
          json: async () => ({}),
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyRateLimitError);
          expect((error as SpotifyRateLimitError).retryAfter).toBeNull();
        }
      });
    });

    describe('Server errors (5xx)', () => {
      it('should throw SpotifyAPIError with isRetryable=true on 500', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Internal server error' },
          }),
        });

        try {
          await client.get('/me');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAPIError);
          expect((error as SpotifyAPIError).statusCode).toBe(500);
          expect((error as SpotifyAPIError).isRetryable).toBe(true);
        }
      });

      it('should throw SpotifyAPIError with isRetryable=true on 503', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Service unavailable' },
          }),
        });

        try {
          await client.get('/me');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAPIError);
          expect((error as SpotifyAPIError).statusCode).toBe(503);
          expect((error as SpotifyAPIError).isRetryable).toBe(true);
        }
      });
    });

    describe('Client errors (4xx)', () => {
      it('should throw SpotifyAPIError with isRetryable=false on 400', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Bad request' },
          }),
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAPIError);
          expect((error as SpotifyAPIError).statusCode).toBe(400);
          expect((error as SpotifyAPIError).isRetryable).toBe(false);
        }
      });

      it('should throw SpotifyAPIError with isRetryable=false on 404', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Resource not found' },
          }),
        });

        try {
          await client.get('/playlists/invalid');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAPIError);
          expect((error as SpotifyAPIError).statusCode).toBe(404);
          expect((error as SpotifyAPIError).isRetryable).toBe(false);
        }
      });

      it('should throw SpotifyAPIError with isRetryable=false on 403', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Forbidden' },
          }),
        });

        try {
          await client.get('/playlists/readonly');
        } catch (error) {
          expect(error).toBeInstanceOf(SpotifyAPIError);
          expect((error as SpotifyAPIError).statusCode).toBe(403);
          expect((error as SpotifyAPIError).isRetryable).toBe(false);
        }
      });
    });

    describe('Error message extraction', () => {
      it('should extract error message from error.message field', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({
            error: { message: 'Invalid track ID' },
          }),
        });

        try {
          await client.get('/tracks/invalid');
        } catch (error) {
          expect((error as SpotifyAPIError).message).toBe('Invalid track ID');
        }
      });

      it('should extract error message from top-level message field', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({
            message: 'Invalid request',
          }),
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect((error as SpotifyAPIError).message).toBe('Invalid request');
        }
      });

      it('should use default message when JSON parsing fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect((error as SpotifyAPIError).message).toBe(
            'Spotify API error: 400'
          );
        }
      });

      it('should use default message when response has no message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({}),
        });

        try {
          await client.get('/search');
        } catch (error) {
          expect((error as SpotifyAPIError).message).toBe(
            'Spotify API error: 400'
          );
        }
      });
    });
  });
});

describe('SpotifyAuthError', () => {
  it('should create error with default message', () => {
    const error = new SpotifyAuthError();

    expect(error.message).toContain('Authentication required');
    expect(error.name).toBe('SpotifyAuthError');
  });

  it('should create error with custom message', () => {
    const error = new SpotifyAuthError('Token expired');

    expect(error.message).toBe('Token expired');
  });
});

describe('SpotifyRateLimitError', () => {
  it('should create error with default message', () => {
    const error = new SpotifyRateLimitError();

    expect(error.message).toContain('Rate limit exceeded');
    expect(error.name).toBe('SpotifyRateLimitError');
    expect(error.retryAfter).toBeNull();
  });

  it('should create error with custom message and retryAfter', () => {
    const error = new SpotifyRateLimitError('Too many requests', 60);

    expect(error.message).toBe('Too many requests');
    expect(error.retryAfter).toBe(60);
  });
});

describe('SpotifyAPIError', () => {
  it('should create error with required properties', () => {
    const error = new SpotifyAPIError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('SpotifyAPIError');
    expect(error.statusCode).toBe(400);
    expect(error.isRetryable).toBe(false);
  });

  it('should create error with isRetryable flag', () => {
    const error = new SpotifyAPIError('Server error', 500, true);

    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(true);
  });
});
