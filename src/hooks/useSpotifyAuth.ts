'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

interface UseSpotifyAuthReturn {
  /** Spotify access token, null if not authenticated */
  accessToken: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Initiates Spotify OAuth login flow */
  login: () => void;
  /** Clears auth state (logout) */
  logout: () => void;
}

/**
 * Hook for managing Spotify authentication.
 * Automatically refreshes access token on mount.
 */
export function useSpotifyAuth(): UseSpotifyAuthReturn {
  const {
    accessToken,
    isAuthenticated,
    isLoading,
    hasAttemptedRefresh,
    setAccessToken,
    clearAuth,
    setLoading,
    setHasAttemptedRefresh,
  } = useAuthStore();

  // Attempt to refresh/retrieve access token on mount
  useEffect(() => {
    // Skip if already attempted refresh or already authenticated
    if (hasAttemptedRefresh || isAuthenticated) {
      return;
    }

    // Mark that we're attempting refresh
    setHasAttemptedRefresh(true);

    const initAuth = async () => {
      setLoading(true);

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include', // Include cookies
        });

        if (response.ok) {
          const data = await response.json();
          if (data.access_token) {
            setAccessToken(data.access_token);
          } else {
            clearAuth();
          }
        } else {
          // Not authenticated or refresh failed - clear any stale state
          clearAuth();
        }
      } catch (error) {
        console.error('Failed to refresh auth:', error);
        clearAuth();
      }
    };

    initAuth();
  }, [hasAttemptedRefresh, isAuthenticated, setAccessToken, clearAuth, setLoading, setHasAttemptedRefresh]);

  /**
   * Initiates Spotify OAuth login flow by redirecting to the auth endpoint.
   */
  const login = useCallback(() => {
    window.location.href = '/api/auth/spotify';
  }, []);

  /**
   * Clears the current auth state.
   * Note: This only clears client-side state. The httpOnly cookies
   * will need to be cleared server-side for a complete logout.
   */
  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return {
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
