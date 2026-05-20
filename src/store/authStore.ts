import { create } from 'zustand';
import type { UserSession } from '@/types/user';
import { supabase } from '@/services/supabase/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PASSWORD_KEY_PREFIX = 'boro_pwd_';

const storePlainPassword = async (userId: string, password: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(`${PASSWORD_KEY_PREFIX}${userId}`, password);
  } catch {
    // Ignore
  }
};

const removePlainPassword = async (userId: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(`${PASSWORD_KEY_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
};

const formatEmail = (identifier: string): string => {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  return `${clean}@boro.ai`;
};

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        const mappedSession: UserSession = {
          user: {
            id: user.id,
            name: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
            createdAt: new Date(user.created_at).getTime(),
            avatarUrl: null,
          },
          token: session.access_token,
          issuedAt: Date.now(),
        };
        set({ session: mappedSession, hydrated: true });
      } else {
        set({ session: null, hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
  signUp: async (payload) => {
    set({ loading: true, error: null });
    try {
      const email = formatEmail(payload.name);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: {
          data: {
            username: payload.name.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('No user returned.');

      // Store password in secure store
      await storePlainPassword(data.user.id, payload.password);

      // Create initial profile in the database
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: payload.name.trim(),
        language: 'en',
        odds_format: 'decimal',
        live_notifications: true,
        selected_league_ids: [39, 135, 140, 61, 78, 2, 3],
      });

      if (profileError) {
        console.warn('Profile creation error during signup:', profileError.message);
      }

      const mappedSession: UserSession = {
        user: {
          id: data.user.id,
          name: payload.name.trim(),
          createdAt: new Date(data.user.created_at).getTime(),
          avatarUrl: null,
        },
        token: data.session?.access_token ?? '',
        issuedAt: Date.now(),
      };
      set({ session: mappedSession, loading: false });
    } catch (e: unknown) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Sign up failed.' });
      throw e;
    }
  },
  logIn: async (payload) => {
    set({ loading: true, error: null });
    try {
      const email = formatEmail(payload.name);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('No user returned.');

      // Store password in secure store
      await storePlainPassword(data.user.id, payload.password);

      const mappedSession: UserSession = {
        user: {
          id: data.user.id,
          name: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'User',
          createdAt: new Date(data.user.created_at).getTime(),
          avatarUrl: null,
        },
        token: data.session?.access_token ?? '',
        issuedAt: Date.now(),
      };
      set({ session: mappedSession, loading: false });
    } catch (e: unknown) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Login failed.' });
      throw e;
    }
  },
  logOut: async () => {
    const session = useAuthStore.getState().session;
    if (session?.user) {
      await removePlainPassword(session.user.id);
    }
    await supabase.auth.signOut();
    set({ session: null });
  },
  clearError: () => set({ error: null }),
}));
