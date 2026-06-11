import { create } from 'zustand';
import { DEFAULT_SETTINGS, readSettings, updateSettings, type AppSettings, type ColorTheme } from '@/services/storage/settings';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LEAGUE_IDS } from '@/constants/leagues';
import { withTimeout } from '@/utils/async';

const setNativeAppIcon = async (themeName: string | null) => {
  try {
    const hasModule = typeof global !== 'undefined' && (
      ((global as any).ExpoModules && (global as any).ExpoModules.ExpoDynamicAppIcon) ||
      ((global as any).ExpoModules && (global as any).ExpoModules.ExpoDynamicAppIconModule)
    );
    if (!hasModule) return;

    const ExpoDynamicAppIcon = require('@variant-systems/expo-dynamic-app-icon');
    if (ExpoDynamicAppIcon && typeof ExpoDynamicAppIcon.setAppIcon === 'function') {
      await ExpoDynamicAppIcon.setAppIcon(themeName);
    }
  } catch (err) {
    // Silently ignore to avoid triggering red boxes or terminal formatting errors
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
    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .update(dbPatch)
        .eq('id', session.user.id),
      2500,
      { error: null } as any,
    );
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
  setOledMode: (enabled: boolean) => Promise<void>;
  setRiskProfile: (profile: AppSettings['riskProfile']) => Promise<void>;
  setTimezone: (timezone: string) => Promise<void>;
  setNewsFrequency: (frequency: AppSettings['newsFrequency']) => Promise<void>;
  setSport: (sport: AppSettings['sport']) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    const local = await readSettings();
    const session = useAuthStore.getState().session;
    set({ settings: local, hydrated: true });
    
    // Make sure native app icon matches the hydrated setting
    setNativeAppIcon(local.colorTheme === 'purple' ? 'purple' : null).catch(() => {});
    
    if (session?.user?.id) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('language, odds_format, live_notifications, selected_league_ids')
            .eq('id', session.user.id)
            .single(),
          2500,
          { data: null, error: null } as any,
        );
          
        if (data && !error) {
          const supabaseIds = data.selected_league_ids || [];
          const mergedLeagueIds = Array.from(new Set([...supabaseIds, ...DEFAULT_LEAGUE_IDS]));
          
          const merged: AppSettings = {
            ...local,
            language: (data.language as AppSettings['language']) || local.language,
            oddsFormat: (data.odds_format as AppSettings['oddsFormat']) || local.oddsFormat,
            liveNotifications: data.live_notifications !== null ? data.live_notifications : local.liveNotifications,
            selectedLeagueIds: mergedLeagueIds,
          };
          await updateSettings(merged);
          set({ settings: merged, hydrated: true });
          
          // If the merged list contains new default leagues, sync them back to Supabase
          if (mergedLeagueIds.length > supabaseIds.length) {
            syncProfileSettings({ selectedLeagueIds: mergedLeagueIds }).catch(() => {});
          }
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch settings from Supabase on hydration:', err);
      }
    }
  },
  toggleLeague: async (id) => {
    const current = get().settings.selectedLeagueIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const settings = await updateSettings({ selectedLeagueIds: next });
    set({ settings });
    syncProfileSettings({ selectedLeagueIds: next }).catch(() => {});
  },
  setOddsFormat: async (format) => {
    const settings = await updateSettings({ oddsFormat: format });
    set({ settings });
    syncProfileSettings({ oddsFormat: format }).catch(() => {});
  },
  setLiveNotifications: async (enabled) => {
    const settings = await updateSettings({ liveNotifications: enabled });
    set({ settings });
    syncProfileSettings({ liveNotifications: enabled }).catch(() => {});
  },
  setLanguage: async (language) => {
    const settings = await updateSettings({ language });
    set({ settings });
    syncProfileSettings({ language }).catch(() => {});
  },
  setColorTheme: async (theme) => {
    const settings = await updateSettings({ colorTheme: theme });
    set({ settings });
    // Note: colorTheme is kept local-only since it is a device appearance config.
    setNativeAppIcon(theme === 'purple' ? 'purple' : null).catch(() => {});
  },
  setOledMode: async (enabled) => {
    const settings = await updateSettings({ oledMode: enabled });
    set({ settings });
  },
  setRiskProfile: async (profile) => {
    const settings = await updateSettings({ riskProfile: profile });
    set({ settings });
  },
  setTimezone: async (timezone) => {
    const settings = await updateSettings({ timezone });
    set({ settings });
  },
  setNewsFrequency: async (frequency) => {
    const settings = await updateSettings({ newsFrequency: frequency });
    set({ settings });
  },
  setSport: async (sport) => {
    const settings = await updateSettings({ sport });
    set({ settings });
    // Invalidate the cache completely so we don't display stale fixtures from the other sport
    try {
      const { invalidateCache } = require('@/services/api/smClient');
      invalidateCache();
    } catch (err) {
      console.warn('Failed to invalidate cache:', err);
    }
    // Force immediate update of default leagues constants
    try {
      const { updateTrackedLeagues } = require('@/constants/leagues');
      updateTrackedLeagues(sport);
    } catch (err) {
      console.warn('Failed to update tracked leagues:', err);
    }
  },
}));
