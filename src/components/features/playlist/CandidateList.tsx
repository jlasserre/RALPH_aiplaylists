'use client';

import { useState, DragEvent } from 'react';
import { CandidateSong } from '@/types';
import { Button, Checkbox } from '@/components/ui';
import { PLAYLIST_SONG_DRAG_TYPE } from './PlaylistView';

interface CandidateListProps {
  /** List of candidate songs from the current generation */
  candidates: CandidateSong[];
  /** Callback when a candidate's selection is toggled */
  onToggleSelection?: (candidateId: string) => void;
  /** Callback when "Add Selected" is clicked */
  onAddSelected?: () => void;
  /** Whether adding is in progress */
  isAdding?: boolean;
  /** Callback when a playlist song is dropped for removal */
  onPlaylistSongDrop?: (songId: string) => void;
}

/** Data type identifier for drag operations */
export const CANDIDATE_DRAG_TYPE = 'application/x-candidate-song';

/**
 * List of candidate songs from the current LLM generation.
 * Shows checkboxes for selection and an "Add Selected" button.
 */
export function CandidateList({
  candidates,
  onToggleSelection,
  onAddSelected,
  isAdding = false,
  onPlaylistSongDrop,
}: CandidateListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedCount = candidates.filter((c) => c.isSelected).length;
  const matchedCount = candidates.filter((c) => c.isMatched).length;
  const hasSelections = selectedCount > 0;

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

  if (candidates.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-center h-full transition-colors rounded-lg ${
          isDragOver
            ? 'bg-red-50 border-2 border-dashed border-red-400'
            : ''
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver ? (
          <>
            <div className="w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
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
            </div>
            <h3 className="text-sm font-medium text-red-700 mb-1">
              Drop to remove from playlist
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
              No candidates yet
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Enter a prompt in the left panel and click &quot;Suggest songs&quot; to generate
              song suggestions.
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
          ? 'bg-red-50 border-2 border-dashed border-red-400'
          : ''
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

      {/* Match rate header */}
      <div className="mb-3 text-sm text-gray-600">
        {matchedCount} of {candidates.length} songs found on Spotify
      </div>

      {/* Candidate list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            draggable={candidate.isMatched}
            onDragStart={(e) => {
              if (!candidate.isMatched) {
                e.preventDefault();
                return;
              }
              // Set the drag data with the candidate ID
              e.dataTransfer.setData(CANDIDATE_DRAG_TYPE, candidate.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className={`p-3 rounded-lg border transition-colors ${
              candidate.isMatched
                ? 'bg-white border-gray-200 hover:border-gray-300 cursor-grab active:cursor-grabbing'
                : 'bg-gray-50 border-gray-100 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                label=""
                checked={candidate.isSelected}
                disabled={!candidate.isMatched}
                onChange={() => onToggleSelection?.(candidate.id)}
                aria-label={`Select ${candidate.song.title} by ${candidate.song.artist}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {candidate.song.title}
                  </span>
                  {!candidate.isMatched && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                      Not found
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {candidate.song.artist}
                </div>
                {candidate.song.album && (
                  <div className="text-xs text-gray-400 truncate">
                    {candidate.song.album}
                    {candidate.song.year && ` • ${candidate.song.year}`}
                  </div>
                )}
              </div>
              {/* Drag handle indicator for matched songs */}
              {candidate.isMatched && (
                <div className="flex-shrink-0 text-gray-300" aria-hidden="true">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Selected button */}
      <div className="pt-4 mt-auto border-t border-gray-200">
        <Button
          variant="primary"
          className="w-full"
          onClick={onAddSelected}
          disabled={!hasSelections || isAdding}
          isLoading={isAdding}
        >
          Add Selected ({selectedCount}) →
        </Button>
      </div>
    </div>
  );
}
