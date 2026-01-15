import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlaylistSong, SpotifyTrack, Song } from '@/types';

interface PlaylistState {
  /** Playlist name */
  name: string;
  /** Spotify playlist ID (if loaded or created) */
  spotifyPlaylistId: string | null;
  /** Whether the playlist is owned by the user (false for followed playlists) */
  isOwned: boolean;
  /** Songs in the playlist with their state */
  songs: PlaylistSong[];
}

interface PlaylistActions {
  /** Set the playlist name */
  setName: (name: string) => void;
  /** Set the Spotify playlist ID (when loaded or created) */
  setPlaylistId: (id: string | null) => void;
  /** Set whether the playlist is owned by the user */
  setIsOwned: (isOwned: boolean) => void;
  /** Add songs to the playlist (new songs get 'pending' state) */
  addSongs: (songs: Array<{ song: Song; spotifyTrack: SpotifyTrack }>) => void;
  /** Toggle removal state for a synced song (synced <-> markedForRemoval) */
  toggleRemoval: (songId: string) => void;
  /** Remove a pending song from the playlist */
  removePending: (songId: string) => void;
  /** Clear the entire playlist (for "New Playlist" flow) */
  clearPlaylist: () => void;
  /** Load songs from an existing playlist (all get 'synced' state if owned, 'pending' if not) */
  loadSongs: (songs: Array<{ song: Song; spotifyTrack: SpotifyTrack }>, isOwned: boolean) => void;
  /** Mark all pending songs as synced (after successful sync) */
  markPendingAsSynced: () => void;
  /** Remove all songs marked for removal (after successful sync) */
  removeMarkedSongs: () => void;
  /** Reorder a song by moving it from one index to another */
  reorderSong: (fromIndex: number, toIndex: number) => void;
}

type PlaylistStore = PlaylistState & PlaylistActions;

/** Generate a unique ID for a playlist song */
function generateSongId(): string {
  return `song_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Storage key for playlist persistence */
export const PLAYLIST_STORAGE_KEY = 'playlist-storage';

/**
 * Playlist store for managing the user's playlist state.
 * Songs can be in one of three states:
 * - synced: Already in the Spotify playlist
 * - pending: Will be added on next sync
 * - markedForRemoval: Will be removed on next sync
 *
 * State is persisted to localStorage for session recovery.
 */
export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set) => ({
      // Initial state
      name: '',
      spotifyPlaylistId: null,
      isOwned: true,
      songs: [],

      // Actions
      setName: (name: string) =>
        set({
          name,
        }),

      setPlaylistId: (id: string | null) =>
        set({
          spotifyPlaylistId: id,
        }),

      setIsOwned: (isOwned: boolean) =>
        set({
          isOwned,
        }),

      addSongs: (songs) =>
        set((state) => ({
          songs: [
            ...state.songs,
            ...songs.map((item) => ({
              id: generateSongId(),
              song: item.song,
              spotifyTrack: item.spotifyTrack,
              state: 'pending' as const,
            })),
          ],
        })),

      toggleRemoval: (songId: string) =>
        set((state) => ({
          songs: state.songs.map((song) => {
            if (song.id !== songId) return song;
            // Only toggle between synced and markedForRemoval
            if (song.state === 'synced') {
              return { ...song, state: 'markedForRemoval' as const };
            }
            if (song.state === 'markedForRemoval') {
              return { ...song, state: 'synced' as const };
            }
            // Pending songs are not affected by toggleRemoval
            return song;
          }),
        })),

      removePending: (songId: string) =>
        set((state) => ({
          songs: state.songs.filter(
            (song) => !(song.id === songId && song.state === 'pending')
          ),
        })),

      clearPlaylist: () =>
        set({
          name: '',
          spotifyPlaylistId: null,
          isOwned: true,
          songs: [],
        }),

      loadSongs: (songs, isOwned) =>
        set({
          songs: songs.map((item) => ({
            id: generateSongId(),
            song: item.song,
            spotifyTrack: item.spotifyTrack,
            // If owned playlist, songs are synced; if not owned, they're pending (will create new playlist)
            state: isOwned ? ('synced' as const) : ('pending' as const),
          })),
          isOwned,
        }),

      markPendingAsSynced: () =>
        set((state) => ({
          songs: state.songs.map((song) =>
            song.state === 'pending' ? { ...song, state: 'synced' as const } : song
          ),
        })),

      removeMarkedSongs: () =>
        set((state) => ({
          songs: state.songs.filter((song) => song.state !== 'markedForRemoval'),
        })),

      reorderSong: (fromIndex: number, toIndex: number) =>
        set((state) => {
          // Validate indices
          if (
            fromIndex < 0 ||
            fromIndex >= state.songs.length ||
            toIndex < 0 ||
            toIndex >= state.songs.length ||
            fromIndex === toIndex
          ) {
            return state;
          }

          const newSongs = [...state.songs];
          const [movedSong] = newSongs.splice(fromIndex, 1);
          newSongs.splice(toIndex, 0, movedSong);
          return { songs: newSongs };
        }),
    }),
    {
      name: PLAYLIST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the state data, not the actions
      partialize: (state) => ({
        name: state.name,
        spotifyPlaylistId: state.spotifyPlaylistId,
        isOwned: state.isOwned,
        songs: state.songs,
      }),
    }
  )
);
