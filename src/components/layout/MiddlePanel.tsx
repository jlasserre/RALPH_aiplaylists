'use client';

import { useState, DragEvent } from 'react';
import { CandidateSong, Song } from '@/types';
import { CandidateList, PLAYLIST_SONG_DRAG_TYPE } from '@/components/features/playlist';

interface MiddlePanelProps {
  /** List of candidate songs from the current generation */
  candidates?: CandidateSong[];
  /** Callback when a candidate's selection is toggled */
  onToggleSelection?: (candidateId: string) => void;
  /** Callback when "Add Selected" is clicked */
  onAddSelected?: () => void;
  /** Whether song generation is in progress */
  isLoading?: boolean;
  /** Whether adding selected songs is in progress */
  isAdding?: boolean;
  /** Callback when a playlist song is dropped for removal */
  onPlaylistSongDrop?: (songId: string) => void;
  /** Callback when "More Like This" is clicked for a candidate */
  onMoreLikeThis?: (spotifyTrackId: string) => void;
  /** Callback when tag toggle is clicked for a song */
  onToggleTag?: (spotifyTrackId: string, song: Song) => void;
  /** Function to check if a song is tagged */
  isTagged?: (spotifyTrackId: string) => boolean;
}

/**
 * Middle panel component containing the candidate songs list.
 * Shows songs from the current LLM generation with selection checkboxes.
 */
export function MiddlePanel({
  candidates = [],
  onToggleSelection,
  onAddSelected,
  isLoading = false,
  isAdding = false,
  onPlaylistSongDrop,
  onMoreLikeThis,
  onToggleTag,
  isTagged,
}: MiddlePanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * Handle drag over event to allow dropping playlist songs
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(PLAYLIST_SONG_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  /**
   * Handle drag enter to show visual feedback
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(PLAYLIST_SONG_DRAG_TYPE)) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  /**
   * Handle drag leave to remove visual feedback
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  /**
   * Handle drop event to remove the playlist song
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const dragData = e.dataTransfer.getData(PLAYLIST_SONG_DRAG_TYPE);
    // Parse the song ID from "index:songId" format
    const [, songId] = dragData.split(':');
    if (songId && onPlaylistSongDrop) {
      onPlaylistSongDrop(songId);
    }
  };

  return (
    <div
      className={`flex flex-col h-full transition-colors rounded-lg ${
        isDragOver ? 'bg-red-50 border-2 border-dashed border-red-400' : ''
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm text-center">
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Drop to remove from playlist</span>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-4">Candidates</h2>

      {isLoading ? (
        <div className="flex-1">
          {/* Skeleton loader for candidate songs */}
          <div className="mb-3 h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
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
        <CandidateList
          candidates={candidates}
          onToggleSelection={onToggleSelection}
          onAddSelected={onAddSelected}
          isAdding={isAdding}
          onPlaylistSongDrop={onPlaylistSongDrop}
          onMoreLikeThis={onMoreLikeThis}
          onToggleTag={onToggleTag}
          isTagged={isTagged}
        />
      )}
    </div>
  );
}
