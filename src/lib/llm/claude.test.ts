/**
 * Tests for ClaudeClient
 */

import { ClaudeClient, ClaudeAPIError } from './claude';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe('ClaudeClient', () => {
  let client: ClaudeClient;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the mock for messages.create
    mockCreate = jest.fn();
    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic));

    client = new ClaudeClient('test-api-key');
  });

  describe('constructor', () => {
    it('should create client with provided API key', () => {
      new ClaudeClient('my-api-key');
      expect(MockedAnthropic).toHaveBeenCalledWith({
        apiKey: 'my-api-key',
      });
    });

    it('should create client with custom model', () => {
      const customClient = new ClaudeClient('api-key', 'claude-3-opus-20240229');
      expect(customClient).toBeInstanceOf(ClaudeClient);
    });
  });

  describe('generateSongs', () => {
    it('should generate songs from a valid response', async () => {
      const mockSongs = [
        { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: 1975 },
        { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', year: 1977 },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockSongs),
          },
        ],
      });

      const songs = await client.generateSongs('classic rock songs');

      expect(songs).toEqual(mockSongs);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('classic rock songs'),
            },
          ],
        })
      );
    });

    it('should handle songs without optional fields', async () => {
      const mockSongs = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockSongs),
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
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify(mockSongs) + '\n```',
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
        content: [
          {
            type: 'text',
            text: JSON.stringify(mixedResponse),
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
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockSongs),
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
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('10 songs'),
            },
          ],
        })
      );
    });

    it('should throw ClaudeAPIError for non-array response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"not": "an array"}',
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow(ClaudeAPIError);
      await expect(client.generateSongs('test')).rejects.toThrow('expected JSON array');
    });

    it('should throw ClaudeAPIError for empty valid songs', async () => {
      // All invalid songs
      const invalidSongs = [
        { title: '', artist: '' },
        { noTitle: 'test' },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(invalidSongs),
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('No valid songs');
    });

    it('should throw ClaudeAPIError for no text content in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('No text content');
    });

    it('should throw ClaudeAPIError for invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'not valid json',
          },
        ],
      });

      await expect(client.generateSongs('test')).rejects.toThrow('Failed to parse');
    });
  });

  describe('generatePlaylistName', () => {
    it('should generate a playlist name', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '90s Feel Good Vibes',
          },
        ],
      });

      const name = await client.generatePlaylistName('upbeat 90s songs');

      expect(name).toBe('90s Feel Good Vibes');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('upbeat 90s songs'),
            },
          ],
        })
      );
    });

    it('should trim whitespace from name', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '  Chill Vibes  \n',
          },
        ],
      });

      const name = await client.generatePlaylistName('relaxing music');

      expect(name).toBe('Chill Vibes');
    });

    it('should remove quotes from name', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '"Summer Hits"',
          },
        ],
      });

      const name = await client.generatePlaylistName('summer songs');

      expect(name).toBe('Summer Hits');
    });

    it('should truncate names longer than 100 characters', async () => {
      const longName = 'A'.repeat(150);

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: longName,
          },
        ],
      });

      const name = await client.generatePlaylistName('test');

      expect(name.length).toBe(100);
    });

    it('should return default name for empty response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '',
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
      // Make it look like an Anthropic APIError
      Object.setPrototypeOf(error, Anthropic.APIError.prototype);
      return error;
    };

    it('should handle rate limit error (429)', async () => {
      const apiError = createMockAPIError(429, 'Rate limit exceeded');

      mockCreate.mockRejectedValueOnce(apiError);

      await expect(client.generateSongs('test')).rejects.toThrow(ClaudeAPIError);

      mockCreate.mockRejectedValueOnce(createMockAPIError(429, 'Rate limit exceeded'));
      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAPIError);
        expect((error as ClaudeAPIError).statusCode).toBe(429);
        expect((error as ClaudeAPIError).isRetryable).toBe(true);
      }
    });

    it('should handle authentication error (401)', async () => {
      const apiError = createMockAPIError(401, 'Invalid API key');

      mockCreate.mockRejectedValueOnce(apiError);

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAPIError);
        expect((error as ClaudeAPIError).statusCode).toBe(401);
        expect((error as ClaudeAPIError).isRetryable).toBe(false);
        expect((error as ClaudeAPIError).message).toContain('Invalid API key');
      }
    });

    it('should handle server error (500) as retryable', async () => {
      const apiError = createMockAPIError(500, 'Internal server error');

      mockCreate.mockRejectedValueOnce(apiError);

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAPIError);
        expect((error as ClaudeAPIError).statusCode).toBe(500);
        expect((error as ClaudeAPIError).isRetryable).toBe(true);
      }
    });

    it('should handle generic errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Some unexpected error'));

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAPIError);
        expect((error as ClaudeAPIError).message).toBe('Some unexpected error');
        expect((error as ClaudeAPIError).isRetryable).toBe(false);
      }
    });

    it('should handle unknown error types', async () => {
      mockCreate.mockRejectedValueOnce('string error');

      try {
        await client.generateSongs('test');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAPIError);
        expect((error as ClaudeAPIError).message).toBe('An unexpected error occurred');
      }
    });
  });
});

describe('ClaudeAPIError', () => {
  it('should create error with message only', () => {
    const error = new ClaudeAPIError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ClaudeAPIError');
    expect(error.statusCode).toBeUndefined();
    expect(error.isRetryable).toBe(false);
  });

  it('should create error with all properties', () => {
    const error = new ClaudeAPIError('Rate limited', 429, true);

    expect(error.message).toBe('Rate limited');
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
  });
});
