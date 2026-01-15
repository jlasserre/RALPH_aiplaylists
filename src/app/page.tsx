'use client';

import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useCandidateStore } from '@/store/candidateStore';

export default function Home() {
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

  // Candidate state and actions
  const candidates = useCandidateStore((state) => state.candidates);
  const isLoadingCandidates = useCandidateStore((state) => state.isLoading);
  const toggleSelection = useCandidateStore((state) => state.toggleSelection);

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
          onPlaylistNameChange={setName}
          playlistName={playlistName}
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
        />
      }
    />
  );
}
