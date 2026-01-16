import { renderHook, act } from '@testing-library/react';
import { usePlaylist } from './usePlaylist';
import { usePlaylistStore } from '@/store/playlistStore';
import { useCandidateStore } from '@/store/candidateStore';
import { useSearchCacheStore } from '@/store/searchCacheStore';
import type { Song, SpotifyTrack } from '@/types';

// Helper to create mock SpotifyTrack
function createMockSpotifyTrack(id: string, name: string): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    artists: [{ id: 'artist1', name: 'Test Artist' }],
    album: {
      id: 'album1',
      name: 'Test Album',
      images: [{ url: 'https://example.com/image.jpg', width: 300, height: 300 }],
    },
    duration_ms: 180000,
  };
}

// Helper to create mock Song
function createMockSong(title: string, artist: string = 'Test Artist'): Song {
  return { title, artist };
}

describe('usePlaylist', () => {
  beforeEach(() => {
    // Reset all stores before each test
    usePlaylistStore.setState({
      name: '',
      spotifyPlaylistId: null,
      isOwned: true,
      songs: [],
    });

    useCandidateStore.setState({
      candidates: [],
      isLoading: false,
    });

    useSearchCacheStore.setState({
      cache: new Map(),
    });
  });

  describe('initial state', () => {
    it('should return initial playlist state', () => {
      const { result } = renderHook(() => usePlaylist());

      expect(result.current.name).toBe('');
      expect(result.current.spotifyPlaylistId).toBeNull();
      expect(result.current.isOwned).toBe(true);
      expect(result.current.songs).toEqual([]);
      expect(result.current.hasPendingChanges).toBe(false);
      expect(result.current.songCounts).toEqual({
        synced: 0,
        pending: 0,
        markedForRemoval: 0,
        total: 0,
      });
    });

    it('should return required functions', () => {
      const { result } = renderHook(() => usePlaylist());

      expect(typeof result.current.setName).toBe('function');
      expect(typeof result.current.addSelectedToPlaylist).toBe('function');
      expect(typeof result.current.toggleRemoval).toBe('function');
      expect(typeof result.current.removePending).toBe('function');
      expect(typeof result.current.clearPlaylist).toBe('function');
    });
  });

  describe('setName', () => {
    it('should update playlist name', () => {
      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.setName('My Playlist');
      });

      expect(result.current.name).toBe('My Playlist');
    });
  });

  describe('addSelectedToPlaylist', () => {
    it('should add selected candidates to playlist', () => {
      // Set up candidates with selections
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            isMatched: true,
            isSelected: true,
          },
          {
            id: 'candidate2',
            song: createMockSong('Song 2'),
            spotifyTrack: createMockSpotifyTrack('track2', 'Song 2'),
            isMatched: true,
            isSelected: true,
          },
          {
            id: 'candidate3',
            song: createMockSong('Song 3'),
            spotifyTrack: createMockSpotifyTrack('track3', 'Song 3'),
            isMatched: true,
            isSelected: false, // Not selected
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      // Should have added 2 songs (the selected ones)
      expect(result.current.songs).toHaveLength(2);
      expect(result.current.songs[0].song.title).toBe('Song 1');
      expect(result.current.songs[1].song.title).toBe('Song 2');
      // All added songs should have 'pending' state
      expect(result.current.songs[0].state).toBe('pending');
      expect(result.current.songs[1].state).toBe('pending');
    });

    it('should clear selection after adding', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      // Candidates should be deselected
      const candidateState = useCandidateStore.getState();
      expect(candidateState.candidates[0].isSelected).toBe(false);
    });

    it('should not add unmatched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('Unmatched Song'),
            spotifyTrack: null, // Not matched
            isMatched: false,
            isSelected: true, // Selected but can't be added
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      // Should not have added any songs
      expect(result.current.songs).toHaveLength(0);
    });

    it('should do nothing when no candidates are selected', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            isMatched: true,
            isSelected: false, // Not selected
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      expect(result.current.songs).toHaveLength(0);
    });

    it('should do nothing when candidates array is empty', () => {
      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      expect(result.current.songs).toHaveLength(0);
    });
  });

  describe('toggleRemoval', () => {
    it('should toggle synced song to markedForRemoval', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'synced',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.toggleRemoval('song1');
      });

      expect(result.current.songs[0].state).toBe('markedForRemoval');
    });

    it('should toggle markedForRemoval back to synced', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'markedForRemoval',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.toggleRemoval('song1');
      });

      expect(result.current.songs[0].state).toBe('synced');
    });

    it('should not affect pending songs', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: null,
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'pending',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.toggleRemoval('song1');
      });

      // State should remain 'pending'
      expect(result.current.songs[0].state).toBe('pending');
    });
  });

  describe('removePending', () => {
    it('should remove pending song from playlist', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: null,
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'pending',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.removePending('song1');
      });

      expect(result.current.songs).toHaveLength(0);
    });

    it('should not remove synced songs', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'synced',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.removePending('song1');
      });

      // Song should still be there since it's synced, not pending
      expect(result.current.songs).toHaveLength(1);
    });
  });

  describe('clearPlaylist', () => {
    it('should clear playlist store', () => {
      usePlaylistStore.setState({
        name: 'Test Playlist',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'synced',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.clearPlaylist();
      });

      expect(result.current.name).toBe('');
      expect(result.current.spotifyPlaylistId).toBeNull();
      expect(result.current.isOwned).toBe(true);
      expect(result.current.songs).toHaveLength(0);
    });

    it('should clear candidate store', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.clearPlaylist();
      });

      const candidateState = useCandidateStore.getState();
      expect(candidateState.candidates).toHaveLength(0);
    });

    it('should clear search cache store', () => {
      // Populate the search cache
      useSearchCacheStore.getState().setCache('Song 1', 'Artist 1', createMockSpotifyTrack('track1', 'Song 1'));
      useSearchCacheStore.getState().setCache('Song 2', 'Artist 2', null);

      expect(useSearchCacheStore.getState().getCacheSize()).toBe(2);

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.clearPlaylist();
      });

      // Search cache should be cleared
      expect(useSearchCacheStore.getState().getCacheSize()).toBe(0);
    });
  });

  describe('hasPendingChanges', () => {
    it('should be true when there are pending songs', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: null,
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'pending',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      expect(result.current.hasPendingChanges).toBe(true);
    });

    it('should be true when there are songs marked for removal', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'markedForRemoval',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      expect(result.current.hasPendingChanges).toBe(true);
    });

    it('should be false when all songs are synced', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'synced',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      expect(result.current.hasPendingChanges).toBe(false);
    });

    it('should be false when playlist is empty', () => {
      const { result } = renderHook(() => usePlaylist());

      expect(result.current.hasPendingChanges).toBe(false);
    });
  });

  describe('songCounts', () => {
    it('should correctly count songs by state', () => {
      usePlaylistStore.setState({
        name: 'Test',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'song1',
            song: createMockSong('Song 1'),
            spotifyTrack: createMockSpotifyTrack('track1', 'Song 1'),
            state: 'synced',
          },
          {
            id: 'song2',
            song: createMockSong('Song 2'),
            spotifyTrack: createMockSpotifyTrack('track2', 'Song 2'),
            state: 'synced',
          },
          {
            id: 'song3',
            song: createMockSong('Song 3'),
            spotifyTrack: createMockSpotifyTrack('track3', 'Song 3'),
            state: 'pending',
          },
          {
            id: 'song4',
            song: createMockSong('Song 4'),
            spotifyTrack: createMockSpotifyTrack('track4', 'Song 4'),
            state: 'markedForRemoval',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      expect(result.current.songCounts).toEqual({
        synced: 2,
        pending: 1,
        markedForRemoval: 1,
        total: 4,
      });
    });

    it('should return zero counts for empty playlist', () => {
      const { result } = renderHook(() => usePlaylist());

      expect(result.current.songCounts).toEqual({
        synced: 0,
        pending: 0,
        markedForRemoval: 0,
        total: 0,
      });
    });
  });

  describe('integration with stores', () => {
    it('should properly wire addSongs from playlistStore', () => {
      // Set up a candidate
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate1',
            song: createMockSong('New Song'),
            spotifyTrack: createMockSpotifyTrack('newTrack', 'New Song'),
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      // Set up existing playlist
      usePlaylistStore.setState({
        name: 'Existing Playlist',
        spotifyPlaylistId: 'playlist1',
        isOwned: true,
        songs: [
          {
            id: 'existing1',
            song: createMockSong('Existing Song'),
            spotifyTrack: createMockSpotifyTrack('existingTrack', 'Existing Song'),
            state: 'synced',
          },
        ],
      });

      const { result } = renderHook(() => usePlaylist());

      act(() => {
        result.current.addSelectedToPlaylist();
      });

      // Should have both the existing and new song
      expect(result.current.songs).toHaveLength(2);
      expect(result.current.songs[0].song.title).toBe('Existing Song');
      expect(result.current.songs[0].state).toBe('synced');
      expect(result.current.songs[1].song.title).toBe('New Song');
      expect(result.current.songs[1].state).toBe('pending');
    });
  });
});
