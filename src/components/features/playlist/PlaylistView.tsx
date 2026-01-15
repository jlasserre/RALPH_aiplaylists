'use client';

import { PlaylistSong } from '@/types';
import { Button } from '@/components/ui';

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
          <div
            key={playlistSong.id}
            onClick={() => onSongClick?.(playlistSong.id)}
            className={`p-3 rounded-lg border transition-colors cursor-pointer ${
              playlistSong.state === 'markedForRemoval'
                ? 'bg-red-50 border-red-200 hover:border-red-300'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSongClick?.(playlistSong.id);
              }
            }}
          >
            <div className="flex items-start gap-3">
              {/* State icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center relative">
                {playlistSong.state === 'synced' && (
                  <div className="relative group">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Synced - This song is in your Spotify playlist"
                    >
                      <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                      This song is in your Spotify playlist
                    </div>
                  </div>
                )}
                {playlistSong.state === 'pending' && (
                  <div className="relative group">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Pending - This song will be added when you save"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                      This song will be added when you save
                    </div>
                  </div>
                )}
                {playlistSong.state === 'markedForRemoval' && (
                  <div className="relative group">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Marked for removal - This song will be removed when you save"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                      This song will be removed when you save
                    </div>
                  </div>
                )}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium truncate ${
                    playlistSong.state === 'markedForRemoval'
                      ? 'text-red-900 line-through'
                      : 'text-gray-900'
                  }`}
                >
                  {playlistSong.song.title}
                </div>
                <div
                  className={`text-sm truncate ${
                    playlistSong.state === 'markedForRemoval'
                      ? 'text-red-700'
                      : 'text-gray-600'
                  }`}
                >
                  {playlistSong.song.artist}
                </div>
                {playlistSong.song.album && (
                  <div
                    className={`text-xs truncate ${
                      playlistSong.state === 'markedForRemoval'
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {playlistSong.song.album}
                    {playlistSong.song.year && ` • ${playlistSong.song.year}`}
                  </div>
                )}
              </div>
            </div>
          </div>
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
