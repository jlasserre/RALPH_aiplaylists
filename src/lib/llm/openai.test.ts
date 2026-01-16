/**
 * Tests for OpenAIClient
 */

import { OpenAIClient, OpenAIAPIError } from './openai';
import OpenAI from 'openai';

// Mock the OpenAI SDK
jest.mock('openai');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the mock for chat.completions.create
    mockCreate = jest.fn();
    MockedOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as unknown as OpenAI));

    client = new OpenAIClient('test-api-key');
  });

  describe('constructor', () => {
    it('should create client with provided API key', () => {
      new OpenAIClient('my-api-key');
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'my-api-key',
      });
    });

    it('should create client with custom model', () => {
      const customClient = new OpenAIClient('api-key', 'gpt-4-turbo');
      expect(customClient).toBeInstanceOf(OpenAIClient);
    });
  });

  describe('generateSongs', () => {
    it('should generate songs from a valid response', async () => {
      const mockSongs = [
        { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: 1975 },
        { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', year: 1977 },
      ];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockSongs),
            },
          },
        ],
      });

      const songs = await client.generateSongs('classic rock songs');

      expect(songs).toEqual(mockSongs);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('classic rock songs'),
            }),
          ]),
        })
      );
    });

    it('should handle songs without optional fields', async () => {
      const mockSongs = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockSongs),
            },
          },
        ],
      });

      const songs = await client.generateSongs('any songs');

      expect(songs).toHaveLength(2);
      expect(songs[0].album).toBeUndefined();
      expect(songs[0].year).toBeUndefined();
    });

    it('should handle response with markdown code blocks', async () => {
      const mockSongs = [{ title: 'Test Song', artist: 'Test Artist' }];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '```json\n' + JSON.stringify(mockSongs) + '\n```',
            },
          },
        ],
      });

      const songs = await client.generateSongs('test');

      expect(songs).toHaveLength(1);
      expect(songs[0].title).toBe('Test Song');
    });

    it('should filter out invalid song objects', async () => {
      const mixedResponse = [
        { title: 'Valid Song', artist: 'Valid Artist' },
        { title: 'Missing Artist' }, // Invalid - no artist
        { artist: 'Missing Title' }, // Invalid - no title
        { title: '', artist: 'Empty Title' }, // Invalid - empty title
        { title: 'Another Valid', artist: 'Another Artist', album: 'Album', year: 2020 },
      ];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mixedResponse),
            },
          },
        ],
      });

      const songs = await client.generateSongs('test');

      expect(songs).toHaveLength(2);
      expect(songs[0].title).toBe('Valid Song');
      expect(songs[1].title).toBe('Another Valid');
    });

    it('should use custom config values', async () => {
      const mockSongs = [{ title: 'Song', artist: 'Artist' }];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockSongs),
            },
          },
        ],
      });

      await client.generateSongs('test', {
        songCount: 10,
        maxTokens: 2048,
        temperature: 0.5,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
          temperature: 0.5,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('10 songs'),
            }),
          ]),
        })
      );
    });

    it('should throw OpenAIAPIError for non-array response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"not": "an array"}',
            },
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow(OpenAIAPIError);
      await expect(client.generateSongs('test')).rejects.toThrow('expected JSON array');
    });

    it('should throw OpenAIAPIError for empty valid songs', async () => {
      // All invalid songs
      const invalidSongs = [
        { title: '', artist: '' },
        { noTitle: 'test' },
      ];

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(invalidSongs),
            },
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('No valid songs');
    });

    it('should throw OpenAIAPIError for no content in response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('No content');
    });

    it('should throw OpenAIAPIError for empty choices', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('No content');
    });

    it('should throw OpenAIAPIError for invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('Failed to parse');
    });
  });

  describe('generatePlaylistName', () => {
    it('should generate a playlist name', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '90s Feel Good Vibes',
            },
          },
        ],
      });

      const name = await client.generatePlaylistName('upbeat 90s songs');

      expect(name).toBe('90s Feel Good Vibes');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('upbeat 90s songs'),
            }),
          ]),
        })
      );
    });

    it('should trim whitespace from name', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '  Chill Vibes  \n',
            },
          },
        ],
      });

      const name = await client.generatePlaylistName('relaxing music');

      expect(name).toBe('Chill Vibes');
    });

    it('should remove quotes from name', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '"Summer Hits"',
            },
          },
        ],
      });

      const name = await client.generatePlaylistName('summer songs');

      expect(name).toBe('Summer Hits');
    });

    it('should truncate names longer than 100 characters', async () => {
      const longName = 'A'.repeat(150);

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: longName,
            },
          },
        ],
      });

      const name = await client.generatePlaylistName('test');

      expect(name.length).toBe(100);
    });

    it('should return default name for empty response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      });

      const name = await client.generatePlaylistName('test');

      expect(name).toBe('My Playlist');
    });
  });

  describe('error handling', () => {
    // Helper to create mock APIError-like objects
    const createMockAPIError = (status: number, message: string) => {
      const error = new Error(message) as Error & { status: number };
      error.status = status;
      // Make it look like an OpenAI APIError
      Object.setPrototypeOf(error, OpenAI.APIError.prototype);
      return error;
    };

    it('should handle rate limit error (429)', async () => {
      const apiError = createMockAPIError(429, 'Rate limit exceeded');

      mockCreate.mockRejectedValueOnce(apiError);

      await expect(client.generateSongs('test')).rejects.toThrow(OpenAIAPIError);

      mockCreate.mockRejectedValueOnce(createMockAPIError(429, 'Rate limit exceeded'));
      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).statusCode).toBe(429);
        expect((error as OpenAIAPIError).isRetryable).toBe(true);
      }
    });

    it('should handle authentication error (401)', async () => {
      const apiError = createMockAPIError(401, 'Invalid API key');

      mockCreate.mockRejectedValueOnce(apiError);

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).statusCode).toBe(401);
        expect((error as OpenAIAPIError).isRetryable).toBe(false);
        expect((error as OpenAIAPIError).message).toContain('Invalid API key');
      }
    });

    it('should handle server error (500) as retryable', async () => {
      const apiError = createMockAPIError(500, 'Internal server error');

      mockCreate.mockRejectedValueOnce(apiError);

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).statusCode).toBe(500);
        expect((error as OpenAIAPIError).isRetryable).toBe(true);
      }
    });

    it('should handle generic errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Some unexpected error'));

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).message).toBe('Some unexpected error');
        expect((error as OpenAIAPIError).isRetryable).toBe(false);
      }
    });

    it('should handle unknown error types', async () => {
      mockCreate.mockRejectedValueOnce('string error');

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).message).toBe('An unexpected error occurred');
      }
    });

    it('should handle network errors as retryable', async () => {
      mockCreate.mockRejectedValueOnce(new Error('network error'));

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIAPIError);
        expect((error as OpenAIAPIError).message).toBe('Network error. Please check your internet connection.');
        expect((error as OpenAIAPIError).isRetryable).toBe(true);
      }
    });
  });
});

describe('OpenAIAPIError', () => {
  it('should create error with message only', () => {
    const error = new OpenAIAPIError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('OpenAIAPIError');
    expect(error.statusCode).toBeUndefined();
    expect(error.isRetryable).toBe(false);
  });

  it('should create error with all properties', () => {
    const error = new OpenAIAPIError('Rate limited', 429, true);

    expect(error.message).toBe('Rate limited');
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
  });
});
