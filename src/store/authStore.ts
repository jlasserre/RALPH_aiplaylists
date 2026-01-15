import { create } from 'zustand';

interface AuthState {
  /** Spotify access token - stored in memory only, not persisted */
  accessToken: string | null;
  /** Whether the user is authenticated with Spotify */
  isAuthenticated: boolean;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Whether we've already attempted to refresh the token this session */
  hasAttemptedRefresh: boolean;
}

interface AuthActions {
  /** Set the access token and mark as authenticated */
  setAccessToken: (token: string) => void;
  /** Clear auth state (logout) */
  clearAuth: () => void;
  /** Set loading state for auth operations */
  setLoading: (loading: boolean) => void;
  /** Mark that refresh has been attempted */
  setHasAttemptedRefresh: (value: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

/**
 * Auth store for managing Spotify authentication state.
 * Access token is stored in memory only (not persisted) for security.
 * The refresh token is stored in httpOnly cookies server-side.
 */
export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  hasAttemptedRefresh: false,

  // Actions
  setAccessToken: (token: string) =>
    set({
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    }),

  clearAuth: () =>
    set({
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (loading: boolean) =>
    set({
      isLoading: loading,
    }),

  setHasAttemptedRefresh: (value: boolean) =>
    set({
      hasAttemptedRefresh: value,
    }),
}));
