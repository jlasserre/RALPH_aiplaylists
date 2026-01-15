import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';
import { PlaylistSong, CandidateSong } from '@/types';

// Demo data for development - will be replaced with real store data
const demoPlaylistSongs: PlaylistSong[] = [
  {
    id: '1',
    song: { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: 1975 },
    spotifyTrack: null,
    state: 'synced',
  },
  {
    id: '2',
    song: { title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', year: 1977 },
    spotifyTrack: null,
    state: 'pending',
  },
  {
    id: '3',
    song: { title: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', year: 1971 },
    spotifyTrack: null,
    state: 'markedForRemoval',
  },
];

const demoCandidateSongs: CandidateSong[] = [
  {
    id: 'c1',
    song: { title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', album: 'Appetite for Destruction', year: 1987 },
    spotifyTrack: null,
    isSelected: false,
    isMatched: true,
  },
  {
    id: 'c2',
    song: { title: 'November Rain', artist: 'Guns N\' Roses', album: 'Use Your Illusion I', year: 1991 },
    spotifyTrack: null,
    isSelected: true,
    isMatched: true,
  },
  {
    id: 'c3',
    song: { title: 'Unknown Song', artist: 'Unknown Artist' },
    spotifyTrack: null,
    isSelected: false,
    isMatched: false,
  },
];

export default function Home() {
  return (
    <ThreePanelLayout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            AI Playlist Generator
          </h1>
          <div className="text-sm text-gray-500">
            {/* Auth status will go here */}
          </div>
        </div>
      }
      leftPanel={<LeftPanel />}
      middlePanel={<MiddlePanel candidates={demoCandidateSongs} />}
      rightPanel={<RightPanel songs={demoPlaylistSongs} />}
    />
  );
}
