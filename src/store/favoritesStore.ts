import { create } from 'zustand';
import { readFavorites, toggleFavorite, writeFavorites } from '@/services/storage/favorites';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { withTimeout } from '@/utils/async';

const syncProfileFavorites = async (kind: 'teams' | 'fixtures' | 'leagues', ids: number[]) => {
  const session = useAuthStore.getState().session;
  if (!session?.user?.id) return;

  const dbField = kind === 'teams'
    ? 'favorite_team_ids'
    : kind === 'fixtures'
    ? 'favorite_fixture_ids'
    : 'favorite_league_ids';

  try {
    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .update({ [dbField]: ids })
        .eq('id', session.user.id),
      2500,
      { error: null } as any,
    );
    if (error) console.warn('Supabase favorites sync error:', error.message);
  } catch (err) {
    console.warn('Failed to sync favorites to Supabase:', err);
  }
};

interface FavoritesState {
  teams: number[];
  fixtures: number[];
  leagues: number[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: (kind: 'teams' | 'fixtures' | 'leagues', id: number) => Promise<void>;
  addMultiple: (kind: 'teams' | 'fixtures' | 'leagues', ids: number[]) => Promise<void>;
  removeMultiple: (kind: 'teams' | 'fixtures' | 'leagues', ids: number[]) => Promise<void>;
  isFavorite: (kind: 'teams' | 'fixtures' | 'leagues', id: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  teams: [],
  fixtures: [],
  leagues: [],
  hydrated: false,
  hydrate: async () => {
    const local = await readFavorites();
    const session = useAuthStore.getState().session;
    set({ ...local, hydrated: true });
    
    if (session?.user?.id) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('favorite_team_ids, favorite_fixture_ids, favorite_league_ids')
            .eq('id', session.user.id)
            .single(),
          2500,
          { data: null, error: null } as any,
        );
          
        if (data && !error) {
          const merged = {
            teams: data.favorite_team_ids || local.teams,
            fixtures: data.favorite_fixture_ids || local.fixtures,
            leagues: data.favorite_league_ids || local.leagues,
          };
          await writeFavorites(merged);
          set({ ...merged, hydrated: true });
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch favorites from Supabase on hydration:', err);
      }
    }
  },
  toggle: async (kind, id) => {
    const state = await toggleFavorite(kind, id);
    set(state);
    syncProfileFavorites(kind, state[kind]).catch(() => {});
  },
  addMultiple: async (kind, ids) => {
    const current = get()[kind];
    const toAdd = ids.filter(id => !current.includes(id));
    if (toAdd.length === 0) return;
    const next = [...current, ...toAdd];
    const updated = {
      teams: get().teams,
      fixtures: get().fixtures,
      leagues: get().leagues,
      [kind]: next
    };
    await writeFavorites(updated);
    set(updated);
    syncProfileFavorites(kind, next).catch(() => {});
  },
  removeMultiple: async (kind, ids) => {
    const current = get()[kind];
    const next = current.filter(id => !ids.includes(id));
    const updated = {
      teams: get().teams,
      fixtures: get().fixtures,
      leagues: get().leagues,
      [kind]: next
    };
    await writeFavorites(updated);
    set(updated);
    syncProfileFavorites(kind, next).catch(() => {});
  },
  isFavorite: (kind, id) => get()[kind].includes(id),
}));
