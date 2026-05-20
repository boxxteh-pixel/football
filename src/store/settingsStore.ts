import { create } from 'zustand';
import { DEFAULT_SETTINGS, readSettings, updateSettings, type AppSettings, type ColorTheme } from '@/services/storage/settings';

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleLeague: (id: number) => Promise<void>;
  setOddsFormat: (format: AppSettings['oddsFormat']) => Promise<void>;
  setLiveNotifications: (enabled: boolean) => Promise<void>;
  setLanguage: (language: AppSettings['language']) => Promise<void>;
  setColorTheme: (theme: ColorTheme) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    const settings = await readSettings();
    set({ settings, hydrated: true });
  },
  toggleLeague: async (id) => {
    const current = get().settings.selectedLeagueIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const settings = await updateSettings({ selectedLeagueIds: next });
    set({ settings });
  },
  setOddsFormat: async (format) => {
    const settings = await updateSettings({ oddsFormat: format });
    set({ settings });
  },
  setLiveNotifications: async (enabled) => {
    const settings = await updateSettings({ liveNotifications: enabled });
    set({ settings });
  },
  setLanguage: async (language) => {
    const settings = await updateSettings({ language });
    set({ settings });
  },
  setColorTheme: async (theme) => {
    const settings = await updateSettings({ colorTheme: theme });
    set({ settings });
  },
}));
