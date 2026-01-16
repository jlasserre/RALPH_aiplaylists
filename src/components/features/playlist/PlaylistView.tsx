'use client';

import { useState, DragEvent } from 'react';
import { PlaylistSong, Song } from '@/types';
import { Button } from '@/components/ui';
import { SongCard } from './SongCard';
import { CANDIDATE_DRAG_TYPE } from './CandidateList';

/** Data type identifier for playlist song reorder drag operations */
export const PLAYLIST_SONG_DRAG_TYPE = 'application/x-playlist-song';

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
  /** Callback when a candidate is dropped onto the playlist */
  onCandidateDrop?: (candidateId: string) => void;
  /** Callback when songs are reordered via drag and drop */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** Callback when "More Like This" is clicked for a song */
  onMoreLikeThis?: (spotifyTrackId: string) => void;
  /** Callback when tag toggle is clicked for a song */
  onToggleTag?: (spotifyTrackId: string, song: Song) => void;
  /** Function to check if a song is tagged */
  isTagged?: (spotifyTrackId: string) => boolean;
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
  onCandidateDrop,
  onReorder,
  onMoreLikeThis,
  onToggleTag,
  isTagged,
}: PlaylistViewProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const pendingCount = songs.filter((s) => s.state === 'pending').length;
  const markedForRemovalCount = songs.filter(
    (s) => s.state === 'markedForRemoval'
  ).length;
  const duplicateCount = songs.filter((s) => s.isDuplicate).length;
  const hasChanges = pendingCount > 0 || markedForRemovalCount > 0;

  // Large playlist thresholds
  const LARGE_PLAYLIST_THRESHOLD = 500;
  const SPOTIFY_MAX_TRACKS = 10000;
  const isLargePlaylist = songs.length > LARGE_PLAYLIST_THRESHOLD;
  const isNearSpotifyLimit = songs.length > SPOTIFY_MAX_TRACKS * 0.9; // 90% of limit

  /**
   * Handle drag over event to allow dropping
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    // Only allow drop if the drag contains our candidate type
    if (e.dataTransfer.types.includes(CANDIDATE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  /**
   * Handle drag enter to show visual feedback
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(CANDIDATE_DRAG_TYPE)) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  /**
   * Handle drag leave to remove visual feedback
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only set isDragOver to false if we're leaving the container, not entering a child
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  /**
   * Handle drop event to add the candidate to the playlist
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const candidateId = e.dataTransfer.getData(CANDIDATE_DRAG_TYPE);
    if (candidateId && onCandidateDrop) {
      onCandidateDrop(candidateId);
    }
  };

  /**
   * Handle drag start for reordering a song within the playlist
   * Stores both the index (for reordering) and song ID (for removal)
   */
  const handleSongDragStart = (e: DragEvent<HTMLDivElement>, index: number, songId: string) => {
    e.dataTransfer.setData(PLAYLIST_SONG_DRAG_TYPE, `${index}:${songId}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  /**
   * Handle drag end for reordering (cleanup)
   */
  const handleSongDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  /**
   * Handle drag over a song (for reorder drop position indicator)
   */
  const handleSongDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (e.dataTransfer.types.includes(PLAYLIST_SONG_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetIndex(index);
    }
  };

  /**
   * Handle drop on a song (for reordering)
   */
  const handleSongDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const dragData = e.dataTransfer.getData(PLAYLIST_SONG_DRAG_TYPE);
    const [indexStr] = dragData.split(':');
    const sourceIndex = parseInt(indexStr, 10);
    if (!isNaN(sourceIndex) && onReorder && sourceIndex !== targetIndex) {
      onReorder(sourceIndex, targetIndex);
    }

    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  // Determine button label based on playlist state
  const buttonLabel =
    hasSpotifyPlaylist && !isReadOnly ? 'Update Playlist' : 'Create Playlist';

  if (songs.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-center h-full transition-colors rounded-lg ${
          isDragOver
            ? 'bg-blue-50 border-2 border-dashed border-blue-400'
            : ''
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver ? (
          <>
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-blue-700 mb-1">
              Drop to add to playlist
            </h3>
          </>
        ) : (
          <>
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
              your playlist. You can also drag songs from the candidates panel.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full transition-colors rounded-lg ${
        isDragOver
          ? 'bg-blue-50 border-2 border-dashed border-blue-400'
          : ''
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="mb-4 p-3 rounded-lg bg-blue-100 border border-blue-300 text-blue-700 text-sm text-center">
          <div className="flex items-center justify-center gap-2">
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Drop to add to playlist</span>
          </div>
        </div>
      )}

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

      {/* Duplicate warning banner */}
      {duplicateCount > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              {duplicateCount} duplicate {duplicateCount === 1 ? 'song' : 'songs'} in your playlist.
            </span>
          </div>
        </div>
      )}

      {/* Large playlist warning banner */}
      {isNearSpotifyLimit ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              Approaching Spotify limit! {songs.length.toLocaleString()} / {SPOTIFY_MAX_TRACKS.toLocaleString()} songs.
            </span>
          </div>
        </div>
      ) : isLargePlaylist && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Large playlist ({songs.length.toLocaleString()} songs). Spotify allows up to {SPOTIFY_MAX_TRACKS.toLocaleString()}.
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
        {songs.map((playlistSong, index) => (
          <div
            key={playlistSong.id}
            draggable={!!onReorder}
            onDragStart={(e) => handleSongDragStart(e, index, playlistSong.id)}
            onDragEnd={handleSongDragEnd}
            onDragOver={(e) => handleSongDragOver(e, index)}
            onDrop={(e) => handleSongDrop(e, index)}
            className={`relative ${
              draggedIndex === index ? 'opacity-50' : ''
            } ${onReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {/* Drop position indicator - shows above this song */}
            {dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index && (
              <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
                <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full" />
                <div className="absolute -right-1 -top-1 w-2 h-2 bg-blue-500 rounded-full" />
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              {onReorder && (
                <div className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="6" r="1.5" />
                    <circle cx="16" cy="6" r="1.5" />
                    <circle cx="8" cy="12" r="1.5" />
                    <circle cx="16" cy="12" r="1.5" />
                    <circle cx="8" cy="18" r="1.5" />
                    <circle cx="16" cy="18" r="1.5" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <SongCard
                  song={playlistSong.song}
                  state={playlistSong.state}
                  showStateIcon
                  isClickable
                  onClick={() => onSongClick?.(playlistSong.id)}
                  onMoreLikeThis={onMoreLikeThis}
                  spotifyTrackId={playlistSong.spotifyTrack?.id}
                  onToggleTag={onToggleTag}
                  isTagged={playlistSong.spotifyTrack?.id ? isTagged?.(playlistSong.spotifyTrack.id) : false}
                  isDuplicate={playlistSong.isDuplicate}
                />
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
