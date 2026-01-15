/**
 * OpenAI LLM client for song generation
 * Uses the OpenAI SDK to generate song suggestions based on user prompts
 */

import OpenAI from 'openai';
import { Song } from '@/types/song';
import {
  SONG_GENERATION_SYSTEM_PROMPT,
  PLAYLIST_NAME_SYSTEM_PROMPT,
  buildSongGenerationPrompt,
  buildPlaylistNamePrompt,
  LLMGenerationConfig,
  DEFAULT_SONG_GENERATION_CONFIG,
  DEFAULT_PLAYLIST_NAME_CONFIG,
} from './prompts';

/**
 * Custom error class for OpenAI API errors
 */
export class OpenAIAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIAPIError';
  }
}

/**
 * Client for interacting with OpenAI API for song generation
 */
export class OpenAIClient {
  private client: OpenAI;
  private model: string;

  /**
   * Creates a new OpenAIClient instance
   * @param apiKey - OpenAI API key (defaults to OPENAI_API_KEY env var)
   * @param model - OpenAI model to use (defaults to gpt-4o)
   */
  constructor(apiKey?: string, model: string = 'gpt-4o') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  /**
   * Generates song suggestions based on a user prompt
   * @param prompt - User's description of desired songs
   * @param config - Generation configuration options
   * @returns Array of Song objects
   * @throws OpenAIAPIError on API failures
   */
  async generateSongs(
    prompt: string,
    config: Partial<LLMGenerationConfig> = {}
  ): Promise<Song[]> {
    const finalConfig = { ...DEFAULT_SONG_GENERATION_CONFIG, ...config };

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens,
        temperature: finalConfig.temperature,
        messages: [
          {
            role: 'system',
            content: SONG_GENERATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildSongGenerationPrompt(prompt, finalConfig.songCount),
          },
        ],
      });

      // Extract text content from the response
      const message = response.choices[0]?.message;
      if (!message || !message.content) {
        throw new OpenAIAPIError('No content in response', undefined, false);
      }

      return this.parseSongsResponse(message.content);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generates a playlist name suggestion based on a user prompt
   * @param prompt - User's description of the playlist
   * @param config - Generation configuration options
   * @returns Suggested playlist name
   * @throws OpenAIAPIError on API failures
   */
  async generatePlaylistName(
    prompt: string,
    config: Partial<LLMGenerationConfig> = {}
  ): Promise<string> {
    const finalConfig = { ...DEFAULT_PLAYLIST_NAME_CONFIG, ...config };

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens,
        temperature: finalConfig.temperature,
        messages: [
          {
            role: 'system',
            content: PLAYLIST_NAME_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildPlaylistNamePrompt(prompt),
          },
        ],
      });

      // Extract text content from the response
      const message = response.choices[0]?.message;
      if (!message || message.content === null || message.content === undefined) {
        throw new OpenAIAPIError('No content in response', undefined, false);
      }

      // Clean up the response - trim whitespace and remove any quotes
      const name = message.content.trim().replace(/^["']|["']$/g, '');

      // Validate the name length
      if (name.length < 1 || name.length > 100) {
        // Return a truncated or default name if invalid
        return name.length > 100 ? name.substring(0, 100) : 'My Playlist';
      }

      return name;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Parses the raw JSON response into Song objects
   * @param rawResponse - Raw text response from OpenAI
   * @returns Array of validated Song objects
   */
  private parseSongsResponse(rawResponse: string): Song[] {
    // Clean up the response - remove any markdown formatting that might have slipped through
    let cleanedResponse = rawResponse.trim();

    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(cleanedResponse);

      if (!Array.isArray(parsed)) {
        throw new OpenAIAPIError(
          'Invalid response format: expected JSON array',
          undefined,
          false
        );
      }

      // Validate and filter songs
      const songs: Song[] = [];
      for (const item of parsed) {
        if (this.isValidSong(item)) {
          songs.push({
            title: item.title,
            artist: item.artist,
            album: item.album || undefined,
            year: item.year || undefined,
          });
        }
      }

      if (songs.length === 0) {
        throw new OpenAIAPIError(
          'No valid songs in response',
          undefined,
          false
        );
      }

      return songs;
    } catch (error) {
      if (error instanceof OpenAIAPIError) {
        throw error;
      }
      throw new OpenAIAPIError(
        `Failed to parse song response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        false
      );
    }
  }

  /**
   * Validates that an object is a valid Song
   * @param item - Object to validate
   * @returns True if the object is a valid Song
   */
  private isValidSong(item: unknown): item is Song {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const song = item as Record<string, unknown>;

    return (
      typeof song.title === 'string' &&
      song.title.length > 0 &&
      typeof song.artist === 'string' &&
      song.artist.length > 0 &&
      (song.album === undefined || typeof song.album === 'string') &&
      (song.year === undefined || typeof song.year === 'number')
    );
  }

  /**
   * Handles errors from the OpenAI SDK
   * @param error - The caught error
   * @returns OpenAIAPIError with appropriate message and retry status
   */
  private handleError(error: unknown): OpenAIAPIError {
    // If it's already an OpenAIAPIError, return it
    if (error instanceof OpenAIAPIError) {
      return error;
    }

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;

      // Rate limiting
      if (statusCode === 429) {
        return new OpenAIAPIError(
          'Rate limit exceeded. Please try again later.',
          statusCode,
          true
        );
      }

      // Authentication errors
      if (statusCode === 401) {
        return new OpenAIAPIError(
          'Invalid API key. Please check your OpenAI API key.',
          statusCode,
          false
        );
      }

      // Server errors - retryable
      if (statusCode >= 500) {
        return new OpenAIAPIError(
          'OpenAI service temporarily unavailable. Please try again.',
          statusCode,
          true
        );
      }

      // Other API errors
      return new OpenAIAPIError(
        error.message || 'An error occurred while calling OpenAI API',
        statusCode,
        false
      );
    }

    // Handle network errors
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new OpenAIAPIError(
          'Network error. Please check your internet connection.',
          undefined,
          true
        );
      }

      return new OpenAIAPIError(error.message, undefined, false);
    }

    // Unknown error
    return new OpenAIAPIError(
      'An unexpected error occurred',
      undefined,
      false
    );
  }
}
