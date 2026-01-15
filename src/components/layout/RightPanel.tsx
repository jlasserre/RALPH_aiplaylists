'use client';

import { PlaylistSong } from '@/types';
import { PlaylistView } from '@/components/features/playlist/PlaylistView';

interface RightPanelProps {
  /** List of songs in the playlist */
  songs?: PlaylistSong[];
  /** Callback when a song is clicked (for toggling removal state) */
  onSongClick?: (songId: string) => void;
  /** Callback when "Create Playlist" or "Update Playlist" is clicked */
  onSave?: () => void;
  /** Whether an existing Spotify playlist is loaded */
  hasSpotifyPlaylist?: boolean;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Whether this is a read-only (followed) playlist */
  isReadOnly?: boolean;
  /** Whether the playlist is being loaded */
  isLoading?: boolean;
  /** Callback when a candidate is dropped onto the playlist */
  onCandidateDrop?: (candidateId: string) => void;
}

/**
 * Right panel component containing the user's accumulated playlist.
 * Shows songs with state indicators and the Create/Update button.
 */
export function RightPanel({
  songs = [],
  onSongClick,
  onSave,
  hasSpotifyPlaylist = false,
  isSaving = false,
  isReadOnly = false,
  isLoading = false,
  onCandidateDrop,
}: RightPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Playlist</h2>

      {isLoading ? (
        <div className="flex-1">
          {/* Skeleton loader for playlist songs */}
          <div className="mb-3 h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <PlaylistView
          songs={songs}
          onSongClick={onSongClick}
          onSave={onSave}
          hasSpotifyPlaylist={hasSpotifyPlaylist}
          isSaving={isSaving}
          isReadOnly={isReadOnly}
          onCandidateDrop={onCandidateDrop}
        />
      )}
    </div>
  );
}
