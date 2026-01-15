'use client';

import { CandidateSong } from '@/types';
import { Button, Checkbox } from '@/components/ui';

interface CandidateListProps {
  /** List of candidate songs from the current generation */
  candidates: CandidateSong[];
  /** Callback when a candidate's selection is toggled */
  onToggleSelection?: (candidateId: string) => void;
  /** Callback when "Add Selected" is clicked */
  onAddSelected?: () => void;
  /** Whether adding is in progress */
  isAdding?: boolean;
}

/**
 * List of candidate songs from the current LLM generation.
 * Shows checkboxes for selection and an "Add Selected" button.
 */
export function CandidateList({
  candidates,
  onToggleSelection,
  onAddSelected,
  isAdding = false,
}: CandidateListProps) {
  const selectedCount = candidates.filter((c) => c.isSelected).length;
  const matchedCount = candidates.filter((c) => c.isMatched).length;
  const hasSelections = selectedCount > 0;

  if (candidates.length === 0) {
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
          No candidates yet
        </h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Enter a prompt in the left panel and click &quot;Suggest songs&quot; to generate
          song suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Match rate header */}
      <div className="mb-3 text-sm text-gray-600">
        {matchedCount} of {candidates.length} songs found on Spotify
      </div>

      {/* Candidate list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`p-3 rounded-lg border transition-colors ${
              candidate.isMatched
                ? 'bg-white border-gray-200 hover:border-gray-300'
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
