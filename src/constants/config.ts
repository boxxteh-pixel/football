/**
 * Runtime configuration sourced from environment variables (Expo public env).
 * Falls back to safe defaults when not set so the app still boots.
 * IMPORTANT: Access variables statically (process.env.VAR) rather than dynamically,
 * otherwise Expo's build-time bundler cannot inline the values in production builds.
 */

export const config = {
  apiFootball: {
    host: process.env.EXPO_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io',
    key: process.env.EXPO_PUBLIC_API_FOOTBALL_KEY || '',
    get baseUrl() {
      return `https://${this.host}`;
    },
  },
  sportsDb: {
    key: process.env.EXPO_PUBLIC_SPORTSDB_KEY || '3',
    get baseUrl() {
      return `https://www.thesportsdb.com/api/v1/json/${this.key}`;
    },
  },
  app: {
    defaultSeason: Number(process.env.EXPO_PUBLIC_DEFAULT_SEASON || '2024'),
    liveRefreshMs: Number(process.env.EXPO_PUBLIC_LIVE_REFRESH_MS || '1200000'),
    fixturesRefreshMs: Number(process.env.EXPO_PUBLIC_FIXTURES_REFRESH_MS || '3600000'),
    dailyQuota: 100, // API-Football free tier
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhzdkjiisgntqpdgrjpq.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5H053SjmcKqEOkDcAY_QPA_8ZSXDbv2',
  },
} as const;

export const hasApiKey = (): boolean => config.apiFootball.key.length > 0;
