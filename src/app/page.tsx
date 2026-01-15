'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useCandidateStore } from '@/store/candidateStore';
import { usePlaylistStore } from '@/store/playlistStore';
import { useAuthStore } from '@/store/authStore';
import type { UserPlaylist, SpotifyTrack, Song, LLMProvider, PlaylistCreateResponse } from '@/types';

export default function Home() {
  // Auth state
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Playlist state and actions
  const {
    name: playlistName,
    spotifyPlaylistId,
    isOwned,
    songs,
    setName,
    addSelectedToPlaylist,
    toggleRemoval,
    removePending,
    clearPlaylist,
  } = usePlaylist();

  // Direct access to playlistStore actions for loading playlists and syncing
  const setPlaylistId = usePlaylistStore((state) => state.setPlaylistId);
  const loadSongs = usePlaylistStore((state) => state.loadSongs);
  const markPendingAsSynced = usePlaylistStore((state) => state.markPendingAsSynced);
  const removeMarkedSongs = usePlaylistStore((state) => state.removeMarkedSongs);
  const setIsOwned = usePlaylistStore((state) => state.setIsOwned);

  // Candidate state and actions
  const candidates = useCandidateStore((state) => state.candidates);
  const isLoadingCandidates = useCandidateStore((state) => state.isLoading);
  const toggleSelection = useCandidateStore((state) => state.toggleSelection);
  const clearCandidates = useCandidateStore((state) => state.clearCandidates);
  const setCandidates = useCandidateStore((state) => state.setCandidates);
  const setLoadingCandidates = useCandidateStore((state) => state.setLoading);

  // User playlists state
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);

  // Save/create playlist state
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    message: string;
    playlistUrl: string;
  } | null>(null);

  /**
   * Fetch user's playlists when authenticated
   */
  const fetchUserPlaylists = useCallback(async () => {
    if (!accessToken) return;

    setIsLoadingPlaylists(true);
    try {
      const response = await fetch(
        `/api/spotify/playlists?accessToken=${encodeURIComponent(accessToken)}`
      );

      if (!response.ok) {
        console.error('Failed to fetch playlists:', response.status);
        return;
      }

      const data = await response.json();
      setUserPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, [accessToken]);

  /**
   * Fetch playlists when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchUserPlaylists();
    } else {
      setUserPlaylists([]);
    }
  }, [isAuthenticated, accessToken, fetchUserPlaylists]);

  /**
   * Handle loading an existing playlist
   * Fetches tracks from Spotify and populates the store
   */
  const handleLoadExisting = useCallback(
    async (playlistId: string) => {
      if (!accessToken) return;

      // Find the selected playlist to get its metadata
      const selectedPlaylist = userPlaylists.find((p) => p.id === playlistId);
      if (!selectedPlaylist) return;

      setIsLoadingPlaylistTracks(true);
      clearCandidates();

      try {
        const response = await fetch(
          `/api/spotify/playlists/${playlistId}/tracks?accessToken=${encodeURIComponent(accessToken)}`
        );

        if (!response.ok) {
          console.error('Failed to fetch playlist tracks:', response.status);
          return;
        }

        const data = await response.json();
        const spotifyTracks: SpotifyTrack[] = data.tracks || [];

        // Convert SpotifyTracks to the format expected by loadSongs
        const songsToLoad = spotifyTracks.map((track) => ({
          song: {
            title: track.name,
            artist: track.artists.map((a) => a.name).join(', '),
            album: track.album.name,
          } as Song,
          spotifyTrack: track,
        }));

        // Load songs into the store
        loadSongs(songsToLoad, selectedPlaylist.isOwned);

        // Set the playlist metadata
        setName(selectedPlaylist.name);

        // Only set the Spotify playlist ID if we own it (can update it)
        // For followed playlists, we don't store the ID since we'll create a new one
        if (selectedPlaylist.isOwned) {
          setPlaylistId(playlistId);
        } else {
          // Clear playlist ID for read-only playlists - user will create a new one
          setPlaylistId(null);
          // Clear the name so user can enter a new name for the new playlist
          setName('');
        }
      } catch (error) {
        console.error('Error loading playlist tracks:', error);
      } finally {
        setIsLoadingPlaylistTracks(false);
      }
    },
    [accessToken, userPlaylists, loadSongs, setName, setPlaylistId, clearCandidates]
  );

  /**
   * Handle clicking on a song in the playlist.
   * For synced/markedForRemoval songs, toggle removal state.
   * For pending songs, remove them from the playlist.
   */
  const handleSongClick = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    if (song.state === 'pending') {
      removePending(songId);
    } else {
      toggleRemoval(songId);
    }
  };

  /**
   * Handle adding selected candidates to the playlist.
   */
  const handleAddSelected = () => {
    addSelectedToPlaylist();
  };

  /**
   * Handle song generation flow:
   * 1. Call /api/generate to get song suggestions from LLM
   * 2. Call /api/spotify/search to find tracks on Spotify
   * 3. Display candidates in the middle panel
   */
  const handleSuggestSongs = useCallback(
    async (prompt: string, provider: LLMProvider) => {
      if (!accessToken) {
        console.error('Not authenticated');
        return;
      }

      // Set loading state
      setLoadingCandidates(true);

      try {
        // Step 1: Generate songs from LLM
        const generateResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, provider }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json().catch(() => ({}));
          console.error('Failed to generate songs:', errorData.message || generateResponse.status);
          setLoadingCandidates(false);
          return;
        }

        const generateData = await generateResponse.json();
        const songs: Song[] = generateData.songs || [];

        if (songs.length === 0) {
          console.warn('No songs generated');
          setCandidates([]);
          return;
        }

        // Step 2: Search for songs on Spotify
        const searchResponse = await fetch('/api/spotify/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            songs,
            accessToken,
          }),
        });

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json().catch(() => ({}));
          console.error('Failed to search Spotify:', errorData.message || searchResponse.status);
          setLoadingCandidates(false);
          return;
        }

        const searchData = await searchResponse.json();
        const results: Array<{ song: Song; spotifyTrack: SpotifyTrack | null }> =
          searchData.results || [];

        // Step 3: Set candidates in the store
        setCandidates(results);
      } catch (error) {
        console.error('Error during song generation:', error);
        setLoadingCandidates(false);
      }
    },
    [accessToken, setLoadingCandidates, setCandidates]
  );

  /**
   * Handle creating a new playlist on Spotify
   * Called when user clicks "Create Playlist" button
   */
  const handleCreatePlaylist = useCallback(async () => {
    if (!accessToken) {
      console.error('Not authenticated');
      return;
    }

    // Get songs that need to be added (pending songs)
    const pendingSongs = songs.filter((s) => s.state === 'pending');

    if (pendingSongs.length === 0) {
      console.warn('No pending songs to add');
      return;
    }

    // Use a default name if none provided
    const finalName = playlistName.trim() || 'My AI Playlist';

    // Get track URIs for all pending songs
    const trackUris = pendingSongs
      .map((s) => s.spotifyTrack?.uri)
      .filter((uri): uri is string => !!uri);

    if (trackUris.length === 0) {
      console.error('No valid track URIs found');
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: finalName,
          trackUris,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to create playlist:', errorData.message || response.status);
        return;
      }

      const data: PlaylistCreateResponse = await response.json();

      // Update the store with the new playlist ID
      setPlaylistId(data.playlistId);

      // If we had a name placeholder, set the actual name used
      if (!playlistName.trim()) {
        setName(finalName);
      }

      // Mark all pending songs as synced
      markPendingAsSynced();

      // Set the playlist as owned (since we just created it)
      setIsOwned(true);

      // Show success message with link to playlist
      setSuccessMessage({
        message: 'Playlist created successfully!',
        playlistUrl: data.playlistUrl,
      });

      // Refresh the user's playlists so the new one appears in the dropdown
      fetchUserPlaylists();
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    songs,
    playlistName,
    setPlaylistId,
    setName,
    markPendingAsSynced,
    setIsOwned,
    fetchUserPlaylists,
  ]);

  /**
   * Handle updating an existing Spotify playlist
   * Called when user clicks "Update Playlist" button
   * Adds pending songs and removes markedForRemoval songs
   */
  const handleUpdatePlaylist = useCallback(async () => {
    if (!accessToken) {
      console.error('Not authenticated');
      return;
    }

    if (!spotifyPlaylistId) {
      console.error('No playlist ID to update');
      return;
    }

    // Get songs that need to be added (pending songs)
    const pendingSongs = songs.filter((s) => s.state === 'pending');

    // Get songs that need to be removed (markedForRemoval songs)
    const songsToRemove = songs.filter((s) => s.state === 'markedForRemoval');

    // Check if there are any changes to sync
    if (pendingSongs.length === 0 && songsToRemove.length === 0) {
      console.warn('No changes to sync');
      return;
    }

    // Get track URIs for songs to add
    const addUris = pendingSongs
      .map((s) => s.spotifyTrack?.uri)
      .filter((uri): uri is string => !!uri);

    // Get track URIs for songs to remove
    const removeUris = songsToRemove
      .map((s) => s.spotifyTrack?.uri)
      .filter((uri): uri is string => !!uri);

    // Check if we have valid URIs for changes
    if (addUris.length === 0 && removeUris.length === 0) {
      console.error('No valid track URIs found');
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistId: spotifyPlaylistId,
          addUris: addUris.length > 0 ? addUris : undefined,
          removeUris: removeUris.length > 0 ? removeUris : undefined,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to update playlist:', errorData.message || response.status);
        return;
      }

      const data: PlaylistCreateResponse = await response.json();

      // Mark all pending songs as synced
      markPendingAsSynced();

      // Remove songs that were marked for removal
      removeMarkedSongs();

      // Show success message with link to playlist
      setSuccessMessage({
        message: 'Playlist updated successfully!',
        playlistUrl: data.playlistUrl,
      });
    } catch (error) {
      console.error('Error updating playlist:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    spotifyPlaylistId,
    songs,
    markPendingAsSynced,
    removeMarkedSongs,
  ]);

  /**
   * Handle save action (create or update playlist)
   */
  const handleSave = useCallback(() => {
    // If we have an existing Spotify playlist that we own, update it
    // Otherwise, create a new playlist
    if (spotifyPlaylistId && isOwned) {
      handleUpdatePlaylist();
    } else {
      handleCreatePlaylist();
    }
  }, [spotifyPlaylistId, isOwned, handleCreatePlaylist, handleUpdatePlaylist]);

  /**
   * Clear success message
   */
  const dismissSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  // Determine if we have an existing Spotify playlist loaded
  const hasSpotifyPlaylist = spotifyPlaylistId !== null;

  // Determine if playlist is read-only (not owned)
  const isReadOnly = !isOwned;

  return (
    <ThreePanelLayout
      header={
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              AI Playlist Generator
            </h1>
            <div className="text-sm text-gray-500">
              {/* Auth status will go here */}
            </div>
          </div>

          {/* Success message banner */}
          {successMessage && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{successMessage.message}</span>
                <a
                  href={successMessage.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline hover:text-green-900 font-medium"
                >
                  Open in Spotify
                </a>
              </div>
              <button
                onClick={dismissSuccessMessage}
                className="text-green-600 hover:text-green-800"
                aria-label="Dismiss"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      }
      leftPanel={
        <LeftPanel
          onNewPlaylist={clearPlaylist}
          onLoadExisting={handleLoadExisting}
          onSuggestSongs={handleSuggestSongs}
          onPlaylistNameChange={setName}
          playlistName={playlistName}
          isGenerating={isLoadingCandidates}
          userPlaylists={userPlaylists}
          isLoadingPlaylists={isLoadingPlaylists}
        />
      }
      middlePanel={
        <MiddlePanel
          candidates={candidates}
          onToggleSelection={toggleSelection}
          onAddSelected={handleAddSelected}
          isLoading={isLoadingCandidates}
        />
      }
      rightPanel={
        <RightPanel
          songs={songs}
          onSongClick={handleSongClick}
          onSave={handleSave}
          hasSpotifyPlaylist={hasSpotifyPlaylist}
          isSaving={isSaving}
          isReadOnly={isReadOnly}
          isLoading={isLoadingPlaylistTracks}
        />
      }
    />
  );
}
