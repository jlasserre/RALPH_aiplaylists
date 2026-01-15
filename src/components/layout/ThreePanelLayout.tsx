import { ReactNode } from 'react';

interface ThreePanelLayoutProps {
  leftPanel: ReactNode;
  middlePanel: ReactNode;
  rightPanel: ReactNode;
  header?: ReactNode;
}

/**
 * Three-panel layout optimized for desktop and tablet.
 * - Left panel: Controls (narrower, fixed width)
 * - Middle panel: Candidates (flexible)
 * - Right panel: Playlist (flexible)
 *
 * Not optimized for mobile screens - minimum supported width is tablet (768px).
 */
export function ThreePanelLayout({
  leftPanel,
  middlePanel,
  rightPanel,
  header,
}: ThreePanelLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {header && (
        <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          {header}
        </header>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls (narrower, fixed width) */}
        <aside className="w-64 xl:w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            {leftPanel}
          </div>
        </aside>

        {/* Middle Panel - Candidates */}
        <section className="flex-1 min-w-0 bg-gray-50 overflow-y-auto border-r border-gray-200">
          <div className="p-4 h-full">
            {middlePanel}
          </div>
        </section>

        {/* Right Panel - Playlist */}
        <section className="flex-1 min-w-0 bg-white overflow-y-auto">
          <div className="p-4 h-full">
            {rightPanel}
          </div>
        </section>
      </main>
    </div>
  );
}
