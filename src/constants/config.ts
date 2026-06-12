export const config = {
  app: {
    defaultSeason: 2024,
    liveRefreshMs: 30000,
    trackerRefreshMs: 30000,
    fixturesRefreshMs: 1800000,
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bhzdkjiisgntqpdgrjpq.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5H053SjmcKqEOkDcAY_QPA_8ZSXDbv2',
  },
} as const;

export const getSportmonksKey = (): string => 'polymarket';
export const getSportmonksBaseUrl = (): string => 'polymarket';
export const hasApiKey = (): boolean => true;
export const isCricketMode = (): boolean => false;
