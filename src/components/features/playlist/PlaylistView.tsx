'use client';

import { PlaylistSong } from '@/types';
import { Button } from '@/components/ui';
import { SongCard } from './SongCard';

interface PlaylistViewProps {
  /** List of songs in the playlist */
  songs: PlaylistSong[];
  /** Callback when a song is clicked (for toggling removal state) */
  onSongClick?: (songId: string) => void;
  /** Callback when "Create Playlist" or "Update Playlist" is clicked */
  onSave?: () => void;
  /** Whether an existing Spotify playlist is loaded (determines button label) */
  hasSpotifyPlaylist?: boolean;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Whether this is a read-only (followed) playlist */
  isReadOnly?: boolean;
}

/**
 * Displays the user's accumulated playlist songs with state indicators.
 * Shows "Create Playlist" or "Update Playlist" button at the bottom.
 */
export function PlaylistView({
  songs,
  onSongClick,
  onSave,
  hasSpotifyPlaylist = false,
  isSaving = false,
  isReadOnly = false,
}: PlaylistViewProps) {
  const pendingCount = songs.filter((s) => s.state === 'pending').length;
  const markedForRemovalCount = songs.filter(
    (s) => s.state === 'markedForRemoval'
  ).length;
  const hasChanges = pendingCount > 0 || markedForRemovalCount > 0;

  // Determine button label based on playlist state
  const buttonLabel =
    hasSpotifyPlaylist && !isReadOnly ? 'Update Playlist' : 'Create Playlist';

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          No songs yet
        </h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Generate songs from the left panel and add your favorites here to build
          your playlist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>
              This playlist is read-only. Changes will create a new playlist.
            </span>
          </div>
        </div>
      )}

      {/* Song count header */}
      <div className="mb-3 text-sm text-gray-600">
        {songs.length} {songs.length === 1 ? 'song' : 'songs'}
        {hasChanges && (
          <span className="ml-2">
            ({pendingCount > 0 && `${pendingCount} pending`}
            {pendingCount > 0 && markedForRemovalCount > 0 && ', '}
            {markedForRemovalCount > 0 && `${markedForRemovalCount} to remove`})
          </span>
        )}
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {songs.map((playlistSong) => (
          <SongCard
            key={playlistSong.id}
            song={playlistSong.song}
            state={playlistSong.state}
            showStateIcon
            isClickable
            onClick={() => onSongClick?.(playlistSong.id)}
          />
        ))}
      </div>

      {/* Create/Update button */}
      <div className="pt-4 mt-auto border-t border-gray-200">
        <Button
          variant="primary"
          className="w-full"
          onClick={onSave}
          disabled={songs.length === 0 || isSaving}
          isLoading={isSaving}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
