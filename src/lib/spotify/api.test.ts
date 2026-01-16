/**
 * Tests for SpotifyClient
 */

import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
  normalizeString,
  levenshteinDistance,
  calculateSimilarity,
  fuzzyMatch,
} from './api';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SpotifyClient', () => {
  let client: SpotifyClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Disable retries for basic tests to preserve original behavior
    client = new SpotifyClient('test-access-token', { enableRetries: false });
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

describe('normalizeString', () => {
  it('should convert to lowercase', () => {
    expect(normalizeString('Hello World')).toBe('hello world');
  });

  it('should remove accents and diacritics', () => {
    expect(normalizeString('café')).toBe('cafe');
    expect(normalizeString('naïve')).toBe('naive');
    expect(normalizeString('résumé')).toBe('resume');
    expect(normalizeString('José González')).toBe('jose gonzalez');
  });

  it('should remove apostrophes', () => {
    expect(normalizeString("don't")).toBe('dont');
    expect(normalizeString("rock 'n' roll")).toBe('rock n roll');
    expect(normalizeString("it's")).toBe('its');
  });

  it('should remove special characters', () => {
    expect(normalizeString('Hello, World!')).toBe('hello world');
    expect(normalizeString('test@#$%')).toBe('test');
    expect(normalizeString('song - remix')).toBe('song remix');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeString('hello   world')).toBe('hello world');
    expect(normalizeString('  leading  trailing  ')).toBe('leading trailing');
  });

  it('should handle empty string', () => {
    expect(normalizeString('')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('should return length of string when comparing with empty string', () => {
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', 'world')).toBe(5);
  });

  it('should return 1 for single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
    expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
    expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
  });

  it('should calculate correct distance for different strings', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });
});

describe('calculateSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(1);
  });

  it('should return 0 when one string is empty', () => {
    expect(calculateSimilarity('hello', '')).toBe(0);
    expect(calculateSimilarity('', 'world')).toBe(0);
  });

  it('should return high similarity for similar strings', () => {
    const similarity = calculateSimilarity('hello', 'helo');
    expect(similarity).toBeGreaterThan(0.7);
  });

  it('should return low similarity for different strings', () => {
    const similarity = calculateSimilarity('abc', 'xyz');
    expect(similarity).toBe(0);
  });
});

describe('fuzzyMatch', () => {
  it('should match identical strings', () => {
    expect(fuzzyMatch('Bohemian Rhapsody', 'Bohemian Rhapsody')).toBe(true);
  });

  it('should match after normalization (case insensitive)', () => {
    expect(fuzzyMatch('bohemian rhapsody', 'BOHEMIAN RHAPSODY')).toBe(true);
  });

  it('should match strings with accents removed', () => {
    expect(fuzzyMatch('Jose Gonzalez', 'José González')).toBe(true);
  });

  it('should match strings with minor typos', () => {
    expect(fuzzyMatch('Billie Eilish', 'Billie Eilsh')).toBe(true);
  });

  it('should match when candidate contains query', () => {
    expect(fuzzyMatch('Dream', 'Dream On')).toBe(true);
    expect(fuzzyMatch('Hello', 'Hello, World')).toBe(true);
  });

  it('should match when query contains candidate', () => {
    expect(fuzzyMatch('Bohemian Rhapsody - Remastered', 'Bohemian Rhapsody')).toBe(
      true
    );
  });

  it('should not match completely different strings', () => {
    expect(fuzzyMatch('Hello', 'Goodbye')).toBe(false);
    expect(fuzzyMatch('Queen', 'Beatles')).toBe(false);
  });

  it('should respect custom threshold', () => {
    // "hello" and "hallo" have similarity ~0.8 (1 char difference out of 5)
    // With 0.5 threshold, they should match
    expect(fuzzyMatch('hello', 'hallo', 0.5)).toBe(true);
    // With 0.95 threshold, they shouldn't match
    expect(fuzzyMatch('hello', 'hallo', 0.95)).toBe(false);
  });

  it('should match song titles with punctuation differences', () => {
    expect(fuzzyMatch("Don't Stop Believin'", 'Dont Stop Believin')).toBe(true);
    expect(
      fuzzyMatch('Sweet Child O Mine', "Sweet Child O' Mine")
    ).toBe(true);
  });
});

