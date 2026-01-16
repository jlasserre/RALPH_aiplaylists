import {
  useCandidateStore,
  getSelectedCandidates,
  getMatchRate,
} from './candidateStore';
import type { Song, SpotifyTrack } from '@/types';

// Helper to create test song data with Spotify track (matched)
function createMatchedSong(
  title: string,
  artist: string
): { song: Song; spotifyTrack: SpotifyTrack } {
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

// Helper to create unmatched song data (not found on Spotify)
function createUnmatchedSong(
  title: string,
  artist: string
): { song: Song; spotifyTrack: null } {
  return {
    song: {
      title,
      artist,
      album: 'Test Album',
      year: 2023,
    },
    spotifyTrack: null,
  };
}

describe('candidateStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useCandidateStore.setState({
      candidates: [],
      isLoading: false,
    });
  });

  describe('initial state', () => {
    it('should have empty candidates array initially', () => {
      const { candidates } = useCandidateStore.getState();
      expect(candidates).toEqual([]);
    });

    it('should have isLoading as false initially', () => {
      const { isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set isLoading to true', () => {
      useCandidateStore.getState().setLoading(true);
      const { isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(true);
    });

    it('should set isLoading to false', () => {
      useCandidateStore.getState().setLoading(true);
      useCandidateStore.getState().setLoading(false);
      const { isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should not affect candidates', () => {
      const song = createMatchedSong('Test Song', 'Test Artist');
      useCandidateStore.getState().setCandidates([song]);
      useCandidateStore.getState().setLoading(true);

      const { candidates, isLoading } = useCandidateStore.getState();
      expect(candidates).toHaveLength(1);
      expect(isLoading).toBe(true);
    });
  });

  describe('setCandidates', () => {
    it('should set matched candidates from songs', () => {
      const song = createMatchedSong('Bohemian Rhapsody', 'Queen');
      useCandidateStore.getState().setCandidates([song]);

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].song.title).toBe('Bohemian Rhapsody');
      expect(candidates[0].song.artist).toBe('Queen');
      expect(candidates[0].isMatched).toBe(true);
      expect(candidates[0].isSelected).toBe(false);
    });

    it('should set unmatched candidates from songs', () => {
      const song = createUnmatchedSong('Unknown Song', 'Unknown Artist');
      useCandidateStore.getState().setCandidates([song]);

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].song.title).toBe('Unknown Song');
      expect(candidates[0].isMatched).toBe(false);
      expect(candidates[0].spotifyTrack).toBeNull();
    });

    it('should generate unique IDs for each candidate', () => {
      const song1 = createMatchedSong('Song 1', 'Artist 1');
      const song2 = createMatchedSong('Song 2', 'Artist 2');

      useCandidateStore.getState().setCandidates([song1, song2]);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].id).not.toBe(candidates[1].id);
      expect(candidates[0].id).toMatch(/^candidate_\d+_[a-z0-9]+$/);
    });

    it('should replace existing candidates', () => {
      const existingSong = createMatchedSong('Existing', 'Artist');
      useCandidateStore.getState().setCandidates([existingSong]);

      const newSongs = [
        createMatchedSong('New Song 1', 'New Artist 1'),
        createMatchedSong('New Song 2', 'New Artist 2'),
      ];
      useCandidateStore.getState().setCandidates(newSongs);

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toHaveLength(2);
      expect(candidates[0].song.title).toBe('New Song 1');
      expect(candidates[1].song.title).toBe('New Song 2');
    });

    it('should set isLoading to false', () => {
      useCandidateStore.getState().setLoading(true);
      useCandidateStore.getState().setCandidates([createMatchedSong('Test', 'Artist')]);

      const { isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should handle mixed matched and unmatched songs', () => {
      const songs = [
        createMatchedSong('Matched Song', 'Artist 1'),
        createUnmatchedSong('Unmatched Song', 'Artist 2'),
      ];

      useCandidateStore.getState().setCandidates(songs);

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toHaveLength(2);
      expect(candidates[0].isMatched).toBe(true);
      expect(candidates[1].isMatched).toBe(false);
    });

    it('should set all candidates as not selected initially', () => {
      const songs = [
        createMatchedSong('Song 1', 'Artist 1'),
        createMatchedSong('Song 2', 'Artist 2'),
      ];

      useCandidateStore.getState().setCandidates(songs);

      const { candidates } = useCandidateStore.getState();
      expect(candidates.every((c) => c.isSelected === false)).toBe(true);
    });

    it('should include spotify track data for matched songs', () => {
      const song = createMatchedSong('Test Song', 'Test Artist');
      useCandidateStore.getState().setCandidates([song]);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].spotifyTrack).not.toBeNull();
      expect(candidates[0].spotifyTrack?.uri).toBe('spotify:track:Test_Song');
    });
  });

  describe('toggleSelection', () => {
    it('should toggle selection for matched candidate', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Test', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Test', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().toggleSelection('candidate_1');

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
    });

    it('should toggle selection back to false', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Test', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Test', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().toggleSelection('candidate_1');

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(false);
    });

    it('should not allow selection for unmatched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Test', artist: 'Artist' },
            spotifyTrack: null,
            isMatched: false,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().toggleSelection('candidate_1');

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(false);
    });

    it('should only affect the specified candidate', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist' },
            spotifyTrack: { id: 'track_2', uri: 'spotify:track:2', name: 'Song 2', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().toggleSelection('candidate_1');

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
      expect(candidates[1].isSelected).toBe(false);
    });

    it('should not affect candidates with non-matching ID', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Test', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Test', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().toggleSelection('non_existent_id');

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(false);
    });
  });

  describe('selectAll', () => {
    it('should select all matched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist' },
            spotifyTrack: { id: 'track_2', uri: 'spotify:track:2', name: 'Song 2', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().selectAll();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
      expect(candidates[1].isSelected).toBe(true);
    });

    it('should not select unmatched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist' },
            spotifyTrack: null,
            isMatched: false,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().selectAll();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
      expect(candidates[1].isSelected).toBe(false);
    });

    it('should have no effect when all are already selected', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().selectAll();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
    });
  });

  describe('deselectAll', () => {
    it('should deselect all candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist' },
            spotifyTrack: { id: 'track_2', uri: 'spotify:track:2', name: 'Song 2', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().deselectAll();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(false);
      expect(candidates[1].isSelected).toBe(false);
    });

    it('should have no effect when none are selected', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      useCandidateStore.getState().deselectAll();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(false);
    });
  });

  describe('clearCandidates', () => {
    it('should clear all candidates', () => {
      const song = createMatchedSong('Test Song', 'Test Artist');
      useCandidateStore.getState().setCandidates([song]);

      useCandidateStore.getState().clearCandidates();

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toEqual([]);
    });

    it('should reset isLoading to false', () => {
      useCandidateStore.getState().setLoading(true);
      useCandidateStore.getState().clearCandidates();

      const { isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should clear candidates even if loading', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Test', artist: 'Artist' },
            spotifyTrack: null,
            isMatched: false,
            isSelected: false,
          },
        ],
        isLoading: true,
      });

      useCandidateStore.getState().clearCandidates();

      const { candidates, isLoading } = useCandidateStore.getState();
      expect(candidates).toEqual([]);
      expect(isLoading).toBe(false);
    });
  });

  describe('getSelectedCandidates selector', () => {
    it('should return only selected and matched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist 1' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist 2' },
            spotifyTrack: { id: 'track_2', uri: 'spotify:track:2', name: 'Song 2', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
          {
            id: 'candidate_3',
            song: { title: 'Song 3', artist: 'Artist 3' },
            spotifyTrack: null,
            isMatched: false,
            isSelected: false, // Even if selected somehow, shouldn't be returned because not matched
          },
        ],
        isLoading: false,
      });

      const selected = getSelectedCandidates(useCandidateStore.getState());
      expect(selected).toHaveLength(1);
      expect(selected[0].song.title).toBe('Song 1');
    });

    it('should return empty array when no candidates are selected', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: false,
          },
        ],
        isLoading: false,
      });

      const selected = getSelectedCandidates(useCandidateStore.getState());
      expect(selected).toEqual([]);
    });

    it('should return empty array when candidates array is empty', () => {
      const selected = getSelectedCandidates(useCandidateStore.getState());
      expect(selected).toEqual([]);
    });

    it('should return all selected matched candidates', () => {
      useCandidateStore.setState({
        candidates: [
          {
            id: 'candidate_1',
            song: { title: 'Song 1', artist: 'Artist 1' },
            spotifyTrack: { id: 'track_1', uri: 'spotify:track:1', name: 'Song 1', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
          {
            id: 'candidate_2',
            song: { title: 'Song 2', artist: 'Artist 2' },
            spotifyTrack: { id: 'track_2', uri: 'spotify:track:2', name: 'Song 2', artists: [], album: { id: 'a1', name: 'Album', images: [] }, duration_ms: 180000 },
            isMatched: true,
            isSelected: true,
          },
        ],
        isLoading: false,
      });

      const selected = getSelectedCandidates(useCandidateStore.getState());
      expect(selected).toHaveLength(2);
      expect(selected[0].song.title).toBe('Song 1');
      expect(selected[1].song.title).toBe('Song 2');
    });
  });

  describe('getMatchRate selector', () => {
    it('should return correct match rate for all matched', () => {
      useCandidateStore.setState({
        candidates: [
          { id: 'c1', song: { title: 'S1', artist: 'A1' }, spotifyTrack: { id: 't1', uri: 'u1', name: 'S1', artists: [], album: { id: 'a', name: 'A', images: [] }, duration_ms: 1 }, isMatched: true, isSelected: false },
          { id: 'c2', song: { title: 'S2', artist: 'A2' }, spotifyTrack: { id: 't2', uri: 'u2', name: 'S2', artists: [], album: { id: 'a', name: 'A', images: [] }, duration_ms: 1 }, isMatched: true, isSelected: false },
        ],
        isLoading: false,
      });

      const rate = getMatchRate(useCandidateStore.getState());
      expect(rate.matched).toBe(2);
      expect(rate.total).toBe(2);
      expect(rate.percentage).toBe(100);
    });

    it('should return correct match rate for partial matches', () => {
      useCandidateStore.setState({
        candidates: [
          { id: 'c1', song: { title: 'S1', artist: 'A1' }, spotifyTrack: { id: 't1', uri: 'u1', name: 'S1', artists: [], album: { id: 'a', name: 'A', images: [] }, duration_ms: 1 }, isMatched: true, isSelected: false },
          { id: 'c2', song: { title: 'S2', artist: 'A2' }, spotifyTrack: null, isMatched: false, isSelected: false },
          { id: 'c3', song: { title: 'S3', artist: 'A3' }, spotifyTrack: { id: 't3', uri: 'u3', name: 'S3', artists: [], album: { id: 'a', name: 'A', images: [] }, duration_ms: 1 }, isMatched: true, isSelected: false },
          { id: 'c4', song: { title: 'S4', artist: 'A4' }, spotifyTrack: null, isMatched: false, isSelected: false },
        ],
        isLoading: false,
      });

      const rate = getMatchRate(useCandidateStore.getState());
      expect(rate.matched).toBe(2);
      expect(rate.total).toBe(4);
      expect(rate.percentage).toBe(50);
    });

    it('should return correct match rate for no matches', () => {
      useCandidateStore.setState({
        candidates: [
          { id: 'c1', song: { title: 'S1', artist: 'A1' }, spotifyTrack: null, isMatched: false, isSelected: false },
          { id: 'c2', song: { title: 'S2', artist: 'A2' }, spotifyTrack: null, isMatched: false, isSelected: false },
        ],
        isLoading: false,
      });

      const rate = getMatchRate(useCandidateStore.getState());
      expect(rate.matched).toBe(0);
      expect(rate.total).toBe(2);
      expect(rate.percentage).toBe(0);
    });

    it('should return zeros for empty candidates', () => {
      const rate = getMatchRate(useCandidateStore.getState());
      expect(rate.matched).toBe(0);
      expect(rate.total).toBe(0);
      expect(rate.percentage).toBe(0);
    });

    it('should round percentage to nearest integer', () => {
      useCandidateStore.setState({
        candidates: [
          { id: 'c1', song: { title: 'S1', artist: 'A1' }, spotifyTrack: { id: 't1', uri: 'u1', name: 'S1', artists: [], album: { id: 'a', name: 'A', images: [] }, duration_ms: 1 }, isMatched: true, isSelected: false },
          { id: 'c2', song: { title: 'S2', artist: 'A2' }, spotifyTrack: null, isMatched: false, isSelected: false },
          { id: 'c3', song: { title: 'S3', artist: 'A3' }, spotifyTrack: null, isMatched: false, isSelected: false },
        ],
        isLoading: false,
      });

      const rate = getMatchRate(useCandidateStore.getState());
      expect(rate.matched).toBe(1);
      expect(rate.total).toBe(3);
      expect(rate.percentage).toBe(33); // 33.33% rounded to 33
    });
  });

  describe('insertCandidatesAfter', () => {
    it('should insert candidates after specified candidate', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('Original 1', 'Artist 1');
      const song2 = createMatchedSong('Original 2', 'Artist 2');
      setCandidates([song1, song2]);

      const candidates = useCandidateStore.getState().candidates;
      const firstCandidateId = candidates[0].id;

      const newSong = createMatchedSong('New Song', 'New Artist');
      insertCandidatesAfter(firstCandidateId, [newSong]);

      const result = useCandidateStore.getState().candidates;
      expect(result).toHaveLength(3);
      expect(result[0].song.title).toBe('Original 1');
      expect(result[1].song.title).toBe('New Song');
      expect(result[2].song.title).toBe('Original 2');
    });

    it('should auto-select matched inserted candidates', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('Original 1', 'Artist 1');
      setCandidates([song1]);

      const candidates = useCandidateStore.getState().candidates;
      const firstCandidateId = candidates[0].id;

      const matchedSong = createMatchedSong('Matched', 'Artist');
      const unmatchedSong = createUnmatchedSong('Unmatched', 'Artist');
      insertCandidatesAfter(firstCandidateId, [matchedSong, unmatchedSong]);

      const result = useCandidateStore.getState().candidates;
      expect(result).toHaveLength(3);
      expect(result[1].isSelected).toBe(true);  // matched should be auto-selected
      expect(result[2].isSelected).toBe(false); // unmatched should not be selected
    });

    it('should prepend if candidate id not found', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('Original 1', 'Artist 1');
      setCandidates([song1]);

      const newSong = createMatchedSong('New Song', 'New Artist');
      insertCandidatesAfter('non-existent-id', [newSong]);

      const result = useCandidateStore.getState().candidates;
      expect(result).toHaveLength(2);
      expect(result[0].song.title).toBe('New Song');
      expect(result[1].song.title).toBe('Original 1');
    });

    it('should insert multiple candidates in order', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('Original', 'Artist');
      setCandidates([song1]);

      const candidates = useCandidateStore.getState().candidates;
      const firstCandidateId = candidates[0].id;

      const newSong1 = createMatchedSong('New 1', 'Artist');
      const newSong2 = createMatchedSong('New 2', 'Artist');
      const newSong3 = createMatchedSong('New 3', 'Artist');
      insertCandidatesAfter(firstCandidateId, [newSong1, newSong2, newSong3]);

      const result = useCandidateStore.getState().candidates;
      expect(result).toHaveLength(4);
      expect(result[0].song.title).toBe('Original');
      expect(result[1].song.title).toBe('New 1');
      expect(result[2].song.title).toBe('New 2');
      expect(result[3].song.title).toBe('New 3');
    });

    it('should handle insertion at the end', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('First', 'Artist');
      const song2 = createMatchedSong('Second', 'Artist');
      setCandidates([song1, song2]);

      const candidates = useCandidateStore.getState().candidates;
      const lastCandidateId = candidates[1].id;

      const newSong = createMatchedSong('Third', 'Artist');
      insertCandidatesAfter(lastCandidateId, [newSong]);

      const result = useCandidateStore.getState().candidates;
      expect(result).toHaveLength(3);
      expect(result[0].song.title).toBe('First');
      expect(result[1].song.title).toBe('Second');
      expect(result[2].song.title).toBe('Third');
    });

    it('should generate unique IDs for inserted candidates', () => {
      const { setCandidates, insertCandidatesAfter } = useCandidateStore.getState();
      const song1 = createMatchedSong('Original', 'Artist');
      setCandidates([song1]);

      const candidates = useCandidateStore.getState().candidates;
      const firstCandidateId = candidates[0].id;

      const newSong1 = createMatchedSong('New 1', 'Artist');
      const newSong2 = createMatchedSong('New 2', 'Artist');
      insertCandidatesAfter(firstCandidateId, [newSong1, newSong2]);

      const result = useCandidateStore.getState().candidates;
      const ids = result.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('initCandidates (streaming support)', () => {
    it('should initialize candidates with isSearching flag', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      const { candidates, isLoading } = useCandidateStore.getState();
      expect(candidates).toHaveLength(2);
      expect(candidates[0].song.title).toBe('Song 1');
      expect(candidates[0].isSearching).toBe(true);
      expect(candidates[0].isMatched).toBe(false);
      expect(candidates[0].spotifyTrack).toBeNull();
      expect(candidates[1].isSearching).toBe(true);
      expect(isLoading).toBe(true);
    });

    it('should generate unique IDs for initialized candidates', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].id).not.toBe(candidates[1].id);
      expect(candidates[0].id).toMatch(/^candidate_\d+_[a-z0-9]+$/);
    });

    it('should replace existing candidates', () => {
      const existingSong = createMatchedSong('Existing', 'Artist');
      useCandidateStore.getState().setCandidates([existingSong]);

      const newSongs: Song[] = [{ title: 'New Song', artist: 'New Artist' }];
      useCandidateStore.getState().initCandidates(newSongs);

      const { candidates } = useCandidateStore.getState();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].song.title).toBe('New Song');
      expect(candidates[0].isSearching).toBe(true);
    });
  });

  describe('updateCandidate (streaming support)', () => {
    it('should update candidate with matched Spotify track', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      const spotifyTrack: SpotifyTrack = {
        id: 'track_1',
        uri: 'spotify:track:1',
        name: 'Song 1',
        artists: [{ id: 'a1', name: 'Artist 1' }],
        album: { id: 'album_1', name: 'Album', images: [] },
        duration_ms: 180000,
      };

      useCandidateStore.getState().updateCandidate(0, spotifyTrack);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].spotifyTrack).toEqual(spotifyTrack);
      expect(candidates[0].isMatched).toBe(true);
      expect(candidates[0].isSearching).toBe(false);
      // Second candidate should still be searching
      expect(candidates[1].isSearching).toBe(true);
    });

    it('should update candidate with null for unmatched', () => {
      const songs: Song[] = [{ title: 'Unknown Song', artist: 'Unknown Artist' }];
      useCandidateStore.getState().initCandidates(songs);

      useCandidateStore.getState().updateCandidate(0, null);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].spotifyTrack).toBeNull();
      expect(candidates[0].isMatched).toBe(false);
      expect(candidates[0].isSearching).toBe(false);
    });

    it('should set isLoading to false when all searches complete', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);
      expect(useCandidateStore.getState().isLoading).toBe(true);

      useCandidateStore.getState().updateCandidate(0, null);
      expect(useCandidateStore.getState().isLoading).toBe(true); // Still one pending

      useCandidateStore.getState().updateCandidate(1, null);
      expect(useCandidateStore.getState().isLoading).toBe(false); // All done
    });

    it('should ignore invalid index', () => {
      const songs: Song[] = [{ title: 'Song 1', artist: 'Artist 1' }];
      useCandidateStore.getState().initCandidates(songs);

      useCandidateStore.getState().updateCandidate(-1, null);
      useCandidateStore.getState().updateCandidate(99, null);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSearching).toBe(true); // Unchanged
    });

    it('should allow user to select songs while others are still loading', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      const spotifyTrack: SpotifyTrack = {
        id: 'track_1',
        uri: 'spotify:track:1',
        name: 'Song 1',
        artists: [{ id: 'a1', name: 'Artist 1' }],
        album: { id: 'album_1', name: 'Album', images: [] },
        duration_ms: 180000,
      };

      // First song completes
      useCandidateStore.getState().updateCandidate(0, spotifyTrack);

      // User can select the matched song while second is still searching
      useCandidateStore.getState().toggleSelection(useCandidateStore.getState().candidates[0].id);

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].isSelected).toBe(true);
      expect(candidates[1].isSearching).toBe(true);
    });
  });

  describe('cancelSearching', () => {
    it('should mark all searching candidates as not searching', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
        { title: 'Song 3', artist: 'Artist 3' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      // First song completes with match
      const spotifyTrack: SpotifyTrack = {
        id: 'track_1',
        uri: 'spotify:track:1',
        name: 'Song 1',
        artists: [{ id: 'a1', name: 'Artist 1' }],
        album: { id: 'album_1', name: 'Album', images: [] },
        duration_ms: 180000,
      };
      useCandidateStore.getState().updateCandidate(0, spotifyTrack);

      // Now cancel
      useCandidateStore.getState().cancelSearching();

      const { candidates, isLoading } = useCandidateStore.getState();
      expect(isLoading).toBe(false);
      expect(candidates[0].isSearching).toBe(false);
      expect(candidates[0].isMatched).toBe(true); // First one was found
      expect(candidates[1].isSearching).toBe(false);
      expect(candidates[1].isMatched).toBe(false); // Cancelled, not found
      expect(candidates[2].isSearching).toBe(false);
      expect(candidates[2].isMatched).toBe(false); // Cancelled, not found
    });

    it('should keep matched songs when cancelling', () => {
      const songs: Song[] = [
        { title: 'Song 1', artist: 'Artist 1' },
        { title: 'Song 2', artist: 'Artist 2' },
      ];
      useCandidateStore.getState().initCandidates(songs);

      const spotifyTrack: SpotifyTrack = {
        id: 'track_1',
        uri: 'spotify:track:1',
        name: 'Song 1',
        artists: [{ id: 'a1', name: 'Artist 1' }],
        album: { id: 'album_1', name: 'Album', images: [] },
        duration_ms: 180000,
      };
      useCandidateStore.getState().updateCandidate(0, spotifyTrack);

      useCandidateStore.getState().cancelSearching();

      const { candidates } = useCandidateStore.getState();
      expect(candidates[0].spotifyTrack).toEqual(spotifyTrack);
      expect(candidates[0].isMatched).toBe(true);
    });

    it('should do nothing if no candidates are searching', () => {
      const song = createMatchedSong('Song 1', 'Artist 1');
      useCandidateStore.getState().setCandidates([song]);

      useCandidateStore.getState().cancelSearching();

      const { candidates, isLoading } = useCandidateStore.getState();
      expect(candidates).toHaveLength(1);
      expect(isLoading).toBe(false);
    });
  });
});
