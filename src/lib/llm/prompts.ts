/**
 * LLM prompt templates for song generation and playlist naming
 */

/**
 * System prompt for song generation
 * Instructs the LLM to return a JSON array of songs matching the user's description
 */
export const SONG_GENERATION_SYSTEM_PROMPT = `You are a music expert assistant that helps create playlists. Your task is to suggest songs based on the user's description.

IMPORTANT RULES:
1. Return ONLY a valid JSON array of song objects
2. Each song object must have: "title" (string), "artist" (string)
3. Optionally include: "album" (string), "year" (number)
4. Suggest 15-25 songs that match the user's description
5. Focus on songs that are likely to be available on Spotify
6. Include a diverse mix of artists unless the user specifies otherwise
7. Consider the mood, era, genre, and any specific requirements mentioned
8. Do not include any text before or after the JSON array
9. Do not include markdown code blocks or formatting

Example response format:
[
  {"title": "Bohemian Rhapsody", "artist": "Queen", "album": "A Night at the Opera", "year": 1975},
  {"title": "Hotel California", "artist": "Eagles", "album": "Hotel California", "year": 1977}
]`;

/**
 * System prompt for playlist name suggestion
 * Instructs the LLM to suggest a creative playlist name based on the prompt
 */
export const PLAYLIST_NAME_SYSTEM_PROMPT = `You are a creative assistant that suggests playlist names. Based on the user's description of their desired playlist, suggest a single creative and catchy playlist name.

IMPORTANT RULES:
1. Return ONLY the playlist name as a plain string (no quotes, no JSON, no formatting)
2. Keep the name between 3-50 characters
3. Make it catchy, descriptive, and memorable
4. Avoid generic names like "My Playlist" or "Good Songs"
5. Consider the mood, era, genre, or theme described
6. Do not include any explanation or additional text

Examples:
- For "upbeat 90s songs": "90s Feel Good Vibes"
- For "relaxing acoustic songs for studying": "Focus & Flow"
- For "sad songs about heartbreak": "Midnight Tears"`;

/**
 * Builds the user prompt for song generation
 * @param userPrompt - The user's description of desired songs
 * @param songCount - Target number of songs to generate (default: 20)
 */
export function buildSongGenerationPrompt(
  userPrompt: string,
  songCount: number = 20
): string {
  return `Generate ${songCount} songs that match this description: ${userPrompt}`;
}

/**
 * Builds the user prompt for playlist name suggestion
 * @param userPrompt - The user's original prompt describing the playlist
 */
export function buildPlaylistNamePrompt(userPrompt: string): string {
  return `Suggest a playlist name for: ${userPrompt}`;
}

/**
 * Configuration for LLM generation
 */
export interface LLMGenerationConfig {
  /** Target number of songs to generate */
  songCount: number;
  /** Maximum tokens in response */
  maxTokens: number;
  /** Temperature for generation (0-1) */
  temperature: number;
}

/**
 * Default configuration for song generation
 */
export const DEFAULT_SONG_GENERATION_CONFIG: LLMGenerationConfig = {
  songCount: 20,
  maxTokens: 4096,
  temperature: 0.7,
};

/**
 * Default configuration for playlist name suggestion
 */
export const DEFAULT_PLAYLIST_NAME_CONFIG: LLMGenerationConfig = {
  songCount: 0, // Not applicable for name suggestion
  maxTokens: 100,
  temperature: 0.8,
};
