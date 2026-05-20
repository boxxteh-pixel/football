import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LEAGUE_IDS } from '@/constants/leagues';

const SETTINGS_KEY = 'boro_settings';

export type AppLocale = 'en' | 'it';
export type ColorTheme = 'green' | 'purple';

export interface AppSettings {
  selectedLeagueIds: number[];
  oddsFormat: 'decimal' | 'fractional';
  liveNotifications: boolean;
  language: AppLocale;
  colorTheme: ColorTheme;
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedLeagueIds: DEFAULT_LEAGUE_IDS,
  oddsFormat: 'decimal',
  liveNotifications: true,
  language: 'en',
  colorTheme: 'green',
};

export const readSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const writeSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const updateSettings = async (
  patch: Partial<AppSettings>,
): Promise<AppSettings> => {
  const current = await readSettings();
  const next = { ...current, ...patch };
  await writeSettings(next);
  return next;
};
