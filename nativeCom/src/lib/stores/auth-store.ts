import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { fetchMe } from '@/lib/api/auth';
import { queryClient } from '@/lib/query-client';
import type { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  clearUser: () => void;
  fetchUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initAuth: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  isLoading: true,
  error: null,
  isInitialized: false,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialState,

  setUser: (user) => set({ user, error: null, isInitialized: true }),

  clearUser: () => {
    queryClient.clear();
    set({ user: null, error: null, isInitialized: true });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  initAuth: async () => {
    set({ isLoading: true, error: null });

    try {
      // Check if we have a stored token
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        await get().fetchUser();
      } else {
        set({ user: null, isLoading: false, error: null, isInitialized: true });
      }
    } catch {
      set({ user: null, isLoading: false, error: null, isInitialized: true });
    }
  },

  fetchUser: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await fetchMe();

      if (result.success && result.data?.profile) {
        set({
          user: result.data.profile as User,
          isLoading: false,
          error: null,
          isInitialized: true,
        });
      } else {
        set({
          user: null,
          isLoading: false,
          error: null,
          isInitialized: true,
        });
      }
    } catch {
      set({
        user: null,
        isLoading: false,
        error: null,
        isInitialized: true,
      });
    }
  },
}));
