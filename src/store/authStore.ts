import { create } from 'zustand';
import type { UserSession } from '@/types/user';
import * as auth from '@/services/auth/localAuth';

interface AuthState {
  session: UserSession | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  signUp: (payload: { name: string; password: string }) => Promise<void>;
  logIn: (payload: { name: string; password: string }) => Promise<void>;
  logOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  loading: false,
  error: null,
  hydrate: async () => {
    try {
      const session = await auth.getSession();
      set({ session, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  signUp: async (payload) => {
    set({ loading: true, error: null });
    try {
      const session = await auth.signUp(payload);
      set({ session, loading: false });
    } catch (e: unknown) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Sign up failed.' });
      throw e;
    }
  },
  logIn: async (payload) => {
    set({ loading: true, error: null });
    try {
      const session = await auth.logIn(payload);
      set({ session, loading: false });
    } catch (e: unknown) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Login failed.' });
      throw e;
    }
  },
  logOut: async () => {
    await auth.logOut();
    set({ session: null });
  },
  clearError: () => set({ error: null }),
}));
