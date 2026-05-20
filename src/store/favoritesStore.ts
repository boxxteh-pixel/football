import { create } from 'zustand';
import { readFavorites, toggleFavorite, writeFavorites } from '@/services/storage/favorites';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/authStore';

const syncProfileFavorites = async (kind: 'teams' | 'fixtures' | 'leagues', ids: number[]) => {
  const session = useAuthStore.getState().session;
  if (!session?.user?.id) return;

  const dbField = kind === 'teams'
    ? 'favorite_team_ids'
    : kind === 'fixtures'
    ? 'favorite_fixture_ids'
    : 'favorite_league_ids';

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ [dbField]: ids })
      .eq('id', session.user.id);
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
    
    if (session?.user?.id) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('favorite_team_ids, favorite_fixture_ids, favorite_league_ids')
          .eq('id', session.user.id)
          .single();
          
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
    
    set({ ...local, hydrated: true });
  },
  toggle: async (kind, id) => {
    const state = await toggleFavorite(kind, id);
    set(state);
    await syncProfileFavorites(kind, state[kind]);
  },
  isFavorite: (kind, id) => get()[kind].includes(id),
}));
