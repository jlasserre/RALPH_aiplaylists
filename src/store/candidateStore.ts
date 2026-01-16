import { create } from 'zustand';
import type { CandidateSong, Song, SpotifyTrack } from '@/types';

interface CandidateState {
  /** Candidate songs from current generation */
  candidates: CandidateSong[];
  /** Whether a generation is in progress */
  isLoading: boolean;
}

interface CandidateActions {
  /** Set candidates from a new generation */
  setCandidates: (
    songs: Array<{ song: Song; spotifyTrack: SpotifyTrack | null }>
  ) => void;
  /** Initialize candidates with placeholder entries (for streaming) */
  initCandidates: (songs: Song[]) => void;
  /** Update a candidate with Spotify search result (for streaming) */
  updateCandidate: (
    index: number,
    spotifyTrack: SpotifyTrack | null
  ) => void;
  /** Toggle selection state for a candidate (only matched songs can be selected) */
  toggleSelection: (candidateId: string) => void;
  /** Select all matched candidates */
  selectAll: () => void;
  /** Deselect all candidates */
  deselectAll: () => void;
  /** Clear all candidates */
  clearCandidates: () => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Insert candidates after a specific candidate, auto-selected */
  insertCandidatesAfter: (
    afterCandidateId: string,
    songs: Array<{ song: Song; spotifyTrack: SpotifyTrack | null }>
  ) => void;
  /** Cancel searching - marks all searching candidates as not searching anymore */
  cancelSearching: () => void;
}

type CandidateStore = CandidateState & CandidateActions;

/** Generate a unique ID for a candidate song */
function generateCandidateId(): string {
  return `candidate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Candidate store for managing current generation candidates.
 * Candidates are songs suggested by the LLM and searched on Spotify.
 * - isMatched: Whether the song was found on Spotify
 * - isSelected: Whether the user has selected this song to add to playlist
 */
export const useCandidateStore = create<CandidateStore>((set, get) => ({
  // Initial state
  candidates: [],
  isLoading: false,

  // Actions
  setCandidates: (songs) =>
    set({
      candidates: songs.map((item) => ({
        id: generateCandidateId(),
        song: item.song,
        spotifyTrack: item.spotifyTrack,
        isMatched: item.spotifyTrack !== null,
        isSelected: false,
      })),
      isLoading: false,
    }),

  initCandidates: (songs) =>
    set({
      candidates: songs.map((song) => ({
        id: generateCandidateId(),
        song,
        spotifyTrack: null,
        isMatched: false, // Will be updated when search result arrives
        isSelected: false,
        isSearching: true, // Flag to indicate search in progress
      })),
      isLoading: true, // Keep overall loading state true
    }),

  updateCandidate: (index, spotifyTrack) =>
    set((state) => {
      if (index < 0 || index >= state.candidates.length) {
        return state; // Invalid index, no-op
      }

      const newCandidates = [...state.candidates];
      newCandidates[index] = {
        ...newCandidates[index],
        spotifyTrack,
        isMatched: spotifyTrack !== null,
        isSearching: false,
      };

      // Check if all candidates have finished searching
      const allDone = newCandidates.every((c) => !c.isSearching);

      return {
        candidates: newCandidates,
        isLoading: !allDone,
      };
    }),

  toggleSelection: (candidateId: string) =>
    set((state) => ({
      candidates: state.candidates.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        // Only matched songs can be selected
        if (!candidate.isMatched) return candidate;
        return { ...candidate, isSelected: !candidate.isSelected };
      }),
    })),

  selectAll: () =>
    set((state) => ({
      candidates: state.candidates.map((candidate) =>
        candidate.isMatched ? { ...candidate, isSelected: true } : candidate
      ),
    })),

  deselectAll: () =>
    set((state) => ({
      candidates: state.candidates.map((candidate) => ({
        ...candidate,
        isSelected: false,
      })),
    })),

  clearCandidates: () =>
    set({
      candidates: [],
      isLoading: false,
    }),

  setLoading: (isLoading: boolean) =>
    set({
      isLoading,
    }),

  insertCandidatesAfter: (afterCandidateId, songs) =>
    set((state) => {
      const afterIndex = state.candidates.findIndex(
        (c) => c.id === afterCandidateId
      );
      if (afterIndex === -1) {
        // If candidate not found, just prepend the new songs
        return {
          candidates: [
            ...songs.map((item) => ({
              id: generateCandidateId(),
              song: item.song,
              spotifyTrack: item.spotifyTrack,
              isMatched: item.spotifyTrack !== null,
              isSelected: item.spotifyTrack !== null, // Auto-select matched songs
            })),
            ...state.candidates,
          ],
        };
      }

      // Create new candidates array with songs inserted after the specified candidate
      const newCandidates = [...state.candidates];
      const newSongs = songs.map((item) => ({
        id: generateCandidateId(),
        song: item.song,
        spotifyTrack: item.spotifyTrack,
        isMatched: item.spotifyTrack !== null,
        isSelected: item.spotifyTrack !== null, // Auto-select matched songs
      }));

      // Insert after the found index
      newCandidates.splice(afterIndex + 1, 0, ...newSongs);

      return { candidates: newCandidates };
    }),

  cancelSearching: () =>
    set((state) => ({
      candidates: state.candidates.map((candidate) =>
        candidate.isSearching
          ? { ...candidate, isSearching: false }
          : candidate
      ),
      isLoading: false,
    })),
}));

/**
 * Selector to get all selected candidates.
 * Only returns candidates that are both matched and selected.
 */
export function getSelectedCandidates(state: CandidateState): CandidateSong[] {
  return state.candidates.filter(
    (candidate) => candidate.isMatched && candidate.isSelected
  );
}

/**
 * Selector to get the match rate for current candidates.
 * Returns an object with matched count, total count, and percentage.
 */
export function getMatchRate(state: CandidateState): {
  matched: number;
  total: number;
  percentage: number;
} {
  const total = state.candidates.length;
  const matched = state.candidates.filter((c) => c.isMatched).length;
  const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;
  return { matched, total, percentage };
}
