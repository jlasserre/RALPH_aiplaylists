import { usePlaylistStore, PLAYLIST_STORAGE_KEY } from './playlistStore';
import type { Song, SpotifyTrack } from '@/types';

// Helper to create test song data
function createTestSong(title: string, artist: string): { song: Song; spotifyTrack: SpotifyTrack } {
  return {
    song: {
      title,
      artist,
      album: 'Test Album',
      year: 2023,
    },
    spotifyTrack: {
      id: `track_${title.replace(/\s/g, '_')}`,
      uri: `spotify:track:${title.replace(/\s/g, '_')}`,
      name: title,
      artists: [{ id: 'artist_1', name: artist }],
      album: {
        id: 'album_1',
        name: 'Test Album',
        images: [{ url: 'https://example.com/image.jpg', width: 300, height: 300 }],
      },
      duration_ms: 180000,
    },
  };
}

describe('playlistStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    usePlaylistStore.setState({
      name: '',
      spotifyPlaylistId: null,
      isOwned: true,
      songs: [],
    });
  });

  describe('initial state', () => {
    it('should have empty name initially', () => {
      const { name } = usePlaylistStore.getState();
      expect(name).toBe('');
    });

    it('should have null spotifyPlaylistId initially', () => {
      const { spotifyPlaylistId } = usePlaylistStore.getState();
      expect(spotifyPlaylistId).toBeNull();
    });

    it('should be owned by default', () => {
      const { isOwned } = usePlaylistStore.getState();
      expect(isOwned).toBe(true);
    });

    it('should have empty songs array initially', () => {
      const { songs } = usePlaylistStore.getState();
      expect(songs).toEqual([]);
    });
  });

  describe('setName', () => {
    it('should set the playlist name', () => {
      usePlaylistStore.getState().setName('Summer Vibes');
      const { name } = usePlaylistStore.getState();
      expect(name).toBe('Summer Vibes');
    });

    it('should update name when called multiple times', () => {
      usePlaylistStore.getState().setName('First Name');
      usePlaylistStore.getState().setName('Second Name');
      const { name } = usePlaylistStore.getState();
      expect(name).toBe('Second Name');
    });

    it('should not affect other state properties', () => {
      usePlaylistStore.getState().setPlaylistId('playlist_123');
      usePlaylistStore.getState().setName('Test Playlist');

      const { name, spotifyPlaylistId } = usePlaylistStore.getState();
      expect(name).toBe('Test Playlist');
      expect(spotifyPlaylistId).toBe('playlist_123');
    });
  });

  describe('setPlaylistId', () => {
    it('should set the spotify playlist ID', () => {
      usePlaylistStore.getState().setPlaylistId('playlist_abc123');
      const { spotifyPlaylistId } = usePlaylistStore.getState();
      expect(spotifyPlaylistId).toBe('playlist_abc123');
    });

    it('should allow setting to null', () => {
      usePlaylistStore.getState().setPlaylistId('playlist_abc123');
      usePlaylistStore.getState().setPlaylistId(null);
      const { spotifyPlaylistId } = usePlaylistStore.getState();
      expect(spotifyPlaylistId).toBeNull();
    });

    it('should not affect other state properties', () => {
      usePlaylistStore.getState().setName('Test Playlist');
      usePlaylistStore.getState().setPlaylistId('playlist_123');

      const { name, spotifyPlaylistId } = usePlaylistStore.getState();
      expect(name).toBe('Test Playlist');
      expect(spotifyPlaylistId).toBe('playlist_123');
    });
  });

  describe('setIsOwned', () => {
    it('should set isOwned to false', () => {
      usePlaylistStore.getState().setIsOwned(false);
      const { isOwned } = usePlaylistStore.getState();
      expect(isOwned).toBe(false);
    });

    it('should set isOwned back to true', () => {
      usePlaylistStore.getState().setIsOwned(false);
      usePlaylistStore.getState().setIsOwned(true);
      const { isOwned } = usePlaylistStore.getState();
      expect(isOwned).toBe(true);
    });
  });

  describe('addSongs', () => {
    it('should add songs with pending state', () => {
      const testSong = createTestSong('Bohemian Rhapsody', 'Queen');
      usePlaylistStore.getState().addSongs([testSong]);

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
      expect(songs[0].song.title).toBe('Bohemian Rhapsody');
      expect(songs[0].song.artist).toBe('Queen');
      expect(songs[0].state).toBe('pending');
    });

    it('should generate unique IDs for each song', () => {
      const song1 = createTestSong('Song 1', 'Artist 1');
      const song2 = createTestSong('Song 2', 'Artist 2');

      usePlaylistStore.getState().addSongs([song1, song2]);

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].id).not.toBe(songs[1].id);
      expect(songs[0].id).toMatch(/^song_\d+_[a-z0-9]+$/);
    });

    it('should append songs to existing songs', () => {
      const song1 = createTestSong('Song 1', 'Artist 1');
      const song2 = createTestSong('Song 2', 'Artist 2');

      usePlaylistStore.getState().addSongs([song1]);
      usePlaylistStore.getState().addSongs([song2]);

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(2);
      expect(songs[0].song.title).toBe('Song 1');
      expect(songs[1].song.title).toBe('Song 2');
    });

    it('should add multiple songs at once', () => {
      const songs = [
        createTestSong('Song 1', 'Artist 1'),
        createTestSong('Song 2', 'Artist 2'),
        createTestSong('Song 3', 'Artist 3'),
      ];

      usePlaylistStore.getState().addSongs(songs);

      const { songs: storedSongs } = usePlaylistStore.getState();
      expect(storedSongs).toHaveLength(3);
    });

    it('should include spotify track data', () => {
      const testSong = createTestSong('Test Song', 'Test Artist');
      usePlaylistStore.getState().addSongs([testSong]);

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].spotifyTrack).not.toBeNull();
      expect(songs[0].spotifyTrack?.uri).toBe('spotify:track:Test_Song');
    });
  });

  describe('toggleRemoval', () => {
    it('should toggle synced song to markedForRemoval', () => {
      // Set up a synced song
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'synced',
        }],
      });

      usePlaylistStore.getState().toggleRemoval('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('markedForRemoval');
    });

    it('should toggle markedForRemoval song back to synced', () => {
      // Set up a markedForRemoval song
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'markedForRemoval',
        }],
      });

      usePlaylistStore.getState().toggleRemoval('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('synced');
    });

    it('should not affect pending songs', () => {
      // Set up a pending song
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'pending',
        }],
      });

      usePlaylistStore.getState().toggleRemoval('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('pending');
    });

    it('should only affect the specified song', () => {
      // Set up multiple songs
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
        ],
      });

      usePlaylistStore.getState().toggleRemoval('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('markedForRemoval');
      expect(songs[1].state).toBe('synced');
    });

    it('should not affect songs with non-matching ID', () => {
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'synced',
        }],
      });

      usePlaylistStore.getState().toggleRemoval('non_existent_id');

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('synced');
    });
  });

  describe('removePending', () => {
    it('should remove pending song by ID', () => {
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'pending',
        }],
      });

      usePlaylistStore.getState().removePending('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(0);
    });

    it('should not remove synced songs', () => {
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'synced',
        }],
      });

      usePlaylistStore.getState().removePending('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
    });

    it('should not remove markedForRemoval songs', () => {
      usePlaylistStore.setState({
        songs: [{
          id: 'song_1',
          song: { title: 'Test', artist: 'Artist' },
          spotifyTrack: null,
          state: 'markedForRemoval',
        }],
      });

      usePlaylistStore.getState().removePending('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
    });

    it('should only remove the specified pending song', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
        ],
      });

      usePlaylistStore.getState().removePending('song_1');

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
      expect(songs[0].id).toBe('song_2');
    });
  });

  describe('clearPlaylist', () => {
    it('should clear all songs', () => {
      const testSong = createTestSong('Test Song', 'Test Artist');
      usePlaylistStore.getState().addSongs([testSong]);

      usePlaylistStore.getState().clearPlaylist();

      const { songs } = usePlaylistStore.getState();
      expect(songs).toEqual([]);
    });

    it('should clear playlist name', () => {
      usePlaylistStore.getState().setName('Test Playlist');
      usePlaylistStore.getState().clearPlaylist();

      const { name } = usePlaylistStore.getState();
      expect(name).toBe('');
    });

    it('should clear spotify playlist ID', () => {
      usePlaylistStore.getState().setPlaylistId('playlist_123');
      usePlaylistStore.getState().clearPlaylist();

      const { spotifyPlaylistId } = usePlaylistStore.getState();
      expect(spotifyPlaylistId).toBeNull();
    });

    it('should reset isOwned to true', () => {
      usePlaylistStore.getState().setIsOwned(false);
      usePlaylistStore.getState().clearPlaylist();

      const { isOwned } = usePlaylistStore.getState();
      expect(isOwned).toBe(true);
    });

    it('should reset all state in one operation', () => {
      // Set up some state
      usePlaylistStore.getState().setName('My Playlist');
      usePlaylistStore.getState().setPlaylistId('playlist_abc');
      usePlaylistStore.getState().setIsOwned(false);
      usePlaylistStore.getState().addSongs([createTestSong('Song', 'Artist')]);

      usePlaylistStore.getState().clearPlaylist();

      const state = usePlaylistStore.getState();
      expect(state.name).toBe('');
      expect(state.spotifyPlaylistId).toBeNull();
      expect(state.isOwned).toBe(true);
      expect(state.songs).toEqual([]);
    });
  });

  describe('loadSongs', () => {
    it('should load songs with synced state for owned playlist', () => {
      const songs = [
        createTestSong('Song 1', 'Artist 1'),
        createTestSong('Song 2', 'Artist 2'),
      ];

      usePlaylistStore.getState().loadSongs(songs, true);

      const { songs: storedSongs, isOwned } = usePlaylistStore.getState();
      expect(storedSongs).toHaveLength(2);
      expect(storedSongs[0].state).toBe('synced');
      expect(storedSongs[1].state).toBe('synced');
      expect(isOwned).toBe(true);
    });

    it('should load songs with pending state for non-owned playlist', () => {
      const songs = [
        createTestSong('Song 1', 'Artist 1'),
        createTestSong('Song 2', 'Artist 2'),
      ];

      usePlaylistStore.getState().loadSongs(songs, false);

      const { songs: storedSongs, isOwned } = usePlaylistStore.getState();
      expect(storedSongs).toHaveLength(2);
      expect(storedSongs[0].state).toBe('pending');
      expect(storedSongs[1].state).toBe('pending');
      expect(isOwned).toBe(false);
    });

    it('should replace existing songs', () => {
      const existingSong = createTestSong('Existing', 'Artist');
      usePlaylistStore.getState().addSongs([existingSong]);

      const newSongs = [createTestSong('New Song', 'New Artist')];
      usePlaylistStore.getState().loadSongs(newSongs, true);

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
      expect(songs[0].song.title).toBe('New Song');
    });

    it('should set isOwned based on parameter', () => {
      usePlaylistStore.getState().loadSongs([], false);
      expect(usePlaylistStore.getState().isOwned).toBe(false);

      usePlaylistStore.getState().loadSongs([], true);
      expect(usePlaylistStore.getState().isOwned).toBe(true);
    });
  });

  describe('markPendingAsSynced', () => {
    it('should mark all pending songs as synced', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
        ],
      });

      usePlaylistStore.getState().markPendingAsSynced();

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('synced');
      expect(songs[1].state).toBe('synced');
    });

    it('should not affect synced songs', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
        ],
      });

      usePlaylistStore.getState().markPendingAsSynced();

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('synced');
    });

    it('should not affect markedForRemoval songs', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'markedForRemoval' },
        ],
      });

      usePlaylistStore.getState().markPendingAsSynced();

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('markedForRemoval');
    });

    it('should handle mixed states correctly', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
          { id: 'song_3', song: { title: 'Song 3', artist: 'Artist' }, spotifyTrack: null, state: 'markedForRemoval' },
        ],
      });

      usePlaylistStore.getState().markPendingAsSynced();

      const { songs } = usePlaylistStore.getState();
      expect(songs[0].state).toBe('synced');
      expect(songs[1].state).toBe('synced');
      expect(songs[2].state).toBe('markedForRemoval');
    });
  });

  describe('removeMarkedSongs', () => {
    it('should remove all markedForRemoval songs', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'markedForRemoval' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'markedForRemoval' },
        ],
      });

      usePlaylistStore.getState().removeMarkedSongs();

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(0);
    });

    it('should not affect synced songs', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
        ],
      });

      usePlaylistStore.getState().removeMarkedSongs();

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
    });

    it('should not affect pending songs', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
        ],
      });

      usePlaylistStore.getState().removeMarkedSongs();

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(1);
    });

    it('should handle mixed states correctly', () => {
      usePlaylistStore.setState({
        songs: [
          { id: 'song_1', song: { title: 'Song 1', artist: 'Artist' }, spotifyTrack: null, state: 'synced' },
          { id: 'song_2', song: { title: 'Song 2', artist: 'Artist' }, spotifyTrack: null, state: 'pending' },
          { id: 'song_3', song: { title: 'Song 3', artist: 'Artist' }, spotifyTrack: null, state: 'markedForRemoval' },
        ],
      });

      usePlaylistStore.getState().removeMarkedSongs();

      const { songs } = usePlaylistStore.getState();
      expect(songs).toHaveLength(2);
      expect(songs[0].id).toBe('song_1');
      expect(songs[1].id).toBe('song_2');
    });
  });

  describe('persistence', () => {
    it('should use the correct storage key', () => {
      expect(PLAYLIST_STORAGE_KEY).toBe('playlist-storage');
    });

    it('should persist state to localStorage when setName is called', () => {
      usePlaylistStore.getState().setName('Test Playlist');

      // Zustand persist middleware should call setItem
      expect(localStorage.setItem).toHaveBeenCalled();
      // Get the LAST call with our storage key (not the first one which is the initial state)
      const calls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        (call: string[]) => call[0] === PLAYLIST_STORAGE_KEY
      );
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.state.name).toBe('Test Playlist');
    });

    it('should persist songs to localStorage when addSongs is called', () => {
      const testSong = createTestSong('Bohemian Rhapsody', 'Queen');
      usePlaylistStore.getState().addSongs([testSong]);

      expect(localStorage.setItem).toHaveBeenCalled();
      // Get the LAST call with our storage key
      const calls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        (call: string[]) => call[0] === PLAYLIST_STORAGE_KEY
      );
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.state.songs).toHaveLength(1);
      expect(storedData.state.songs[0].song.title).toBe('Bohemian Rhapsody');
    });

    it('should persist spotifyPlaylistId to localStorage', () => {
      usePlaylistStore.getState().setPlaylistId('playlist_abc123');

      expect(localStorage.setItem).toHaveBeenCalled();
      // Get the LAST call with our storage key
      const calls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        (call: string[]) => call[0] === PLAYLIST_STORAGE_KEY
      );
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.state.spotifyPlaylistId).toBe('playlist_abc123');
    });

    it('should persist isOwned to localStorage', () => {
      usePlaylistStore.getState().setIsOwned(false);

      expect(localStorage.setItem).toHaveBeenCalled();
      // Get the LAST call with our storage key
      const calls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        (call: string[]) => call[0] === PLAYLIST_STORAGE_KEY
      );
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.state.isOwned).toBe(false);
    });

    it('should clear localStorage when clearPlaylist is called', () => {
      // First set some state
      usePlaylistStore.getState().setName('Test Playlist');
      usePlaylistStore.getState().addSongs([createTestSong('Song', 'Artist')]);

      // Clear the playlist
      usePlaylistStore.getState().clearPlaylist();

      // Should persist empty state
      expect(localStorage.setItem).toHaveBeenCalled();
      const calls = (localStorage.setItem as jest.Mock).mock.calls;
      const lastCall = calls.filter((call: string[]) => call[0] === PLAYLIST_STORAGE_KEY).pop();
      expect(lastCall).toBeDefined();
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.state.name).toBe('');
      expect(storedData.state.songs).toEqual([]);
      expect(storedData.state.spotifyPlaylistId).toBeNull();
      expect(storedData.state.isOwned).toBe(true);
    });

    it('should restore state from localStorage on initialization', () => {
      // Set up mock localStorage to return persisted data
      const persistedState = {
        state: {
          name: 'Restored Playlist',
          spotifyPlaylistId: 'playlist_restored',
          isOwned: false,
          songs: [{
            id: 'song_restored',
            song: { title: 'Restored Song', artist: 'Restored Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Restored Song', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            state: 'synced',
          }],
        },
        version: 0,
      };

      // Mock getItem to return persisted data
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(persistedState));

      // Rehydrate the store
      usePlaylistStore.persist.rehydrate();

      const state = usePlaylistStore.getState();
      expect(state.name).toBe('Restored Playlist');
      expect(state.spotifyPlaylistId).toBe('playlist_restored');
      expect(state.isOwned).toBe(false);
      expect(state.songs).toHaveLength(1);
      expect(state.songs[0].song.title).toBe('Restored Song');
    });

    it('should not persist actions, only state data', () => {
      usePlaylistStore.getState().setName('Test');

      const lastCall = (localStorage.setItem as jest.Mock).mock.calls.find(
        (call: string[]) => call[0] === PLAYLIST_STORAGE_KEY
      );
      expect(lastCall).toBeDefined();
      const storedData = JSON.parse(lastCall[1]);

      // Should have state properties
      expect(storedData.state).toHaveProperty('name');
      expect(storedData.state).toHaveProperty('spotifyPlaylistId');
      expect(storedData.state).toHaveProperty('isOwned');
      expect(storedData.state).toHaveProperty('songs');

      // Should NOT have action functions
      expect(storedData.state).not.toHaveProperty('setName');
      expect(storedData.state).not.toHaveProperty('addSongs');
      expect(storedData.state).not.toHaveProperty('clearPlaylist');
    });
  });
});
