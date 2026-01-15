import { renderHook, waitFor, act } from '@testing-library/react';
import { useSpotifyAuth } from './useSpotifyAuth';
import { useAuthStore } from '@/store/authStore';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useSpotifyAuth', () => {
  beforeEach(() => {
    // Reset fetch mock
    mockFetch.mockReset();

    // Reset auth store state including hasAttemptedRefresh
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasAttemptedRefresh: false,
    });
  });

  describe('initial state', () => {
    it('should return initial auth state', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No refresh token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      expect(result.current.accessToken).toBeNull();
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });
  });

  describe('auto-refresh on mount', () => {
    it('should call refresh endpoint on mount when not authenticated', async () => {
      // Ensure we start in unauthenticated state
      useAuthStore.setState({
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      });

      renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
      });
    });

    it('should set access token when refresh succeeds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'refreshed-token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.accessToken).toBe('refreshed-token');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should handle refresh failure gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No refresh token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.accessToken).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle network error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.accessToken).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to refresh auth:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('should not call refresh if already authenticated', async () => {
      // Set initial authenticated state before rendering hook
      useAuthStore.setState({
        accessToken: 'existing-token',
        isAuthenticated: true,
        isLoading: false,
        hasAttemptedRefresh: false,
      });

      renderHook(() => useSpotifyAuth());

      // Wait a bit to ensure effect has a chance to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should set loading state during refresh', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValue(fetchPromise);

      const { result } = renderHook(() => useSpotifyAuth());

      // Should set loading to true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ access_token: 'test-token' }),
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('login', () => {
    it('should provide a login function', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No refresh token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify login function exists
      // Note: In jsdom, window.location.href assignment can't be easily mocked
      // The actual redirect behavior is tested via integration/e2e tests
      expect(typeof result.current.login).toBe('function');
    });
  });

  describe('logout', () => {
    it('should clear auth state', async () => {
      // Set up authenticated state first
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should work when not authenticated', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No refresh token' }),
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw when calling logout when not authenticated
      act(() => {
        result.current.logout();
      });

      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('clearAuth on empty access_token response', () => {
    it('should clear auth when server returns empty access_token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // No access_token in response
      });

      const { result } = renderHook(() => useSpotifyAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
