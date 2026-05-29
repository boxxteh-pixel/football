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
    // Live data polls every 60s (Pro plan has ample rate-limit headroom);
    // scheduled fixtures refresh every 30 min.
    liveRefreshMs: Number(process.env.EXPO_PUBLIC_LIVE_REFRESH_MS || '60000'),
    fixturesRefreshMs: Number(process.env.EXPO_PUBLIC_FIXTURES_REFRESH_MS || '1800000'),
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhzdkjiisgntqpdgrjpq.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5H053SjmcKqEOkDcAY_QPA_8ZSXDbv2',
  },
} as const;

export const hasApiKey = (): boolean => config.sportmonks.key.length > 0;
