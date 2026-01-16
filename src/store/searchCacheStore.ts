import { create } from 'zustand';
import type { SpotifyTrack } from '@/types';

/**
 * Cache entry for a Spotify search result
 */
interface CacheEntry {
  /** The Spotify track if found, null if not found */
  spotifyTrack: SpotifyTrack | null;
  /** Timestamp when the entry was cached */
  cachedAt: number;
}

interface SearchCacheState {
  /** Map of normalized search key to cached result */
  cache: Map<string, CacheEntry>;
}

interface SearchCacheActions {
  /** Get a cached search result, returns undefined if not cached */
  getCached: (title: string, artist: string) => CacheEntry | undefined;
  /** Set a search result in the cache */
  setCache: (
    title: string,
    artist: string,
    spotifyTrack: SpotifyTrack | null
  ) => void;
  /** Check if a search result is cached */
  has: (title: string, artist: string) => boolean;
  /** Clear all cached entries (invalidate) */
  clearCache: () => void;
  /** Get the current cache size */
  getCacheSize: () => number;
}

type SearchCacheStore = SearchCacheState & SearchCacheActions;

/**
 * Normalize a string for use as a cache key component.
 * - Lowercase
 * - Trim whitespace
 * - Remove accents/diacritics
 * - Remove punctuation
 * - Collapse multiple spaces to single space
 */
function normalizeForCacheKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Collapse whitespace
}

/**
 * Generate a cache key from title and artist.
 * Uses normalized versions to increase cache hits across minor variations.
 */
export function generateCacheKey(title: string, artist: string): string {
  const normalizedTitle = normalizeForCacheKey(title);
  const normalizedArtist = normalizeForCacheKey(artist);
  return `${normalizedTitle}|${normalizedArtist}`;
}

/**
 * Search cache store for caching Spotify search results.
 * Reduces API calls by returning cached results for previously searched songs.
 *
 * Cache key: normalized (title + artist)
 * Cache is invalidated on session clear ("New Playlist")
 */
export const useSearchCacheStore = create<SearchCacheStore>((set, get) => ({
  // Initial state
  cache: new Map(),

  // Actions
  getCached: (title: string, artist: string) => {
    const key = generateCacheKey(title, artist);
    return get().cache.get(key);
  },

  setCache: (title: string, artist: string, spotifyTrack: SpotifyTrack | null) =>
    set((state) => {
      const key = generateCacheKey(title, artist);
      const newCache = new Map(state.cache);
      newCache.set(key, {
        spotifyTrack,
        cachedAt: Date.now(),
      });
      return { cache: newCache };
    }),

  has: (title: string, artist: string) => {
    const key = generateCacheKey(title, artist);
    return get().cache.has(key);
  },

  clearCache: () =>
    set({
      cache: new Map(),
    }),

  getCacheSize: () => {
    return get().cache.size;
  },
}));

/**
 * Export the storage key for testing purposes
 */
export const SEARCH_CACHE_STORAGE_KEY = 'search-cache-store';
