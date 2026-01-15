export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          AI Playlist Generator
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Generate Spotify playlists using AI
        </p>
      </main>
    </div>
  );
}