describe('SpotifyClient.searchTrack', () => {
  let client: SpotifyClient;

  const mockSpotifyTrack = {
    id: 'track123',
    uri: 'spotify:track:track123',
    name: 'Bohemian Rhapsody',
    artists: [{ id: 'artist1', name: 'Queen' }],
    album: {
      id: 'album1',
      name: 'A Night at the Opera',
      images: [{ url: 'https://example.com/cover.jpg', width: 300, height: 300 }],
    },
    duration_ms: 354000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SpotifyClient('test-access-token', { enableRetries: false });
  });

  it('should find exact match', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [mockSpotifyTrack],
          total: 1,
        },
      }),
    });

    const result = await client.searchTrack('Bohemian Rhapsody', 'Queen');

    expect(result).toEqual(mockSpotifyTrack);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?q='),
      expect.any(Object)
    );
  });

  it('should use correct query format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [mockSpotifyTrack],
          total: 1,
        },
      }),
    });

    await client.searchTrack('Bohemian Rhapsody', 'Queen');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent('track:Bohemian Rhapsody artist:Queen')
      ),
      expect.any(Object)
    );
  });

  it('should return null when no tracks found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [],
          total: 0,
        },
      }),
    });

    const result = await client.searchTrack('NonExistent Song', 'Unknown Artist');

    expect(result).toBeNull();
  });

  it('should handle fuzzy title matching', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [
            {
              ...mockSpotifyTrack,
              name: "Don't Stop Believin'",
              artists: [{ id: 'artist2', name: 'Journey' }],
            },
          ],
          total: 1,
        },
      }),
    });

    // Query without apostrophes should match
    const result = await client.searchTrack('Dont Stop Believin', 'Journey');

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Don't Stop Believin'");
  });

  it('should handle fuzzy artist matching', async () => {
    const trackWithAccent = {
      ...mockSpotifyTrack,
      name: 'Heartbeats',
      artists: [{ id: 'artist3', name: 'José González' }],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [trackWithAccent],
          total: 1,
        },
      }),
    });

    // Query without accents should match
    const result = await client.searchTrack('Heartbeats', 'Jose Gonzalez');

    expect(result).not.toBeNull();
    expect(result?.artists[0].name).toBe('José González');
  });

  it('should match any artist in multi-artist track', async () => {
    const multiArtistTrack = {
      ...mockSpotifyTrack,
      name: 'Under Pressure',
      artists: [
        { id: 'artist1', name: 'Queen' },
        { id: 'artist4', name: 'David Bowie' },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [multiArtistTrack],
          total: 1,
        },
      }),
    });

    // Should match with second artist
    const result = await client.searchTrack('Under Pressure', 'David Bowie');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Under Pressure');
  });

  it('should return null when no fuzzy match found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [mockSpotifyTrack], // Bohemian Rhapsody by Queen
          total: 1,
        },
      }),
    });

    // Completely different song/artist
    const result = await client.searchTrack('Hello', 'Adele');

    expect(result).toBeNull();
  });

  it('should find first matching track from multiple results', async () => {
    const secondTrack = {
      ...mockSpotifyTrack,
      id: 'track456',
      name: 'We Will Rock You',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [secondTrack, mockSpotifyTrack],
          total: 2,
        },
      }),
    });

    const result = await client.searchTrack('Bohemian Rhapsody', 'Queen');

    // Should find the second track (Bohemian Rhapsody)
    expect(result?.id).toBe('track123');
    expect(result?.name).toBe('Bohemian Rhapsody');
  });

  it('should handle case insensitive matching', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [mockSpotifyTrack],
          total: 1,
        },
      }),
    });

    const result = await client.searchTrack('BOHEMIAN RHAPSODY', 'QUEEN');

    expect(result).not.toBeNull();
  });

  it('should propagate API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(
      client.searchTrack('Test Song', 'Test Artist')
    ).rejects.toThrow(SpotifyAuthError);
  });

  it('should handle empty tracks object in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: null,
      }),
    });

    const result = await client.searchTrack('Test Song', 'Test Artist');

    expect(result).toBeNull();
  });
});

