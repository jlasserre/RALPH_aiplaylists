/**
 * Base type exports for the AI Playlist Generator
 */

// LLM Provider types
export type LLMProvider = 'claude' | 'openai';

// Song types
export interface Song {
  title: string;
  artist: string;
  album?: string;
  year?: number;
}

// Spotify track types
export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
}

// Playlist song state
export type SongState = 'synced' | 'pending' | 'markedForRemoval';

export interface PlaylistSong {
  id: string;
  song: Song;
  spotifyTrack: SpotifyTrack | null;
  state: SongState;
  /** Whether this song is a duplicate of another in the playlist */
  isDuplicate?: boolean;
}

// Candidate song (from generation)
export interface CandidateSong {
  id: string;
  song: Song;
  spotifyTrack: SpotifyTrack | null;
  isSelected: boolean;
  isMatched: boolean;
  /** Whether Spotify search is in progress for this candidate (streaming mode) */
  isSearching?: boolean;
}

// API response types
export interface GenerateResponse {
  songs: Song[];
}

export interface SuggestNameResponse {
  name: string;
}

export interface SpotifySearchResult {
  song: Song;
  spotifyTrack: SpotifyTrack | null;
}

export interface SpotifySearchResponse {
  results: SpotifySearchResult[];
  matchRate: number;
}

export interface PlaylistCreateResponse {
  playlistId: string;
  playlistUrl: string;
}

// User playlist (from /me/playlists endpoint)
export interface UserPlaylist {
  id: string;
  name: string;
  owner: {
    id: string;
    display_name: string | null;
  };
  isOwned: boolean;
  images: Array<{ url: string; width: number | null; height: number | null }>;
  tracks: {
    total: number;
  };
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
