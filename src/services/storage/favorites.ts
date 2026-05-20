import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'boro_favorites';

interface FavoritesState {
  teams: number[];
  fixtures: number[];
  leagues: number[];
}

const DEFAULT: FavoritesState = { teams: [], fixtures: [], leagues: [] };

export const readFavorites = async (): Promise<FavoritesState> => {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<FavoritesState>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

export const writeFavorites = async (state: FavoritesState): Promise<void> => {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(state));
};

export const toggleFavorite = async (
  kind: keyof FavoritesState,
  id: number,
): Promise<FavoritesState> => {
  const state = await readFavorites();
  const current = state[kind];
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  const updated = { ...state, [kind]: next };
  await writeFavorites(updated);
  return updated;
};