describe('SpotifyClient.getRecommendations', () => {
  let client: SpotifyClient;

  const mockRecommendedTracks = [
    {
      id: 'rec1',
      uri: 'spotify:track:rec1',
      name: 'Somebody to Love',
      artists: [{ id: 'artist1', name: 'Queen' }],
      album: {
        id: 'album2',
        name: 'A Day at the Races',
        images: [{ url: 'https://example.com/cover2.jpg', width: 300, height: 300 }],
      },
      duration_ms: 295000,
    },
    {
      id: 'rec2',
      uri: 'spotify:track:rec2',
      name: 'We Are the Champions',
      artists: [{ id: 'artist1', name: 'Queen' }],
      album: {
        id: 'album3',
        name: 'News of the World',
        images: [{ url: 'https://example.com/cover3.jpg', width: 300, height: 300 }],
      },
      duration_ms: 179000,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SpotifyClient('test-access-token', { enableRetries: false });
  });

  it('should get recommendations for a seed track', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    const result = await client.getRecommendations('track123');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Somebody to Love');
    expect(result[1].name).toBe('We Are the Champions');
  });

  it('should call recommendations endpoint with correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/recommendations?seed_tracks=track123&limit=20',
      expect.any(Object)
    );
  });

  it('should use default limit of 20', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=20'),
      expect.any(Object)
    );
  });

  it('should use custom limit when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123', 10);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    );
  });

  it('should clamp limit to maximum of 100', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123', 150);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=100'),
      expect.any(Object)
    );
  });

  it('should clamp limit to minimum of 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123', 0);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=1'),
      expect.any(Object)
    );
  });

  it('should handle negative limit by clamping to 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track123', -5);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=1'),
      expect.any(Object)
    );
  });

  it('should return empty array when no recommendations found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: [],
      }),
    });

    const result = await client.getRecommendations('track123');

    expect(result).toEqual([]);
  });

  it('should return empty array when tracks is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: null,
      }),
    });

    const result = await client.getRecommendations('track123');

    expect(result).toEqual([]);
  });

  it('should return empty array when tracks is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await client.getRecommendations('track123');

    expect(result).toEqual([]);
  });

  it('should encode track ID in URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: mockRecommendedTracks,
      }),
    });

    await client.getRecommendations('track with spaces');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('seed_tracks=track%20with%20spaces'),
      expect.any(Object)
    );
  });

  it('should propagate authentication errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(client.getRecommendations('track123')).rejects.toThrow(
      SpotifyAuthError
    );
  });

  it('should propagate rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({
        'Retry-After': '30',
      }),
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    await expect(client.getRecommendations('track123')).rejects.toThrow(
      SpotifyRateLimitError
    );
  });

  it('should propagate API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Invalid track ID' } }),
    });

    await expect(client.getRecommendations('invalid-track')).rejects.toThrow(
      SpotifyAPIError
    );
  });
});

