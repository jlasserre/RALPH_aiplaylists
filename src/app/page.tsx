import { ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel } from '@/components/layout';

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
      middlePanel={<MiddlePanel />}
      rightPanel={<RightPanel />}
    />
  );
}
