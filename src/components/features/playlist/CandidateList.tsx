'use client';

import { useState, DragEvent } from 'react';
import { CandidateSong, Song } from '@/types';
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
  /** Callback when "More Like This" is clicked for a candidate */
  onMoreLikeThis?: (spotifyTrackId: string) => void;
  /** Callback when tag toggle is clicked for a song */
  onToggleTag?: (spotifyTrackId: string, song: Song) => void;
  /** Function to check if a song is tagged */
  isTagged?: (spotifyTrackId: string) => boolean;
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
  onMoreLikeThis,
  onToggleTag,
  isTagged,
}: CandidateListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedCount = candidates.filter((c) => c.isSelected).length;
  const matchedCount = candidates.filter((c) => c.isMatched).length;
  const searchingCount = candidates.filter((c) => c.isSearching).length;
  const completedCount = candidates.length - searchingCount;
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
        {searchingCount > 0 ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            Searching... {completedCount} of {candidates.length} checked
            {matchedCount > 0 && ` (${matchedCount} found)`}
          </span>
        ) : (
          `${matchedCount} of ${candidates.length} songs found on Spotify`
        )}
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
            className={`p-3 rounded-lg border-2 transition-colors ${
              candidate.isSearching
                ? 'bg-gray-50 border-gray-200 animate-pulse'
                : !candidate.isMatched
                  ? 'bg-gray-50 border-gray-100 opacity-60'
                  : candidate.spotifyTrack && isTagged?.(candidate.spotifyTrack.id)
                    ? 'bg-amber-50 border-amber-300 hover:border-amber-400 cursor-grab active:cursor-grabbing'
                    : 'bg-white border-gray-200 hover:border-gray-300 cursor-grab active:cursor-grabbing'
            }`}
          >
            <div className="flex items-start gap-3">
              {candidate.isSearching ? (
                <div className="w-4 h-4 mt-0.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <Checkbox
                  label=""
                  checked={candidate.isSelected}
                  disabled={!candidate.isMatched}
                  onChange={() => onToggleSelection?.(candidate.id)}
                  aria-label={`Select ${candidate.song.title} by ${candidate.song.artist}`}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {candidate.song.title}
                  </span>
                  {candidate.isSearching ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Searching...
                    </span>
                  ) : !candidate.isMatched && (
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
              {/* Action buttons for matched songs */}
              {candidate.isMatched && candidate.spotifyTrack && (onToggleTag || onMoreLikeThis) && (
                <div className="flex-shrink-0 flex items-center gap-1">
                  {/* Tag button */}
                  {onToggleTag && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTag(candidate.spotifyTrack!.id, candidate.song);
                      }}
                      className={`relative group p-1 rounded transition-colors ${
                        isTagged?.(candidate.spotifyTrack!.id) ? 'bg-amber-100' : 'hover:bg-gray-100'
                      }`}
                      aria-label={isTagged?.(candidate.spotifyTrack!.id) ? 'Remove tag' : 'Tag for prompt generation'}
                    >
                      <svg
                        className={`w-4 h-4 ${
                          isTagged?.(candidate.spotifyTrack!.id) ? 'text-amber-600' : 'text-gray-400 group-hover:text-amber-600'
                        }`}
                        fill={isTagged?.(candidate.spotifyTrack!.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      <div className="absolute right-0 top-6 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                        {isTagged?.(candidate.spotifyTrack!.id) ? 'Remove tag' : 'Tag for prompt'}
                      </div>
                    </button>
                  )}
                  {/* More Like This button */}
                  {onMoreLikeThis && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoreLikeThis(candidate.spotifyTrack!.id);
                      }}
                      className="relative group p-1 rounded hover:bg-gray-100 transition-colors"
                      aria-label="Get similar song recommendations"
                    >
                      <svg
                        className="w-4 h-4 text-gray-400 group-hover:text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <div className="absolute right-0 top-6 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
                        More like this
                      </div>
                    </button>
                  )}
                </div>
              )}
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