describe('SpotifyClient.getUserPlaylists', () => {
  let client: SpotifyClient;

  const mockCurrentUser = {
    id: 'user123',
  };

  const createMockPlaylist = (
    id: string,
    name: string,
    ownerId: string,
    ownerName: string | null = 'Test Owner'
  ) => ({
    id,
    name,
    owner: {
      id: ownerId,
      display_name: ownerName,
    },
    images: [{ url: `https://example.com/${id}.jpg`, width: 300, height: 300 }],
    tracks: {
      total: 10,
    },
  });

  beforeEach(() => {
    mockFetch.mockReset();
    client = new SpotifyClient('test-access-token', { enableRetries: false });
  });

  it('should fetch user playlists', async () => {
    // First call: getCurrentUser
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    // Second call: /me/playlists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          createMockPlaylist('playlist1', 'My Playlist', 'user123'),
          createMockPlaylist('playlist2', 'Followed Playlist', 'other-user'),
        ],
        total: 2,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    const result = await client.getUserPlaylists();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('playlist1');
    expect(result[0].name).toBe('My Playlist');
    expect(result[0].isOwned).toBe(true);
    expect(result[1].id).toBe('playlist2');
    expect(result[1].name).toBe('Followed Playlist');
    expect(result[1].isOwned).toBe(false);
  });

  it('should call correct endpoint with default limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    await client.getUserPlaylists();

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/playlists?limit=50&offset=0',
      expect.any(Object)
    );
  });

  it('should respect custom limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 10,
      }),
    });

    await client.getUserPlaylists(10);

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/playlists?limit=10&offset=0',
      expect.any(Object)
    );
  });

  it('should clamp limit to maximum of 50', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    await client.getUserPlaylists(100);

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/playlists?limit=50&offset=0',
      expect.any(Object)
    );
  });

  it('should clamp limit to minimum of 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 1,
      }),
    });

    await client.getUserPlaylists(0);

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/playlists?limit=1&offset=0',
      expect.any(Object)
    );
  });

  it('should handle pagination to fetch more playlists', async () => {
    // When limit > 50, we paginate. Test with limit=60 to get 2 pages of 50
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    // Create 50 playlists for first page
    const firstPageItems = Array.from({ length: 50 }, (_, i) =>
      createMockPlaylist(`playlist${i + 1}`, `Playlist ${i + 1}`, 'user123')
    );

    // First page - 50 playlists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: firstPageItems,
        total: 60,
        next: 'https://api.spotify.com/v1/me/playlists?offset=50&limit=50',
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    // Create 10 playlists for second page
    const secondPageItems = Array.from({ length: 10 }, (_, i) =>
      createMockPlaylist(`playlist${i + 51}`, `Playlist ${i + 51}`, 'user123')
    );

    // Second page - remaining 10 playlists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: secondPageItems,
        total: 60,
        next: null,
        previous: 'https://api.spotify.com/v1/me/playlists?offset=0&limit=50',
        offset: 50,
        limit: 50,
      }),
    });

    const result = await client.getUserPlaylists(60);

    expect(result).toHaveLength(60);
    expect(mockFetch).toHaveBeenCalledTimes(3); // getCurrentUser + 2 pages
    // First playlists call
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/playlists?limit=50&offset=0',
      expect.any(Object)
    );
    // Second playlists call
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://api.spotify.com/v1/me/playlists?limit=50&offset=50',
      expect.any(Object)
    );
  });

  it('should stop paginating when limit is reached', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    // First page with more items available
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          createMockPlaylist('playlist1', 'Playlist 1', 'user123'),
          createMockPlaylist('playlist2', 'Playlist 2', 'user123'),
          createMockPlaylist('playlist3', 'Playlist 3', 'user123'),
        ],
        total: 10,
        next: 'https://api.spotify.com/v1/me/playlists?offset=3',
        previous: null,
        offset: 0,
        limit: 3,
      }),
    });

    const result = await client.getUserPlaylists(2);

    // Should only return 2 playlists even though 3 were in the response
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2); // getCurrentUser + 1 page only
  });

  it('should return empty array when user has no playlists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    const result = await client.getUserPlaylists();

    expect(result).toEqual([]);
  });

  it('should handle null items in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCurrentUser,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: null,
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    const result = await client.getUserPlaylists();

    expect(result).toEqual([]);
  });

  it('should handle playlist with null display_name', async () => {
    const playlistWithNullName = {
      id: 'playlist1',
      name: 'My Playlist',
      owner: { id: 'user123', display_name: null },
      images: [],
      tracks: { total: 10 },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [playlistWithNullName],
          total: 1,
          next: null,
          previous: null,
          offset: 0,
          limit: 50,
        }),
      });

    const result = await client.getUserPlaylists();

    expect(result[0].owner.display_name).toBeNull();
  });

  it('should handle playlist with no images', async () => {
    const playlistNoImages = {
      id: 'playlist1',
      name: 'My Playlist',
      owner: { id: 'user123', display_name: 'Test Owner' },
      images: null,
      tracks: { total: 5 },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [playlistNoImages],
          total: 1,
          next: null,
          previous: null,
          offset: 0,
          limit: 50,
        }),
      });

    const result = await client.getUserPlaylists();

    expect(result[0].images).toEqual([]);
  });

  it('should handle playlist with null tracks', async () => {
    const playlistNullTracks = {
      id: 'playlist1',
      name: 'My Playlist',
      owner: { id: 'user123', display_name: 'Test Owner' },
      images: [],
      tracks: null,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [playlistNullTracks],
          total: 1,
          next: null,
          previous: null,
          offset: 0,
          limit: 50,
        }),
      });

    const result = await client.getUserPlaylists();

    expect(result[0].tracks.total).toBe(0);
  });

  it('should propagate authentication errors from getCurrentUser', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(client.getUserPlaylists()).rejects.toThrow(SpotifyAuthError);
  });

  it('should propagate rate limit errors from playlists endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

    await expect(client.getUserPlaylists()).rejects.toThrow(
      SpotifyRateLimitError
    );
  });

  it('should propagate API errors from playlists endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Internal server error' } }),
      });

    await expect(client.getUserPlaylists()).rejects.toThrow(SpotifyAPIError);
  });

  it('should correctly identify owned vs followed playlists', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCurrentUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            createMockPlaylist('owned1', 'My Owned Playlist', 'user123'),
            createMockPlaylist('followed1', 'Followed Playlist 1', 'other-user1'),
            createMockPlaylist('owned2', 'My Second Playlist', 'user123'),
            createMockPlaylist('followed2', 'Followed Playlist 2', 'other-user2'),
          ],
          total: 4,
          next: null,
          previous: null,
          offset: 0,
          limit: 50,
        }),
      });

    const result = await client.getUserPlaylists();

    expect(result[0].isOwned).toBe(true);
    expect(result[1].isOwned).toBe(false);
    expect(result[2].isOwned).toBe(true);
    expect(result[3].isOwned).toBe(false);
  });
});

