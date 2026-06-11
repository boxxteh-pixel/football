/**
 * Runtime configuration sourced from environment variables (Expo public env).
 * Falls back to safe defaults when not set so the app still boots.
 * IMPORTANT: Access variables statically (process.env.VAR) rather than dynamically,
 * otherwise Expo's build-time bundler cannot inline the values in production builds.
 */

export const config = {
  sportmonks: {
    key: process.env.EXPO_PUBLIC_SPORTMONKS_KEY || 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm',
    baseUrl: 'https://api.sportmonks.com/v3/football',
  },
  sportsDb: {
    key: process.env.EXPO_PUBLIC_SPORTSDB_KEY || '3',
    get baseUrl() {
      return `https://www.thesportsdb.com/api/v1/json/${this.key}`;
    },
  },
  app: {
    defaultSeason: Number(process.env.EXPO_PUBLIC_DEFAULT_SEASON || '2024'),
    // Live data polls fast (the Pro plan allows 53k calls/hour — huge headroom).
    // Live scores every 10s, the in-match tracker every 6s for fluid movement.
    liveRefreshMs: Number(process.env.EXPO_PUBLIC_LIVE_REFRESH_MS || '10000'),
    trackerRefreshMs: Number(process.env.EXPO_PUBLIC_TRACKER_REFRESH_MS || '6000'),
    fixturesRefreshMs: Number(process.env.EXPO_PUBLIC_FIXTURES_REFRESH_MS || '1800000'),
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhzdkjiisgntqpdgrjpq.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5H053SjmcKqEOkDcAY_QPA_8ZSXDbv2',
  },
} as const;

export const getSportmonksKey = (): string => {
  try {
    const sport = useSettingsStore.getState().settings.sport;
    if (sport === 'cricket') {
      return 'NpTidbHGXPZR4QFiRxTQAnZlkB5yMpb3pSYgi3JvOHsGir30PMohpmeHZkpJ';
    }
  } catch {}
  return config.sportmonks.key;
};

export const getSportmonksBaseUrl = (): string => {
  try {
    const sport = useSettingsStore.getState().settings.sport;
    if (sport === 'cricket') {
      return 'https://cricket.sportmonks.com/api/v2.0';
    }
  } catch {}
  return config.sportmonks.baseUrl;
};

export const hasApiKey = (): boolean => getSportmonksKey().length > 0;

export const isCricketMode = (): boolean => {
  try {
    return useSettingsStore.getState().settings.sport === 'cricket';
  } catch {
    return false;
  }
};

import { useSettingsStore } from '@/store/settingsStore';
