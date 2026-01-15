/**
 * Song type definitions for LLM-generated song suggestions
 */

/**
 * Represents a song as returned by the LLM
 * Used for matching against Spotify's catalog
 */
export interface Song {
  /** The title of the song */
  title: string;
  /** The artist or band name */
  artist: string;
  /** The album name (optional, helps with matching) */
  album?: string;
  /** The release year (optional, helps with matching) */
  year?: number;
}

/**
 * Response from LLM song generation
 */
export interface LLMSongGenerationResponse {
  songs: Song[];
}

/**
 * Response from LLM playlist name suggestion
 */
export interface LLMPlaylistNameResponse {
  name: string;
}