describe('SpotifyClient.getPlaylistTracks', () => {
  let client: SpotifyClient;

  const createMockTrack = (id: string, name: string, artistName: string) => ({
    id,
    uri: `spotify:track:${id}`,
    name,
    artists: [{ id: `artist_${id}`, name: artistName }],
    album: {
      id: `album_${id}`,
      name: `Album for ${name}`,
      images: [{ url: `https://example.com/${id}.jpg`, width: 300, height: 300 }],
    },
    duration_ms: 200000,
  });

  const createMockPlaylistTrackItem = (track: ReturnType<typeof createMockTrack> | null) => ({
    track,
    added_at: '2024-01-15T10:00:00Z',
    added_by: { id: 'user123' },
  });

  beforeEach(() => {
    mockFetch.mockReset();
    client = new SpotifyClient('test-access-token', { enableRetries: false });
  });

  it('should fetch tracks from a playlist', async () => {
    const mockTracks = [
      createMockTrack('track1', 'Song One', 'Artist One'),
      createMockTrack('track2', 'Song Two', 'Artist Two'),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: mockTracks.map((t) => createMockPlaylistTrackItem(t)),
        total: 2,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Song One');
    expect(result[1].name).toBe('Song Two');
  });

  it('should call correct endpoint with default limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    await client.getPlaylistTracks('playlist123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=100&offset=0',
      expect.any(Object)
    );
  });

  it('should respect custom limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 50,
      }),
    });

    await client.getPlaylistTracks('playlist123', 50);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=50&offset=0',
      expect.any(Object)
    );
  });

  it('should clamp limit to maximum of 100', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    await client.getPlaylistTracks('playlist123', 200);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=100&offset=0',
      expect.any(Object)
    );
  });

  it('should clamp limit to minimum of 1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 1,
      }),
    });

    await client.getPlaylistTracks('playlist123', 0);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=1&offset=0',
      expect.any(Object)
    );
  });

  it('should handle pagination to fetch more tracks', async () => {
    // Create 100 tracks for first page
    const firstPageTracks = Array.from({ length: 100 }, (_, i) =>
      createMockTrack(`track${i + 1}`, `Song ${i + 1}`, `Artist ${i + 1}`)
    );

    // First page - 100 tracks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: firstPageTracks.map((t) => createMockPlaylistTrackItem(t)),
        total: 150,
        next: 'https://api.spotify.com/v1/playlists/playlist123/tracks?offset=100&limit=100',
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    // Create 50 tracks for second page
    const secondPageTracks = Array.from({ length: 50 }, (_, i) =>
      createMockTrack(`track${i + 101}`, `Song ${i + 101}`, `Artist ${i + 101}`)
    );

    // Second page - remaining 50 tracks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: secondPageTracks.map((t) => createMockPlaylistTrackItem(t)),
        total: 150,
        next: null,
        previous: 'https://api.spotify.com/v1/playlists/playlist123/tracks?offset=0&limit=100',
        offset: 100,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123', 150);

    expect(result).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=100&offset=0',
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/playlists/playlist123/tracks?limit=100&offset=100',
      expect.any(Object)
    );
  });

  it('should stop paginating when limit is reached', async () => {
    const tracks = Array.from({ length: 5 }, (_, i) =>
      createMockTrack(`track${i + 1}`, `Song ${i + 1}`, `Artist ${i + 1}`)
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: tracks.map((t) => createMockPlaylistTrackItem(t)),
        total: 100,
        next: 'https://api.spotify.com/v1/playlists/playlist123/tracks?offset=5',
        previous: null,
        offset: 0,
        limit: 5,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123', 3);

    // Should only return 3 tracks even though 5 were in the response
    expect(result).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when playlist has no tracks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123');

    expect(result).toEqual([]);
  });

  it('should handle null items in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: null,
        total: 0,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123');

    expect(result).toEqual([]);
  });

  it('should skip null tracks (deleted/unavailable tracks)', async () => {
    const mockTrack = createMockTrack('track1', 'Available Song', 'Artist One');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          createMockPlaylistTrackItem(mockTrack),
          createMockPlaylistTrackItem(null), // Deleted track
          createMockPlaylistTrackItem(mockTrack),
        ],
        total: 3,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123');

    // Should only return 2 tracks, skipping the null one
    expect(result).toHaveLength(2);
  });

  it('should propagate authentication errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
    });

    await expect(client.getPlaylistTracks('playlist123')).rejects.toThrow(
      SpotifyAuthError
    );
  });

  it('should propagate rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '30' }),
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    await expect(client.getPlaylistTracks('playlist123')).rejects.toThrow(
      SpotifyRateLimitError
    );
  });

  it('should propagate API errors for non-existent playlists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Not found' } }),
    });

    await expect(
      client.getPlaylistTracks('non-existent-playlist')
    ).rejects.toThrow(SpotifyAPIError);
  });

  it('should propagate server errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Internal server error' } }),
    });

    await expect(client.getPlaylistTracks('playlist123')).rejects.toThrow(
      SpotifyAPIError
    );
  });

  it('should return all track properties correctly', async () => {
    const mockTrack = createMockTrack('abc123', 'Test Song', 'Test Artist');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [createMockPlaylistTrackItem(mockTrack)],
        total: 1,
        next: null,
        previous: null,
        offset: 0,
        limit: 100,
      }),
    });

    const result = await client.getPlaylistTracks('playlist123');

    expect(result[0]).toEqual(mockTrack);
    expect(result[0].id).toBe('abc123');
    expect(result[0].uri).toBe('spotify:track:abc123');
    expect(result[0].name).toBe('Test Song');
    expect(result[0].artists[0].name).toBe('Test Artist');
    expect(result[0].album.name).toBe('Album for Test Song');
  });
});

