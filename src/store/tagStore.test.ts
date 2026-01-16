import { useTagStore, getTaggedCount, getTaggedSongs } from './tagStore';
import type { Song } from '@/types';

describe('tagStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTagStore.setState({ taggedSongs: [] });
  });

  const testSong1: Song = {
    title: 'Test Song 1',
    artist: 'Artist 1',
    album: 'Album 1',
  };

  const testSong2: Song = {
    title: 'Test Song 2',
    artist: 'Artist 2',
    album: 'Album 2',
  };

  describe('toggleTag', () => {
    it('should add a tag when song is not tagged', () => {
      const { toggleTag } = useTagStore.getState();

      toggleTag('track_1', testSong1);

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(1);
      expect(state.taggedSongs[0].spotifyTrackId).toBe('track_1');
      expect(state.taggedSongs[0].song).toEqual(testSong1);
    });

    it('should remove a tag when song is already tagged', () => {
      const { toggleTag } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_1', testSong1);

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(0);
    });

    it('should handle multiple tags', () => {
      const { toggleTag } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_2', testSong2);

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(2);
    });

    it('should only remove the specific tagged song', () => {
      const { toggleTag } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_2', testSong2);
      toggleTag('track_1', testSong1); // Remove track_1

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(1);
      expect(state.taggedSongs[0].spotifyTrackId).toBe('track_2');
    });
  });

  describe('isTagged', () => {
    it('should return true for tagged songs', () => {
      const { toggleTag, isTagged } = useTagStore.getState();

      toggleTag('track_1', testSong1);

      expect(isTagged('track_1')).toBe(true);
    });

    it('should return false for untagged songs', () => {
      const { isTagged } = useTagStore.getState();

      expect(isTagged('track_1')).toBe(false);
    });

    it('should return false after untagging', () => {
      const { toggleTag, isTagged } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_1', testSong1);

      expect(isTagged('track_1')).toBe(false);
    });
  });

  describe('clearTags', () => {
    it('should remove all tags', () => {
      const { toggleTag, clearTags } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_2', testSong2);
      clearTags();

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(0);
    });

    it('should work when no tags exist', () => {
      const { clearTags } = useTagStore.getState();

      clearTags();

      const state = useTagStore.getState();
      expect(state.taggedSongs).toHaveLength(0);
    });
  });

  describe('getTaggedCount', () => {
    it('should return correct count', () => {
      const { toggleTag } = useTagStore.getState();

      expect(getTaggedCount(useTagStore.getState())).toBe(0);

      toggleTag('track_1', testSong1);
      expect(getTaggedCount(useTagStore.getState())).toBe(1);

      toggleTag('track_2', testSong2);
      expect(getTaggedCount(useTagStore.getState())).toBe(2);

      toggleTag('track_1', testSong1);
      expect(getTaggedCount(useTagStore.getState())).toBe(1);
    });
  });

  describe('getTaggedSongs', () => {
    it('should return all tagged songs', () => {
      const { toggleTag } = useTagStore.getState();

      toggleTag('track_1', testSong1);
      toggleTag('track_2', testSong2);

      const tagged = getTaggedSongs(useTagStore.getState());
      expect(tagged).toHaveLength(2);
      expect(tagged[0].spotifyTrackId).toBe('track_1');
      expect(tagged[1].spotifyTrackId).toBe('track_2');
    });

    it('should return empty array when no tags', () => {
      const tagged = getTaggedSongs(useTagStore.getState());
      expect(tagged).toHaveLength(0);
    });
  });
});
