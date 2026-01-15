'use client';

import { useCallback } from 'react';
import { usePlaylistStore } from '@/store/playlistStore';
import {
  useCandidateStore,
  getSelectedCandidates,
} from '@/store/candidateStore';
import type { PlaylistSong } from '@/types';

interface UsePlaylistReturn {
  /** Playlist name */
  name: string;
  /** Spotify playlist ID (if loaded or created) */
  spotifyPlaylistId: string | null;
  /** Whether the playlist is owned by the user */
  isOwned: boolean;
  /** Songs in the playlist */
  songs: PlaylistSong[];
  /** Set the playlist name */
  setName: (name: string) => void;
  /** Add selected candidates to the playlist */
  addSelectedToPlaylist: () => void;
  /** Toggle removal state for a song */
  toggleRemoval: (songId: string) => void;
  /** Remove a pending song */
  removePending: (songId: string) => void;
  /** Clear the playlist (for "New Playlist" flow) */
  clearPlaylist: () => void;
  /** Check if there are pending changes to sync */
  hasPendingChanges: boolean;
  /** Get count of songs by state */
  songCounts: {
    synced: number;
    pending: number;
    markedForRemoval: number;
    total: number;
  };
}

/**
 * Hook for managing the user's playlist.
 * Provides actions for adding selected candidates, managing song states,
 * and tracking pending changes.
 */
export function usePlaylist(): UsePlaylistReturn {
  const {
    name,
    spotifyPlaylistId,
    isOwned,
    songs,
    setName,
    addSongs,
    toggleRemoval,
    removePending,
    clearPlaylist: clearPlaylistStore,
  } = usePlaylistStore();

  const deselectAll = useCandidateStore((state) => state.deselectAll);
  const getCandidates = useCandidateStore((state) => state.candidates);

  /**
   * Add all selected candidates to the playlist.
   * Selected songs become 'pending' state in the playlist.
   * Clears selection after adding.
   */
  const addSelectedToPlaylist = useCallback(() => {
    // Get selected candidates from the candidate store
    const selectedCandidates = getSelectedCandidates({ candidates: getCandidates, isLoading: false });

    if (selectedCandidates.length === 0) {
      return;
    }

    // Filter to only include matched candidates with valid Spotify tracks
    const songsToAdd = selectedCandidates
      .filter((candidate) => candidate.spotifyTrack !== null)
      .map((candidate) => ({
        song: candidate.song,
        spotifyTrack: candidate.spotifyTrack!,
      }));

    if (songsToAdd.length > 0) {
      // Add songs to playlist (they will have 'pending' state)
      addSongs(songsToAdd);
    }

    // Clear selection in candidate store
    deselectAll();
  }, [getCandidates, addSongs, deselectAll]);

  /**
   * Clear the playlist and candidate stores (for "New Playlist" flow)
   */
  const clearPlaylist = useCallback(() => {
    clearPlaylistStore();
    useCandidateStore.getState().clearCandidates();
  }, [clearPlaylistStore]);

  // Calculate if there are pending changes
  const hasPendingChanges =
    songs.some((song) => song.state === 'pending') ||
    songs.some((song) => song.state === 'markedForRemoval');

  // Calculate song counts by state
  const songCounts = {
    synced: songs.filter((song) => song.state === 'synced').length,
    pending: songs.filter((song) => song.state === 'pending').length,
    markedForRemoval: songs.filter((song) => song.state === 'markedForRemoval')
      .length,
    total: songs.length,
  };

  return {
    name,
    spotifyPlaylistId,
    isOwned,
    songs,
    setName,
    addSelectedToPlaylist,
    toggleRemoval,
    removePending,
    clearPlaylist,
    hasPendingChanges,
    songCounts,
  };
}
