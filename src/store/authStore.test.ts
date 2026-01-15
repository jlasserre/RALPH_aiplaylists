import { useAuthStore } from './authStore';

describe('authStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe('initial state', () => {
    it('should have null accessToken initially', () => {
      const { accessToken } = useAuthStore.getState();
      expect(accessToken).toBeNull();
    });

    it('should not be authenticated initially', () => {
      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should not be loading initially', () => {
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setAccessToken', () => {
    it('should set the access token', () => {
      useAuthStore.getState().setAccessToken('test-token-123');
      const { accessToken } = useAuthStore.getState();
      expect(accessToken).toBe('test-token-123');
    });

    it('should set isAuthenticated to true', () => {
      useAuthStore.getState().setAccessToken('test-token-123');
      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(true);
    });

    it('should set isLoading to false', () => {
      // First set loading to true
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Then set token - should set loading to false
      useAuthStore.getState().setAccessToken('test-token-123');
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should update token when called multiple times', () => {
      useAuthStore.getState().setAccessToken('token-1');
      expect(useAuthStore.getState().accessToken).toBe('token-1');

      useAuthStore.getState().setAccessToken('token-2');
      expect(useAuthStore.getState().accessToken).toBe('token-2');
    });
  });

  describe('clearAuth', () => {
    it('should clear the access token', () => {
      useAuthStore.getState().setAccessToken('test-token-123');
      expect(useAuthStore.getState().accessToken).toBe('test-token-123');

      useAuthStore.getState().clearAuth();
      const { accessToken } = useAuthStore.getState();
      expect(accessToken).toBeNull();
    });

    it('should set isAuthenticated to false', () => {
      useAuthStore.getState().setAccessToken('test-token-123');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().clearAuth();
      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
    });

    it('should set isLoading to false', () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().clearAuth();
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set isLoading to true', () => {
      useAuthStore.getState().setLoading(true);
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(true);
    });

    it('should set isLoading to false', () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should not affect other state properties', () => {
      useAuthStore.getState().setAccessToken('test-token');
      useAuthStore.getState().setLoading(true);

      const { accessToken, isAuthenticated, isLoading } = useAuthStore.getState();
      expect(accessToken).toBe('test-token');
      expect(isAuthenticated).toBe(true);
      expect(isLoading).toBe(true);
    });
  });
});
