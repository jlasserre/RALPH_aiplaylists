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
    client = new SpotifyClient('test-access-token');
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
    client = new SpotifyClient('test-access-token');
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
