import { ThreePanelLayout, LeftPanel } from '@/components/layout';

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
      middlePanel={
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Candidates</h2>
          <p className="text-sm text-gray-500">
            Song suggestions will appear here.
          </p>
        </div>
      }
      rightPanel={
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Your Playlist</h2>
          <p className="text-sm text-gray-500">
            Your playlist songs will appear here.
          </p>
        </div>
      }
    />
  );
}
