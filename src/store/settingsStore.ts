import { create } from 'zustand';
import { DEFAULT_SETTINGS, readSettings, updateSettings, type AppSettings, type ColorTheme } from '@/services/storage/settings';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/authStore';

const setNativeAppIcon = async (themeName: string | null) => {
  try {
    const ExpoDynamicAppIcon = require('@variant-systems/expo-dynamic-app-icon');
    if (ExpoDynamicAppIcon && typeof ExpoDynamicAppIcon.setAppIcon === 'function') {
      await ExpoDynamicAppIcon.setAppIcon(themeName);
    }
  } catch (err) {
    // Silently handle native module unavailability in Expo Go
    console.log('Dynamic app icon not supported in this environment (e.g. Expo Go):', err);
  }
};

const syncProfileSettings = async (patch: Partial<AppSettings>) => {
  const session = useAuthStore.getState().session;
  if (!session?.user?.id) return;

  const dbPatch: Record<string, any> = {};
  if (patch.language) dbPatch.language = patch.language;
  if (patch.oddsFormat) dbPatch.odds_format = patch.oddsFormat;
  if (patch.liveNotifications !== undefined) dbPatch.live_notifications = patch.liveNotifications;
  if (patch.selectedLeagueIds) dbPatch.selected_league_ids = patch.selectedLeagueIds;

  if (Object.keys(dbPatch).length === 0) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update(dbPatch)
      .eq('id', session.user.id);
    if (error) console.warn('Supabase settings sync error:', error.message);
  } catch (err) {
    console.warn('Failed to sync settings to Supabase:', err);
  }
};

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
    const local = await readSettings();
    const session = useAuthStore.getState().session;
    
    // Make sure native app icon matches the hydrated setting
    await setNativeAppIcon(local.colorTheme === 'purple' ? 'purple' : null);
    
    if (session?.user?.id) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('language, odds_format, live_notifications, selected_league_ids')
          .eq('id', session.user.id)
          .single();
          
        if (data && !error) {
          const merged: AppSettings = {
            ...local,
            language: (data.language as AppSettings['language']) || local.language,
            oddsFormat: (data.odds_format as AppSettings['oddsFormat']) || local.oddsFormat,
            liveNotifications: data.live_notifications !== null ? data.live_notifications : local.liveNotifications,
            selectedLeagueIds: data.selected_league_ids || local.selectedLeagueIds,
          };
          await updateSettings(merged);
          set({ settings: merged, hydrated: true });
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch settings from Supabase on hydration:', err);
      }
    }
    
    set({ settings: local, hydrated: true });
  },
  toggleLeague: async (id) => {
    const current = get().settings.selectedLeagueIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const settings = await updateSettings({ selectedLeagueIds: next });
    set({ settings });
    await syncProfileSettings({ selectedLeagueIds: next });
  },
  setOddsFormat: async (format) => {
    const settings = await updateSettings({ oddsFormat: format });
    set({ settings });
    await syncProfileSettings({ oddsFormat: format });
  },
  setLiveNotifications: async (enabled) => {
    const settings = await updateSettings({ liveNotifications: enabled });
    set({ settings });
    await syncProfileSettings({ liveNotifications: enabled });
  },
  setLanguage: async (language) => {
    const settings = await updateSettings({ language });
    set({ settings });
    await syncProfileSettings({ language });
  },
  setColorTheme: async (theme) => {
    const settings = await updateSettings({ colorTheme: theme });
    set({ settings });
    // Note: colorTheme is kept local-only since it is a device appearance config.
    await setNativeAppIcon(theme === 'purple' ? 'purple' : null);
  },
}));
