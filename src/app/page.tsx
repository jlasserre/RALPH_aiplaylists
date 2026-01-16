'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useCandidateStore } from '@/store/candidateStore';
import { usePlaylistStore } from '@/store/playlistStore';
import { useAuthStore } from '@/store/authStore';
import { useTagStore } from '@/store/tagStore';
import { NameConflictDialog } from '@/components/features/playlist';
import type { ConflictResolution } from '@/components/features/playlist';
import { SpotifyLoginButton, AuthStatus } from '@/components/features/auth';
import type { UserPlaylist, SpotifyTrack, Song, LLMProvider, PlaylistCreateResponse } from '@/types';
import { ErrorBanner } from '@/components/ui';
import type { ErrorType } from '@/components/ui';

export default function Home() {
  // Track hydration state to prevent SSR/CSR mismatch
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
  const reorderSong = usePlaylistStore((state) => state.reorderSong);

  // Candidate state and actions
  const candidates = useCandidateStore((state) => state.candidates);
  const isLoadingCandidates = useCandidateStore((state) => state.isLoading);
  const toggleSelection = useCandidateStore((state) => state.toggleSelection);
  const clearCandidates = useCandidateStore((state) => state.clearCandidates);
  const setCandidates = useCandidateStore((state) => state.setCandidates);
  const initCandidates = useCandidateStore((state) => state.initCandidates);
  const updateCandidate = useCandidateStore((state) => state.updateCandidate);
  const setLoadingCandidates = useCandidateStore((state) => state.setLoading);
  const insertCandidatesAfter = useCandidateStore((state) => state.insertCandidatesAfter);
  const cancelSearching = useCandidateStore((state) => state.cancelSearching);

  // Tag state and actions
  const toggleTag = useTagStore((state) => state.toggleTag);
  const isTagged = useTagStore((state) => state.isTagged);
  const clearTags = useTagStore((state) => state.clearTags);
  const taggedSongs = useTagStore((state) => state.taggedSongs);

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

  // Generation abort controller (for cancel button)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Suggested playlist name state (auto-suggested after first generation)
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const hasGeneratedRef = useRef(false); // Track if we've done at least one generation

  // Name conflict dialog state
  const [conflictDialog, setConflictDialog] = useState<{
    isOpen: boolean;
    playlistName: string;
    playlistId: string;
  }>({ isOpen: false, playlistName: '', playlistId: '' });

  // Error state for displaying error banners
  const [error, setError] = useState<{
    message: string;
    type: ErrorType;
    details?: string;
    retryAfter?: number;
    retryAction?: () => void;
  } | null>(null);

  // Store the last action params for retry functionality
  const lastActionRef = useRef<{
    type: 'generate' | 'loadPlaylist' | 'createPlaylist' | 'updatePlaylist' | 'moreLikeThis';
    params?: unknown;
  } | null>(null);

  /**
   * Clear error state
   */
  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Set error with proper type detection
   */
  const setErrorWithType = useCallback((
    message: string,
    statusCode?: number,
    details?: string,
    retryAction?: () => void
  ) => {
    let type: ErrorType = 'generic';
    let retryAfter: number | undefined;

    if (statusCode === 401 || statusCode === 403) {
      type = 'auth';
    } else if (statusCode === 429) {
      type = 'rate-limit';
      // Try to extract retry-after from details if available
      const match = details?.match(/retry.after[:\s]+(\d+)/i);
      if (match) {
        retryAfter = parseInt(match[1], 10);
      }
    } else if (message.toLowerCase().includes('llm') || message.toLowerCase().includes('claude') || message.toLowerCase().includes('openai')) {
      type = 'llm';
    } else if (message.toLowerCase().includes('spotify')) {
      type = 'spotify';
    } else if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch') || message.toLowerCase().includes('connection')) {
      type = 'network';
    }

    setError({
      message,
      type,
      details,
      retryAfter,
      retryAction,
    });
  }, []);

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
   * Handle dropping a candidate onto the playlist.
   * Finds the candidate by ID and adds it to the playlist.
   */
  const handleCandidateDrop = useCallback(
    (candidateId: string) => {
      // Find the candidate by ID
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate || !candidate.isMatched || !candidate.spotifyTrack) {
        return;
      }

      // Add the song to the playlist using the playlistStore directly
      const addSongs = usePlaylistStore.getState().addSongs;
      addSongs([
        {
          song: candidate.song,
          spotifyTrack: candidate.spotifyTrack,
        },
      ]);
    },
    [candidates]
  );

  /**
   * Handle dropping a playlist song onto the middle panel for removal.
   * Synced songs become markedForRemoval, pending songs are removed entirely.
   */
  const handlePlaylistSongDrop = useCallback(
    (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      if (!song) return;

      if (song.state === 'pending') {
        removePending(songId);
      } else {
        toggleRemoval(songId);
      }
    },
    [songs, removePending, toggleRemoval]
  );

  /**
   * Handle "More Like This" - fetch recommendations from Spotify and insert them.
   * For candidates: inserts after the source song
   * For playlist songs: inserts at the beginning of candidates
   */
  const handleMoreLikeThis = useCallback(
    async (spotifyTrackId: string, sourceCandidateId?: string) => {
      if (!accessToken) return;

      try {
        // Fetch recommendations from Spotify
        const response = await fetch('/api/spotify/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seedTrackId: spotifyTrackId,
            accessToken,
            limit: 10,
          }),
        });

        if (!response.ok) {
          console.error('Failed to fetch recommendations:', response.status);
          return;
        }

        const data = await response.json();
        const tracks: SpotifyTrack[] = data.tracks || [];

        if (tracks.length === 0) {
          console.log('No recommendations found');
          return;
        }

        // Convert SpotifyTrack to Song format for the store
        const recommendations = tracks.map((track) => ({
          song: {
            title: track.name,
            artist: track.artists.map((a) => a.name).join(', '),
            album: track.album.name,
          },
          spotifyTrack: track,
        }));

        // Insert after the source candidate if provided, otherwise prepend
        if (sourceCandidateId) {
          insertCandidatesAfter(sourceCandidateId, recommendations);
        } else {
          // If no source candidate (from playlist), prepend to candidates
          insertCandidatesAfter('non-existent', recommendations);
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    },
    [accessToken, insertCandidatesAfter]
  );

  /**
   * Handle "More Like This" from candidates panel
   * Finds the candidate by spotifyTrackId and passes its ID for insertion
   */
  const handleMoreLikeThisFromCandidate = useCallback(
    (spotifyTrackId: string) => {
      const candidate = candidates.find(
        (c) => c.spotifyTrack?.id === spotifyTrackId
      );
      handleMoreLikeThis(spotifyTrackId, candidate?.id);
    },
    [candidates, handleMoreLikeThis]
  );

  /**
   * Handle "More Like This" from playlist panel
   * Just passes the track ID, recommendations go to beginning of candidates
   */
  const handleMoreLikeThisFromPlaylist = useCallback(
    (spotifyTrackId: string) => {
      handleMoreLikeThis(spotifyTrackId);
    },
    [handleMoreLikeThis]
  );

  /**
   * Handle song generation flow:
   * 1. Call /api/generate to get song suggestions from LLM
   * 2. Call /api/spotify/search/stream to find tracks on Spotify (streaming)
   * 3. Display candidates incrementally as results arrive
   */
  const handleSuggestSongs = useCallback(
    async (prompt: string, provider: LLMProvider) => {
      // Clear any previous errors
      setError(null);

      if (!accessToken) {
        setErrorWithType('Please log in to Spotify to generate song suggestions.', 401);
        return;
      }

      // Store action for retry
      lastActionRef.current = { type: 'generate', params: { prompt, provider } };

      // Create new abort controller for this generation
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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
          signal: abortController.signal,
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json().catch(() => ({}));
          const errorMessage = errorData.message || `Failed to generate songs (${generateResponse.status})`;
          setErrorWithType(
            errorMessage,
            generateResponse.status,
            errorData.details,
            () => handleSuggestSongs(prompt, provider)
          );
          setLoadingCandidates(false);
          abortControllerRef.current = null;
          return;
        }

        const generateData = await generateResponse.json();
        const songs: Song[] = generateData.songs || [];

        if (songs.length === 0) {
          console.warn('No songs generated');
          setCandidates([]);
          abortControllerRef.current = null;
          return;
        }

        // Step 2: Initialize candidates with placeholders (for streaming display)
        initCandidates(songs);

        // Step 3: Stream search results from Spotify
        const searchResponse = await fetch('/api/spotify/search/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            songs,
            accessToken,
          }),
          signal: abortController.signal,
        });

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json().catch(() => ({}));
          const errorMessage = errorData.message || `Failed to search Spotify (${searchResponse.status})`;
          setErrorWithType(
            errorMessage,
            searchResponse.status,
            errorData.details,
            () => handleSuggestSongs(prompt, provider)
          );
          setLoadingCandidates(false);
          abortControllerRef.current = null;
          return;
        }

        // Read SSE stream
        const reader = searchResponse.body?.getReader();
        if (!reader) {
          console.error('No response body for streaming');
          setLoadingCandidates(false);
          abortControllerRef.current = null;
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            // Check if aborted before reading
            if (abortController.signal.aborted) {
              await reader.cancel();
              break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete events in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            let eventType = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ') && eventType) {
                const data = JSON.parse(line.slice(6));

                if (eventType === 'result') {
                  // Update individual candidate with search result
                  const { index, result } = data as {
                    index: number;
                    result: { song: Song; spotifyTrack: SpotifyTrack | null };
                  };
                  updateCandidate(index, result.spotifyTrack);
                } else if (eventType === 'complete') {
                  // All searches complete - isLoading will be set to false by updateCandidate
                  console.log(`Search complete, match rate: ${data.matchRate.toFixed(1)}%`);

                  // Auto-suggest playlist name on first generation (fire and forget)
                  if (!hasGeneratedRef.current && !playlistName) {
                    hasGeneratedRef.current = true;
                    fetch('/api/generate/suggest-name', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt, provider }),
                    })
                      .then((res) => res.ok ? res.json() : null)
                      .then((data) => {
                        if (data?.name) {
                          setSuggestedName(data.name);
                        }
                      })
                      .catch(() => {
                        // Ignore errors - name suggestion is optional
                      });
                  }
                } else if (eventType === 'error') {
                  setErrorWithType(
                    data.message || 'An error occurred during search',
                    undefined,
                    data.details,
                    () => handleSuggestSongs(prompt, provider)
                  );
                  setLoadingCandidates(false);
                  abortControllerRef.current = null;
                  return;
                }

                eventType = '';
              }
            }
          }
        } finally {
          // Clean up abort controller reference when done
          abortControllerRef.current = null;
        }
      } catch (error) {
        // Don't show error for abort - it's expected when cancelling
        if (error instanceof Error && error.name === 'AbortError') {
          // Keep any songs already found - just stop loading for remaining
          setLoadingCandidates(false);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          setErrorWithType(
            errorMessage,
            undefined,
            error instanceof Error ? error.stack : undefined,
            () => handleSuggestSongs(prompt, provider)
          );
          setLoadingCandidates(false);
        }
        abortControllerRef.current = null;
      }
    },
    [accessToken, setLoadingCandidates, setCandidates, initCandidates, updateCandidate, playlistName, setErrorWithType]
  );

  /**
   * Cancel the current generation
   * Keeps any songs already found, stops searching for the rest
   */
  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Stop searching - candidates already found are kept, others marked as not searching
    cancelSearching();
  }, [cancelSearching]);

  /**
   * Check if a playlist name already exists in user's playlists
   * Returns the conflicting playlist if found, null otherwise
   */
  const findConflictingPlaylist = useCallback(
    (name: string): UserPlaylist | null => {
      const normalizedName = name.trim().toLowerCase();
      return (
        userPlaylists.find(
          (p) => p.isOwned && p.name.trim().toLowerCase() === normalizedName
        ) || null
      );
    },
    [userPlaylists]
  );

  /**
   * Create a new playlist on Spotify (internal function)
   * Does the actual API call without conflict checking
   */
  const createPlaylistOnSpotify = useCallback(
    async (name: string, trackUris: string[]) => {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          trackUris,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create playlist: ${response.status}`);
      }

      return response.json() as Promise<PlaylistCreateResponse>;
    },
    [accessToken]
  );

  /**
   * Add songs to an existing playlist on Spotify
   */
  const addSongsToExistingPlaylist = useCallback(
    async (playlistId: string, trackUris: string[]) => {
      const response = await fetch('/api/spotify/playlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistId,
          addUris: trackUris,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to add songs to playlist: ${response.status}`);
      }

      return response.json() as Promise<PlaylistCreateResponse>;
    },
    [accessToken]
  );

  /**
   * Replace all songs in an existing playlist on Spotify
   * First removes all tracks, then adds the new ones
   */
  const replacePlaylistContents = useCallback(
    async (playlistId: string, currentTracks: string[], newTrackUris: string[]) => {
      // First, remove all existing tracks if any
      if (currentTracks.length > 0) {
        const removeResponse = await fetch('/api/spotify/playlist', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playlistId,
            removeUris: currentTracks,
            accessToken,
          }),
        });

        if (!removeResponse.ok) {
          const errorData = await removeResponse.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to remove tracks: ${removeResponse.status}`);
        }
      }

      // Then add the new tracks
      const addResponse = await fetch('/api/spotify/playlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistId,
          addUris: newTrackUris,
          accessToken,
        }),
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to add tracks: ${addResponse.status}`);
      }

      return addResponse.json() as Promise<PlaylistCreateResponse>;
    },
    [accessToken]
  );

  /**
   * Finalize playlist creation: update state and show success message
   */
  const finalizePlaylistCreation = useCallback(
    (data: PlaylistCreateResponse, finalName: string, message: string) => {
      // Update the store with the new playlist ID
      setPlaylistId(data.playlistId);

      // Set the actual name used
      setName(finalName);

      // Mark all pending songs as synced
      markPendingAsSynced();

      // Set the playlist as owned
      setIsOwned(true);

      // Show success message with link to playlist
      setSuccessMessage({
        message,
        playlistUrl: data.playlistUrl,
      });

      // Refresh the user's playlists
      fetchUserPlaylists();
    },
    [setPlaylistId, setName, markPendingAsSynced, setIsOwned, fetchUserPlaylists]
  );

  /**
   * Handle conflict resolution from the dialog
   */
  const handleConflictResolution = useCallback(
    async (resolution: ConflictResolution) => {
      // Close the dialog
      setConflictDialog({ isOpen: false, playlistName: '', playlistId: '' });

      if (resolution.type === 'cancel') {
        return;
      }

      // Get pending songs and their URIs
      const pendingSongs = songs.filter((s) => s.state === 'pending');
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
        if (resolution.type === 'add-to-existing') {
          // Add songs to the existing playlist
          const data = await addSongsToExistingPlaylist(resolution.playlistId, trackUris);

          // Find the existing playlist name
          const existingPlaylist = userPlaylists.find((p) => p.id === resolution.playlistId);
          const finalName = existingPlaylist?.name || conflictDialog.playlistName;

          finalizePlaylistCreation(data, finalName, 'Songs added to existing playlist!');
        } else if (resolution.type === 'replace-contents') {
          // Get current tracks from the existing playlist to remove them
          const tracksResponse = await fetch(
            `/api/spotify/playlists/${resolution.playlistId}/tracks?accessToken=${encodeURIComponent(accessToken!)}`
          );

          let currentTrackUris: string[] = [];
          if (tracksResponse.ok) {
            const tracksData = await tracksResponse.json();
            currentTrackUris = (tracksData.tracks || [])
              .map((t: SpotifyTrack) => t.uri)
              .filter((uri: string | undefined): uri is string => !!uri);
          }

          // Replace the contents
          const data = await replacePlaylistContents(
            resolution.playlistId,
            currentTrackUris,
            trackUris
          );

          // Find the existing playlist name
          const existingPlaylist = userPlaylists.find((p) => p.id === resolution.playlistId);
          const finalName = existingPlaylist?.name || conflictDialog.playlistName;

          finalizePlaylistCreation(data, finalName, 'Playlist contents replaced!');
        } else if (resolution.type === 'use-different-name') {
          // Create a new playlist with the different name
          const data = await createPlaylistOnSpotify(resolution.newName, trackUris);
          finalizePlaylistCreation(data, resolution.newName, 'Playlist created successfully!');
        }
      } catch (error) {
        console.error('Error resolving playlist conflict:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [
      songs,
      accessToken,
      userPlaylists,
      conflictDialog.playlistName,
      addSongsToExistingPlaylist,
      replacePlaylistContents,
      createPlaylistOnSpotify,
      finalizePlaylistCreation,
    ]
  );

  /**
   * Handle creating a new playlist on Spotify
   * Called when user clicks "Create Playlist" button
   * Checks for name conflicts before creating
   */
  const handleCreatePlaylist = useCallback(async () => {
    // Clear any previous errors
    setError(null);

    if (!accessToken) {
      setErrorWithType('Please log in to Spotify to create a playlist.', 401);
      return;
    }

    // Get songs that need to be added (pending songs)
    const pendingSongs = songs.filter((s) => s.state === 'pending');

    if (pendingSongs.length === 0) {
      setErrorWithType('No songs to add to the playlist. Add some songs first.');
      return;
    }

    // Use suggested name or default if no name provided
    const finalName = playlistName.trim() || suggestedName || 'My AI Playlist';

    // Get track URIs for all pending songs
    const trackUris = pendingSongs
      .map((s) => s.spotifyTrack?.uri)
      .filter((uri): uri is string => !!uri);

    if (trackUris.length === 0) {
      setErrorWithType('No valid Spotify tracks found. Make sure songs are matched on Spotify.');
      return;
    }

    // Check for name conflicts
    const conflictingPlaylist = findConflictingPlaylist(finalName);
    if (conflictingPlaylist) {
      // Show conflict dialog instead of creating
      setConflictDialog({
        isOpen: true,
        playlistName: conflictingPlaylist.name,
        playlistId: conflictingPlaylist.id,
      });
      return;
    }

    // No conflict, proceed with creation
    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const data = await createPlaylistOnSpotify(finalName, trackUris);
      finalizePlaylistCreation(data, finalName, 'Playlist created successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create playlist';
      setErrorWithType(
        errorMessage,
        undefined,
        error instanceof Error ? error.stack : undefined,
        () => handleCreatePlaylist()
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    songs,
    playlistName,
    suggestedName,
    findConflictingPlaylist,
    createPlaylistOnSpotify,
    finalizePlaylistCreation,
    setErrorWithType,
  ]);

  /**
   * Handle updating an existing Spotify playlist
   * Called when user clicks "Update Playlist" button
   * Adds pending songs and removes markedForRemoval songs
   */
  const handleUpdatePlaylist = useCallback(async () => {
    // Clear any previous errors
    setError(null);

    if (!accessToken) {
      setErrorWithType('Please log in to Spotify to update the playlist.', 401);
      return;
    }

    if (!spotifyPlaylistId) {
      setErrorWithType('No playlist loaded. Please load or create a playlist first.');
      return;
    }

    // Get songs that need to be added (pending songs)
    const pendingSongs = songs.filter((s) => s.state === 'pending');

    // Get songs that need to be removed (markedForRemoval songs)
    const songsToRemove = songs.filter((s) => s.state === 'markedForRemoval');

    // Check if there are any changes to sync
    if (pendingSongs.length === 0 && songsToRemove.length === 0) {
      setErrorWithType('No changes to sync. Add or remove songs first.');
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
      setErrorWithType('No valid Spotify tracks to add or remove.');
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
        const errorMessage = errorData.message || `Failed to update playlist (${response.status})`;
        setErrorWithType(
          errorMessage,
          response.status,
          errorData.details,
          () => handleUpdatePlaylist()
        );
        setIsSaving(false);
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to update playlist';
      setErrorWithType(
        errorMessage,
        undefined,
        error instanceof Error ? error.stack : undefined,
        () => handleUpdatePlaylist()
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    spotifyPlaylistId,
    songs,
    markPendingAsSynced,
    removeMarkedSongs,
    setErrorWithType,
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
    <>
      <ThreePanelLayout
        header={
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900">
                  AI Playlist Generator
                </h1>
                {/* Active playlist indicator - only show after hydration to prevent SSR mismatch */}
                {isHydrated && spotifyPlaylistId && playlistName && (
                  <a
                    href={`https://open.spotify.com/playlist/${spotifyPlaylistId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span className="font-medium">{playlistName}</span>
                  </a>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {/* Auth status - show login button or user info */}
                {isHydrated && (
                  isAuthenticated ? (
                    <AuthStatus />
                  ) : (
                    <SpotifyLoginButton />
                  )
                )}
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

            {/* Error banner */}
            {error && (
              <ErrorBanner
                message={error.message}
                type={error.type}
                details={error.details}
                retryAfter={error.retryAfter}
                onRetry={error.retryAction}
                onDismiss={dismissError}
              />
            )}
          </div>
        }
        leftPanel={
          <LeftPanel
            onNewPlaylist={clearPlaylist}
            onLoadExisting={handleLoadExisting}
            onSuggestSongs={handleSuggestSongs}
            onCancelGeneration={handleCancelGeneration}
            onPlaylistNameChange={setName}
            playlistName={playlistName}
            suggestedName={suggestedName ?? undefined}
            isGenerating={isLoadingCandidates}
            userPlaylists={userPlaylists}
            isLoadingPlaylists={isLoadingPlaylists}
            taggedSongs={taggedSongs}
            onClearTags={clearTags}
          />
        }
        middlePanel={
          <MiddlePanel
            candidates={candidates}
            onToggleSelection={toggleSelection}
            onAddSelected={handleAddSelected}
            isLoading={isLoadingCandidates}
            onPlaylistSongDrop={handlePlaylistSongDrop}
            onMoreLikeThis={handleMoreLikeThisFromCandidate}
            onToggleTag={toggleTag}
            isTagged={isTagged}
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
            onCandidateDrop={handleCandidateDrop}
            onReorder={reorderSong}
            onMoreLikeThis={handleMoreLikeThisFromPlaylist}
            onToggleTag={toggleTag}
            isTagged={isTagged}
          />
        }
      />

      {/* Name conflict resolution dialog */}
      <NameConflictDialog
        isOpen={conflictDialog.isOpen}
        conflictingPlaylistName={conflictDialog.playlistName}
        conflictingPlaylistId={conflictDialog.playlistId}
        onResolve={handleConflictResolution}
      />
    </>
  );
}
