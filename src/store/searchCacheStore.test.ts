import { useSearchCacheStore, generateCacheKey } from './searchCacheStore';
import type { SpotifyTrack } from '@/types';

describe('searchCacheStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useSearchCacheStore.setState({ cache: new Map() });
  });

  describe('generateCacheKey', () => {
    it('should generate key from title and artist', () => {
      const key = generateCacheKey('Hello', 'Adele');
      expect(key).toBe('hello|adele');
    });

    it('should normalize whitespace', () => {
      const key1 = generateCacheKey('  Hello  ', '  Adele  ');
      const key2 = generateCacheKey('Hello', 'Adele');
      expect(key1).toBe(key2);
    });

    it('should be case insensitive', () => {
      const key1 = generateCacheKey('HELLO', 'ADELE');
      const key2 = generateCacheKey('hello', 'adele');
      expect(key1).toBe(key2);
    });

    it('should remove diacritics/accents', () => {
      const key1 = generateCacheKey('Héllo', 'Adèle');
      const key2 = generateCacheKey('Hello', 'Adele');
      expect(key1).toBe(key2);
    });

    it('should remove punctuation', () => {
      const key1 = generateCacheKey("Don't Stop Me Now", 'Queen!');
      const key2 = generateCacheKey('Dont Stop Me Now', 'Queen');
      expect(key1).toBe(key2);
    });

    it('should collapse multiple spaces', () => {
      const key1 = generateCacheKey('Hello   World', 'Adele   Singer');
      const key2 = generateCacheKey('Hello World', 'Adele Singer');
      expect(key1).toBe(key2);
    });
  });

  describe('setCache / getCached', () => {
    const mockTrack: SpotifyTrack = {
      id: 'track123',
      uri: 'spotify:track:track123',
      name: 'Hello',
      artists: [{ id: 'artist1', name: 'Adele' }],
      album: {
        id: 'album1',
        name: '25',
        images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      },
      duration_ms: 295000,
    };

    it('should cache a search result', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);

      const cached = useSearchCacheStore.getState().getCached('Hello', 'Adele');
      expect(cached).toBeDefined();
      expect(cached?.spotifyTrack).toEqual(mockTrack);
    });

    it('should cache null results (not found)', () => {
      useSearchCacheStore.getState().setCache('Unknown Song', 'Unknown Artist', null);

      const cached = useSearchCacheStore.getState().getCached('Unknown Song', 'Unknown Artist');
      expect(cached).toBeDefined();
      expect(cached?.spotifyTrack).toBeNull();
    });

    it('should return undefined for uncached entries', () => {
      const cached = useSearchCacheStore.getState().getCached('Not Cached', 'Artist');
      expect(cached).toBeUndefined();
    });

    it('should include timestamp in cache entry', () => {
      const beforeTime = Date.now();
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);
      const afterTime = Date.now();

      const cached = useSearchCacheStore.getState().getCached('Hello', 'Adele');
      expect(cached?.cachedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(cached?.cachedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should find cache hit with normalized keys', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);

      // Same song with different formatting should hit cache
      const cached1 = useSearchCacheStore.getState().getCached('HELLO', 'ADELE');
      expect(cached1?.spotifyTrack).toEqual(mockTrack);

      const cached2 = useSearchCacheStore.getState().getCached('  hello  ', '  adele  ');
      expect(cached2?.spotifyTrack).toEqual(mockTrack);

      const cached3 = useSearchCacheStore.getState().getCached('Héllo', 'Adèle');
      expect(cached3?.spotifyTrack).toEqual(mockTrack);
    });

    it('should update existing cache entry', () => {
      const track1: SpotifyTrack = { ...mockTrack, id: 'track1' };
      const track2: SpotifyTrack = { ...mockTrack, id: 'track2' };

      useSearchCacheStore.getState().setCache('Hello', 'Adele', track1);
      useSearchCacheStore.getState().setCache('Hello', 'Adele', track2);

      const cached = useSearchCacheStore.getState().getCached('Hello', 'Adele');
      expect(cached?.spotifyTrack?.id).toBe('track2');
    });
  });

  describe('has', () => {
    const mockTrack: SpotifyTrack = {
      id: 'track123',
      uri: 'spotify:track:track123',
      name: 'Hello',
      artists: [{ id: 'artist1', name: 'Adele' }],
      album: {
        id: 'album1',
        name: '25',
        images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      },
      duration_ms: 295000,
    };

    it('should return true for cached entries', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);
      expect(useSearchCacheStore.getState().has('Hello', 'Adele')).toBe(true);
    });

    it('should return true for cached null entries', () => {
      useSearchCacheStore.getState().setCache('Unknown', 'Artist', null);
      expect(useSearchCacheStore.getState().has('Unknown', 'Artist')).toBe(true);
    });

    it('should return false for uncached entries', () => {
      expect(useSearchCacheStore.getState().has('Not Cached', 'Artist')).toBe(false);
    });

    it('should use normalized keys', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);
      expect(useSearchCacheStore.getState().has('HELLO', 'ADELE')).toBe(true);
    });
  });

  describe('clearCache', () => {
    const mockTrack: SpotifyTrack = {
      id: 'track123',
      uri: 'spotify:track:track123',
      name: 'Hello',
      artists: [{ id: 'artist1', name: 'Adele' }],
      album: {
        id: 'album1',
        name: '25',
        images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      },
      duration_ms: 295000,
    };

    it('should clear all cached entries', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);
      useSearchCacheStore.getState().setCache('Another Song', 'Another Artist', null);

      expect(useSearchCacheStore.getState().getCacheSize()).toBe(2);

      useSearchCacheStore.getState().clearCache();

      expect(useSearchCacheStore.getState().getCacheSize()).toBe(0);
      expect(useSearchCacheStore.getState().getCached('Hello', 'Adele')).toBeUndefined();
      expect(useSearchCacheStore.getState().getCached('Another Song', 'Another Artist')).toBeUndefined();
    });

    it('should not throw on empty cache', () => {
      expect(() => useSearchCacheStore.getState().clearCache()).not.toThrow();
    });
  });

  describe('getCacheSize', () => {
    const mockTrack: SpotifyTrack = {
      id: 'track123',
      uri: 'spotify:track:track123',
      name: 'Hello',
      artists: [{ id: 'artist1', name: 'Adele' }],
      album: {
        id: 'album1',
        name: '25',
        images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      },
      duration_ms: 295000,
    };

    it('should return 0 for empty cache', () => {
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(0);
    });

    it('should return correct size after adding entries', () => {
      useSearchCacheStore.getState().setCache('Song 1', 'Artist 1', mockTrack);
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(1);

      useSearchCacheStore.getState().setCache('Song 2', 'Artist 2', null);
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(2);

      useSearchCacheStore.getState().setCache('Song 3', 'Artist 3', mockTrack);
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(3);
    });

    it('should not increase size for duplicate normalized keys', () => {
      useSearchCacheStore.getState().setCache('Hello', 'Adele', mockTrack);
      useSearchCacheStore.getState().setCache('HELLO', 'ADELE', mockTrack);
      useSearchCacheStore.getState().setCache('  hello  ', '  adele  ', mockTrack);

      expect(useSearchCacheStore.getState().getCacheSize()).toBe(1);
    });
  });

  describe('cache invalidation on session clear', () => {
    const mockTrack: SpotifyTrack = {
      id: 'track123',
      uri: 'spotify:track:track123',
      name: 'Hello',
      artists: [{ id: 'artist1', name: 'Adele' }],
      album: {
        id: 'album1',
        name: '25',
        images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      },
      duration_ms: 295000,
    };

    it('should support being cleared when clearCache is called (simulating New Playlist)', () => {
      // Add some cache entries
      useSearchCacheStore.getState().setCache('Song 1', 'Artist 1', mockTrack);
      useSearchCacheStore.getState().setCache('Song 2', 'Artist 2', null);
      useSearchCacheStore.getState().setCache('Song 3', 'Artist 3', mockTrack);

      expect(useSearchCacheStore.getState().getCacheSize()).toBe(3);

      // Simulate session clear
      useSearchCacheStore.getState().clearCache();

      // Verify cache is empty
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(0);
      expect(useSearchCacheStore.getState().has('Song 1', 'Artist 1')).toBe(false);
      expect(useSearchCacheStore.getState().has('Song 2', 'Artist 2')).toBe(false);
      expect(useSearchCacheStore.getState().has('Song 3', 'Artist 3')).toBe(false);
    });
  });
});
