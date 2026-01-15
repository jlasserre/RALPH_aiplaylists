'use client';

import { useState, useEffect, useCallback } from 'react';
import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useCandidateStore } from '@/store/candidateStore';
import { usePlaylistStore } from '@/store/playlistStore';
import { useAuthStore } from '@/store/authStore';
import type { UserPlaylist, SpotifyTrack, Song, LLMProvider } from '@/types';

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

  // Direct access to playlistStore actions for loading playlists
  const setPlaylistId = usePlaylistStore((state) => state.setPlaylistId);
  const loadSongs = usePlaylistStore((state) => state.loadSongs);

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

  // Determine if we have an existing Spotify playlist loaded
  const hasSpotifyPlaylist = spotifyPlaylistId !== null;

  // Determine if playlist is read-only (not owned)
  const isReadOnly = !isOwned;

  return (
    <ThreePanelLayout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            AI Playlist Generator
          </h1>
          <div className="text-sm text-gray-500">
            {/* Auth status will go here */}
          </div>
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
          hasSpotifyPlaylist={hasSpotifyPlaylist}
          isReadOnly={isReadOnly}
          isLoading={isLoadingPlaylistTracks}
        />
      }
    />
  );
}
