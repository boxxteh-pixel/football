/**
 * Runtime configuration sourced from environment variables (Expo public env).
 * Falls back to safe defaults when not set so the app still boots.
 */

const getEnv = (key: string, fallback = ''): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (process.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : fallback;
};

export const config = {
  apiFootball: {
    host: getEnv('EXPO_PUBLIC_API_FOOTBALL_HOST', 'v3.football.api-sports.io'),
    key: getEnv('EXPO_PUBLIC_API_FOOTBALL_KEY', ''),
    get baseUrl() {
      return `https://${this.host}`;
    },
  },
  sportsDb: {
    key: getEnv('EXPO_PUBLIC_SPORTSDB_KEY', '3'),
    get baseUrl() {
      return `https://www.thesportsdb.com/api/v1/json/${this.key}`;
    },
  },
  app: {
    defaultSeason: Number(getEnv('EXPO_PUBLIC_DEFAULT_SEASON', '2024')),
    liveRefreshMs: Number(getEnv('EXPO_PUBLIC_LIVE_REFRESH_MS', '60000')),
    fixturesRefreshMs: Number(getEnv('EXPO_PUBLIC_FIXTURES_REFRESH_MS', '600000')),
    dailyQuota: 100, // API-Football free tier
  },
  supabase: {
    url: getEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://bhzdkjiisgntqpdgrjpq.supabase.co'),
    anonKey: getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_5H053SjmcKqEOkDcAY_QPA_8ZSXDbv2'),
  },
} as const;

export const hasApiKey = (): boolean => config.apiFootball.key.length > 0;
