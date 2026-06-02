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
  oledMode: boolean;
  riskProfile: 'default' | 'conservative' | 'aggressive';
  timezone: string;
  newsFrequency: 'always' | 'daily' | 'off';
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedLeagueIds: DEFAULT_LEAGUE_IDS,
  oddsFormat: 'decimal',
  liveNotifications: true,
  language: 'it', // Default to Italian
  colorTheme: 'green',
  oledMode: false,
  riskProfile: 'default',
  timezone: 'Europe/Rome', // Default to Italian Timezone
  newsFrequency: 'always',
};

export const readSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const selectedLeagueIds = parsed.selectedLeagueIds || [];
    const mergedLeagueIds = Array.from(new Set([...selectedLeagueIds, ...DEFAULT_LEAGUE_IDS]));
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      selectedLeagueIds: mergedLeagueIds,
    };
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
