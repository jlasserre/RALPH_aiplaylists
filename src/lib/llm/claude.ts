/**
 * Claude LLM client for song generation
 * Uses the Anthropic SDK to generate song suggestions based on user prompts
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Custom error class for Claude API errors
 */
export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}

/**
 * Client for interacting with Claude API for song generation
 */
export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  /**
   * Creates a new ClaudeClient instance
   * @param apiKey - Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
   * @param model - Claude model to use (defaults to claude-sonnet-4-20250514)
   */
  constructor(apiKey?: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = model;
  }

  /**
   * Generates song suggestions based on a user prompt
   * @param prompt - User's description of desired songs
   * @param config - Generation configuration options
   * @returns Array of Song objects
   * @throws ClaudeAPIError on API failures
   */
  async generateSongs(
    prompt: string,
    config: Partial<LLMGenerationConfig> = {}
  ): Promise<Song[]> {
    const finalConfig = { ...DEFAULT_SONG_GENERATION_CONFIG, ...config };

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens,
        system: SONG_GENERATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildSongGenerationPrompt(prompt, finalConfig.songCount),
          },
        ],
      });

      // Extract text content from the response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new ClaudeAPIError('No text content in response', undefined, false);
      }

      return this.parseSongsResponse(textContent.text);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generates a playlist name suggestion based on a user prompt
   * @param prompt - User's description of the playlist
   * @param config - Generation configuration options
   * @returns Suggested playlist name
   * @throws ClaudeAPIError on API failures
   */
  async generatePlaylistName(
    prompt: string,
    config: Partial<LLMGenerationConfig> = {}
  ): Promise<string> {
    const finalConfig = { ...DEFAULT_PLAYLIST_NAME_CONFIG, ...config };

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens,
        system: PLAYLIST_NAME_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildPlaylistNamePrompt(prompt),
          },
        ],
      });

      // Extract text content from the response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new ClaudeAPIError('No text content in response', undefined, false);
      }

      // Clean up the response - trim whitespace and remove any quotes
      const name = textContent.text.trim().replace(/^["']|["']$/g, '');

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
   * @param rawResponse - Raw text response from Claude
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
        throw new ClaudeAPIError(
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
        throw new ClaudeAPIError(
          'No valid songs in response',
          undefined,
          false
        );
      }

      return songs;
    } catch (error) {
      if (error instanceof ClaudeAPIError) {
        throw error;
      }
      throw new ClaudeAPIError(
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
   * Handles errors from the Anthropic SDK
   * @param error - The caught error
   * @returns ClaudeAPIError with appropriate message and retry status
   */
  private handleError(error: unknown): ClaudeAPIError {
    // If it's already a ClaudeAPIError, return it
    if (error instanceof ClaudeAPIError) {
      return error;
    }

    // Handle Anthropic SDK errors
    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;

      // Rate limiting
      if (statusCode === 429) {
        return new ClaudeAPIError(
          'Rate limit exceeded. Please try again later.',
          statusCode,
          true
        );
      }

      // Authentication errors
      if (statusCode === 401) {
        return new ClaudeAPIError(
          'Invalid API key. Please check your Anthropic API key.',
          statusCode,
          false
        );
      }

      // Server errors - retryable
      if (statusCode >= 500) {
        return new ClaudeAPIError(
          'Claude service temporarily unavailable. Please try again.',
          statusCode,
          true
        );
      }

      // Other API errors
      return new ClaudeAPIError(
        error.message || 'An error occurred while calling Claude API',
        statusCode,
        false
      );
    }

    // Handle network errors
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new ClaudeAPIError(
          'Network error. Please check your internet connection.',
          undefined,
          true
        );
      }

      return new ClaudeAPIError(error.message, undefined, false);
    }

    // Unknown error
    return new ClaudeAPIError(
      'An unexpected error occurred',
      undefined,
      false
    );
  }
}
