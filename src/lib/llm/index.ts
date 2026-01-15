/**
 * LLM factory module for creating LLM clients
 * Provides a unified interface for switching between Claude and OpenAI providers
 */

import { Song } from '@/types/song';
import { ClaudeClient, ClaudeAPIError } from './claude';
import { OpenAIClient, OpenAIAPIError } from './openai';
import { LLMGenerationConfig } from './prompts';

/**
 * Available LLM providers
 */
export type LLMProvider = 'claude' | 'openai';

/**
 * Common interface for LLM clients
 * Both ClaudeClient and OpenAIClient implement this interface
 */
export interface LLMClient {
  /**
   * Generates song suggestions based on a user prompt
   * @param prompt - User's description of desired songs
   * @param config - Generation configuration options
   * @returns Array of Song objects
   */
  generateSongs(prompt: string, config?: Partial<LLMGenerationConfig>): Promise<Song[]>;

  /**
   * Generates a playlist name suggestion based on a user prompt
   * @param prompt - User's description of the playlist
   * @param config - Generation configuration options
   * @returns Suggested playlist name
   */
  generatePlaylistName(prompt: string, config?: Partial<LLMGenerationConfig>): Promise<string>;
}

/**
 * Factory function to create an LLM client based on the provider
 * @param provider - The LLM provider to use ('claude' or 'openai')
 * @returns An LLM client instance
 * @throws Error if an invalid provider is specified
 */
export function getLLMClient(provider: LLMProvider): LLMClient {
  switch (provider) {
    case 'claude':
      return new ClaudeClient();
    case 'openai':
      return new OpenAIClient();
    default:
      // This should never happen due to TypeScript type checking,
      // but provides runtime safety
      throw new Error(`Invalid LLM provider: ${provider}`);
  }
}

/**
 * Gets the default LLM provider from environment variable
 * @returns The default LLM provider
 */
export function getDefaultProvider(): LLMProvider {
  const envProvider = process.env.LLM_DEFAULT_PROVIDER;
  if (envProvider === 'claude' || envProvider === 'openai') {
    return envProvider;
  }
  // Default to Claude if not specified or invalid
  return 'claude';
}

// Re-export client classes and error types for direct use when needed
export { ClaudeClient, ClaudeAPIError } from './claude';
export { OpenAIClient, OpenAIAPIError } from './openai';

// Re-export prompt utilities
export type { LLMGenerationConfig } from './prompts';
export { DEFAULT_SONG_GENERATION_CONFIG, DEFAULT_PLAYLIST_NAME_CONFIG } from './prompts';
