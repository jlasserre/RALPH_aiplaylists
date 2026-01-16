import { create } from 'zustand';
import type { Song } from '@/types';

interface TaggedSong {
  spotifyTrackId: string;
  song: Song;
}

interface TagState {
  /** Set of tagged songs by their Spotify track ID */
  taggedSongs: TaggedSong[];
}

interface TagActions {
  /** Toggle tag state for a song */
  toggleTag: (spotifyTrackId: string, song: Song) => void;
  /** Check if a song is tagged */
  isTagged: (spotifyTrackId: string) => boolean;
  /** Clear all tags */
  clearTags: () => void;
}

type TagStore = TagState & TagActions;

/**
 * Tag store for managing tagged songs across panels.
 * Used for "Generate Prompt From Tagged" feature.
 */
export const useTagStore = create<TagStore>((set, get) => ({
  taggedSongs: [],

  toggleTag: (spotifyTrackId: string, song: Song) =>
    set((state) => {
      const isCurrentlyTagged = state.taggedSongs.some(
        (t) => t.spotifyTrackId === spotifyTrackId
      );

      if (isCurrentlyTagged) {
        // Remove tag
        return {
          taggedSongs: state.taggedSongs.filter(
            (t) => t.spotifyTrackId !== spotifyTrackId
          ),
        };
      } else {
        // Add tag
        return {
          taggedSongs: [...state.taggedSongs, { spotifyTrackId, song }],
        };
      }
    }),

  isTagged: (spotifyTrackId: string) => {
    return get().taggedSongs.some((t) => t.spotifyTrackId === spotifyTrackId);
  },

  clearTags: () =>
    set({
      taggedSongs: [],
    }),
}));

/**
 * Selector to get the count of tagged songs
 */
export function getTaggedCount(state: TagState): number {
  return state.taggedSongs.length;
}

/**
 * Selector to get all tagged songs
 */
export function getTaggedSongs(state: TagState): TaggedSong[] {
  return state.taggedSongs;
}
