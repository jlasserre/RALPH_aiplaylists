'use client';

import { useState, useEffect } from 'react';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

interface SpotifyUser {
  display_name: string;
  images?: Array<{ url: string }>;
}

interface AuthStatusProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays current auth status with user info and logout button.
 * Shows loading state while checking auth.
 */
export function AuthStatus({ className = '' }: AuthStatusProps) {
  const { accessToken, isAuthenticated, isLoading, logout } = useSpotifyAuth();
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [fetchingUser, setFetchingUser] = useState(false);

  // Fetch user profile when authenticated
  useEffect(() => {
    if (!accessToken || !isAuthenticated) {
      setUser(null);
      return;
    }

    const fetchUser = async () => {
      setFetchingUser(true);
      try {
        const response = await fetch(
          `/api/spotify/user?accessToken=${encodeURIComponent(accessToken)}`
        );
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setFetchingUser(false);
      }
    };

    fetchUser();
  }, [accessToken, isAuthenticated]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <span>Checking login...</span>
      </div>
    );
  }

  // Not authenticated - AuthStatus shouldn't render, but show nothing just in case
  if (!isAuthenticated) {
    return null;
  }

  // Show loading while fetching user
  if (fetchingUser && !user) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  const displayName = user?.display_name || 'Spotify User';
  const avatarUrl = user?.images?.[0]?.url;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* User avatar or placeholder */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      )}

      {/* User info */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{displayName}</span>
        <span className="text-xs text-gray-500">Connected to Spotify</span>
      </div>

      {/* Logout button */}
      <button
        onClick={logout}
        className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        title="Log out"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  );
}