describe('SpotifyClient - Exponential Backoff', () => {
  let client: SpotifyClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Rate limiting (429) retries', () => {
    it('should retry on 429 and succeed on second attempt', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      // First call: 429 rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      });

      const resultPromise = client.get('/test');

      // Advance past the Retry-After delay (1 second)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use Retry-After header for delay', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      // First call: 429 with 5 second Retry-After
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '5' }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      });

      const resultPromise = client.get('/test');

      // Advance 4 seconds - should not retry yet
      await jest.advanceTimersByTimeAsync(4000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance 1 more second - should now retry
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw SpotifyRateLimitError after max retries', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 2 } });

      // All calls: 429 rate limit
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      // Capture the error
      let caughtError: Error | undefined;
      const resultPromise = client.get('/test').catch((e) => {
        caughtError = e;
      });

      // Advance through all retries using runAllTimersAsync
      await jest.runAllTimersAsync();
      await resultPromise;

      expect(caughtError).toBeInstanceOf(SpotifyRateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('Server error (5xx) retries', () => {
    it('should retry on 500 and succeed on second attempt', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      // First call: 500 server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Internal server error' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      });

      const resultPromise = client.get('/test');

      // Advance past exponential backoff delay (1 second for first retry)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 and succeed', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: async () => ({ error: { message: 'Bad gateway' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        });

      const resultPromise = client.get('/test');
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: async () => ({ error: { message: 'Service unavailable' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        });

      const resultPromise = client.get('/test');
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw SpotifyAPIError after max retries on 500', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 2 } });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Internal server error' } }),
      });

      // Capture the error
      let caughtError: Error | undefined;
      const resultPromise = client.get('/test').catch((e) => {
        caughtError = e;
      });

      // Advance through all retries using runAllTimersAsync
      await jest.runAllTimersAsync();
      await resultPromise;

      expect(caughtError).toBeInstanceOf(SpotifyAPIError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('Non-retryable errors', () => {
    it('should not retry on 400 error', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Bad request' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyAPIError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 error', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Unauthorized' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyAuthError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 error', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Forbidden' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyAPIError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 error', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 3 } });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Not found' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyAPIError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential backoff delays', () => {
    it('should use exponential backoff for multiple retries', async () => {
      client = new SpotifyClient('test-token', {
        backoff: { maxRetries: 3, baseDelayMs: 1000, jitterFactor: 0 },
      });

      // All calls fail except last
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({ error: { message: 'Error' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({ error: { message: 'Error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        });

      const resultPromise = client.get('/test');

      // First retry after 1000ms (2^0 * 1000)
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second retry after 2000ms (2^1 * 1000)
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
    });
  });

  describe('Disable retries', () => {
    it('should not retry when enableRetries is false', async () => {
      client = new SpotifyClient('test-token', { enableRetries: false });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyRateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry 500 when enableRetries is false', async () => {
      client = new SpotifyClient('test-token', { enableRetries: false });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: 'Server error' } }),
      });

      await expect(client.get('/test')).rejects.toThrow(SpotifyAPIError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom backoff configuration', () => {
    it('should use custom maxRetries', async () => {
      client = new SpotifyClient('test-token', { backoff: { maxRetries: 1 } });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }),
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      // Capture the error
      let caughtError: Error | undefined;
      const resultPromise = client.get('/test').catch((e) => {
        caughtError = e;
      });

      // Advance through all retries using runAllTimersAsync
      await jest.runAllTimersAsync();
      await resultPromise;

      expect(caughtError).toBeInstanceOf(SpotifyRateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });

    it('should use custom baseDelayMs', async () => {
      client = new SpotifyClient('test-token', {
        backoff: { maxRetries: 3, baseDelayMs: 500, jitterFactor: 0 },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({ error: { message: 'Error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        });

      const resultPromise = client.get('/test');

      // Should wait 500ms for first retry (not 1000ms default)
      await jest.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Missing Retry-After header', () => {
    it('should use exponential backoff when Retry-After is missing', async () => {
      client = new SpotifyClient('test-token', {
        backoff: { maxRetries: 3, baseDelayMs: 1000, jitterFactor: 0 },
      });

      // 429 without Retry-After header
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(), // No Retry-After
          json: async () => ({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        });

      const resultPromise = client.get('/test');

      // Should use exponential backoff (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;
      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
