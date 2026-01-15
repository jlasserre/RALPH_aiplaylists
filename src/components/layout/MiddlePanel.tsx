'use client';

import { CandidateSong } from '@/types';
import { CandidateList } from '@/components/features/playlist/CandidateList';

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
}: MiddlePanelProps) {
  return (
    <div className="flex flex-col h-full">
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
        />
      )}
    </div>
  );
}
