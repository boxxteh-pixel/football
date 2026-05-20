import { create } from 'zustand';
import { readFavorites, toggleFavorite } from '@/services/storage/favorites';

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
    const state = await readFavorites();
    set({ ...state, hydrated: true });
  },
  toggle: async (kind, id) => {
    const state = await toggleFavorite(kind, id);
    set(state);
  },
  isFavorite: (kind, id) => get()[kind].includes(id),
}));
