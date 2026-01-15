/**
 * Sample test file to verify Jest setup works correctly
 */

import type { Song, LLMProvider, SongState, PlaylistSong, CandidateSong } from './index';

describe('Type definitions', () => {
  describe('Song interface', () => {
    it('should allow creating a song with required fields', () => {
      const song: Song = {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
      };

      expect(song.title).toBe('Bohemian Rhapsody');
      expect(song.artist).toBe('Queen');
    });

    it('should allow creating a song with optional fields', () => {
      const song: Song = {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        year: 1975,
      };

      expect(song.album).toBe('A Night at the Opera');
      expect(song.year).toBe(1975);
    });
  });

  describe('LLMProvider type', () => {
    it('should accept claude as a valid provider', () => {
      const provider: LLMProvider = 'claude';
      expect(provider).toBe('claude');
    });

    it('should accept openai as a valid provider', () => {
      const provider: LLMProvider = 'openai';
      expect(provider).toBe('openai');
    });
  });

  describe('SongState type', () => {
    it('should accept all valid song states', () => {
      const states: SongState[] = ['synced', 'pending', 'markedForRemoval'];
      expect(states).toHaveLength(3);
    });
  });

  describe('PlaylistSong interface', () => {
    it('should allow creating a playlist song with synced state', () => {
      const playlistSong: PlaylistSong = {
        id: '123',
        song: { title: 'Test', artist: 'Artist' },
        spotifyTrack: null,
        state: 'synced',
      };

      expect(playlistSong.id).toBe('123');
      expect(playlistSong.state).toBe('synced');
    });
  });

  describe('CandidateSong interface', () => {
    it('should allow creating a candidate song', () => {
      const candidate: CandidateSong = {
        id: '456',
        song: { title: 'Candidate Song', artist: 'Some Artist' },
        spotifyTrack: null,
        isSelected: false,
        isMatched: false,
      };

      expect(candidate.isSelected).toBe(false);
      expect(candidate.isMatched).toBe(false);
    });
  });
});

describe('localStorage mock', () => {
  it('should have localStorage available', () => {
    expect(window.localStorage).toBeDefined();
  });

  it('should track setItem calls', () => {
    window.localStorage.setItem('test-key', 'test-value');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
  });

  it('should track getItem calls', () => {
    window.localStorage.getItem('test-key');
    expect(window.localStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('should clear mocks between tests', () => {
    // The beforeEach in jest.setup.js should clear mocks
    // So setItem should not have previous calls
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
});
