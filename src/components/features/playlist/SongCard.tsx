'use client';

import { SongState, Song } from '@/types';

interface SongCardProps {
  /** Song information (title, artist, album, year) */
  song: Song;
  /** Current state of the song (synced, pending, markedForRemoval) - only for playlist songs */
  state?: SongState;
  /** Whether the song is matched on Spotify (for candidates) */
  isMatched?: boolean;
  /** Whether the song is selected (for candidates) */
  isSelected?: boolean;
  /** Callback when the card is clicked (for toggling removal state) */
  onClick?: () => void;
  /** Whether the card is clickable */
  isClickable?: boolean;
  /** Whether to show the state icon */
  showStateIcon?: boolean;
  /** Callback when "More Like This" is clicked. Receives the Spotify track ID. */
  onMoreLikeThis?: (spotifyTrackId: string) => void;
  /** Spotify track ID for the song (required for More Like This feature) */
  spotifyTrackId?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * State icon with tooltip for synced songs (music note)
 */
function SyncedIcon() {
  return (
    <div className="relative group">
      <svg
        className="w-5 h-5 text-green-600"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-label="Synced"
      >
        <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
      <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
        This song is in your Spotify playlist
      </div>
    </div>
  );
}

/**
 * State icon with tooltip for pending songs (plus sign)
 */
function PendingIcon() {
  return (
    <div className="relative group">
      <svg
        className="w-5 h-5 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-label="Pending"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
      <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
        This song will be added when you save
      </div>
    </div>
  );
}

/**
 * State icon with tooltip for songs marked for removal (forbidden/no symbol)
 */
function MarkedForRemovalIcon() {
  return (
    <div className="relative group">
      <svg
        className="w-5 h-5 text-red-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-label="Marked for removal"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
      <div className="absolute left-6 top-0 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
        This song will be removed when you save
      </div>
    </div>
  );
}

/**
 * Renders the appropriate state icon based on the song state
 */
function StateIcon({ state }: { state: SongState }) {
  switch (state) {
    case 'synced':
      return <SyncedIcon />;
    case 'pending':
      return <PendingIcon />;
    case 'markedForRemoval':
      return <MarkedForRemovalIcon />;
    default:
      return null;
  }
}

/**
 * More Like This button with tooltip
 */
function MoreLikeThisButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="relative group p-1 rounded hover:bg-gray-100 transition-colors"
      aria-label="Get similar song recommendations"
    >
      <svg
        className="w-4 h-4 text-gray-400 group-hover:text-purple-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <div className="absolute right-0 top-6 z-10 hidden group-hover:block px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
        More like this
      </div>
    </button>
  );
}

/**
 * SongCard component for displaying song information with state indicators.
 * Used in both CandidateList and PlaylistView components.
 *
 * State icons:
 * - 🎵 Synced: Music note icon (green) - song is in Spotify playlist
 * - + Pending: Plus icon (blue) - song will be added when saved
 * - 🚫 Marked for removal: Forbidden icon (red) - song will be removed when saved
 */
export function SongCard({
  song,
  state,
  isMatched = true,
  onClick,
  isClickable = false,
  showStateIcon = false,
  onMoreLikeThis,
  spotifyTrackId,
  className = '',
}: SongCardProps) {
  const isMarkedForRemoval = state === 'markedForRemoval';

  // Determine card styling based on state
  const cardClasses = [
    'p-3 rounded-lg border transition-colors',
    isMarkedForRemoval
      ? 'bg-red-50 border-red-200'
      : isMatched
        ? 'bg-white border-gray-200'
        : 'bg-gray-50 border-gray-100 opacity-60',
    isClickable && isMatched
      ? isMarkedForRemoval
        ? 'hover:border-red-300 cursor-pointer'
        : 'hover:border-gray-300 cursor-pointer'
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Determine if More Like This button should show
  const showMoreLikeThis = onMoreLikeThis && spotifyTrackId && isMatched;

  const content = (
    <div className="flex items-start gap-3">
      {/* State icon */}
      {showStateIcon && state && (
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          <StateIcon state={state} />
        </div>
      )}

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium truncate ${
              isMarkedForRemoval
                ? 'text-red-900 line-through'
                : 'text-gray-900'
            }`}
          >
            {song.title}
          </span>
          {!isMatched && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
              Not found
            </span>
          )}
        </div>
        <div
          className={`text-sm truncate ${
            isMarkedForRemoval ? 'text-red-700' : 'text-gray-600'
          }`}
        >
          {song.artist}
        </div>
        {song.album && (
          <div
            className={`text-xs truncate ${
              isMarkedForRemoval ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {song.album}
            {song.year && ` • ${song.year}`}
          </div>
        )}
      </div>

      {/* More Like This button */}
      {showMoreLikeThis && (
        <div className="flex-shrink-0">
          <MoreLikeThisButton onClick={() => onMoreLikeThis(spotifyTrackId)} />
        </div>
      )}
    </div>
  );

  if (isClickable && onClick) {
    return (
      <div
        className={cardClasses}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${song.title} by ${song.artist}${state ? `. Status: ${state}` : ''}`}
      >
        {content}
      </div>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}
