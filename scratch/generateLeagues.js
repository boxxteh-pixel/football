const fs = require('fs');

const COUNTRY_MAP = {
  '153732': { name: 'India', emoji: '🇮🇳', code: 'IN' },
  '99474': { name: 'International', emoji: '🌍', code: 'INT', isInternational: true },
  '98': { name: 'Australia', emoji: '🇦🇺', code: 'AU' },
  '2817': { name: 'New Zealand', emoji: '🇳🇿', code: 'NZ' },
  '43444': { name: 'Afghanistan', emoji: '🇦🇫', code: 'AF' },
  '52126': { name: 'Pakistan', emoji: '🇵🇰', code: 'PK' },
  '155043': { name: 'Bangladesh', emoji: '🇧🇩', code: 'BD' },
  '146': { name: 'South Africa', emoji: '🇿🇦', code: 'ZA' },
  '11240938': { name: 'Asia', emoji: '🌍', code: 'ASIA', isInternational: true },
  '462': { name: 'England', emoji: '🇬🇧', code: 'GB' },
  '2325': { name: 'Zimbabwe', emoji: '🇿🇼', code: 'ZW' },
  '2802': { name: 'UAE', emoji: '🇦🇪', code: 'AE' },
  '41': { name: 'Europe', emoji: '🇪🇺', code: 'EU', isInternational: true },
  '74505': { name: 'Qatar', emoji: '🇶🇦', code: 'QA' },
  '1233': { name: 'Finland', emoji: '🇫🇮', code: 'FI' },
  '47': { name: 'Sweden', emoji: '🇸🇪', code: 'SE' },
  '62': { name: 'Switzerland', emoji: '🇨🇭', code: 'CH' },
  '11': { name: 'Germany', emoji: '🇩🇪', code: 'DE' },
  '116': { name: 'Cyprus', emoji: '🇨🇾', code: 'CY' },
  '2405': { name: 'Estonia', emoji: '🇪🇪', code: 'EE' },
  '556': { name: 'Belgium', emoji: '🇧🇪', code: 'BE' },
  '143': { name: 'Austria', emoji: '🇦🇹', code: 'AT' },
  '674': { name: 'Hungary', emoji: '🇭🇺', code: 'HU' },
  '251': { name: 'Italy', emoji: '🇮🇹', code: 'IT' },
  '224': { name: 'Bulgaria', emoji: '🇧🇬', code: 'BG' },
  '155': { name: 'Romania', emoji: '🇷🇴', code: 'RO' },
  '38': { name: 'Netherlands', emoji: '🇳🇱', code: 'NL' },
  '20': { name: 'Portugal', emoji: '🇵🇹', code: 'PT' },
  '245': { name: 'Czech Republic', emoji: '🇨🇿', code: 'CZ' },
  '32': { name: 'Spain', emoji: '🇪🇸', code: 'ES' },
  '2756': { name: 'Malta', emoji: '🇲🇹', code: 'MT' },
  '320': { name: 'Denmark', emoji: '🇩🇰', code: 'DK' },
  '1161': { name: 'Scotland', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO' },
};

function cleanString(str) {
  return str.replace(/'/g, "\\'");
}

function generate() {
  const fbRaw = JSON.parse(fs.readFileSync('scratch/football_leagues.json', 'utf8'));
  const crRaw = JSON.parse(fs.readFileSync('scratch/cricket_leagues.json', 'utf8'));

  const footballLeagues = [];
  fbRaw.forEach(item => {
    // Only actual football leagues (sport_id === 1)
    if (item.sport_id === 1) {
      const cMeta = COUNTRY_MAP[String(item.country_id)] || { name: 'World', emoji: '⚽', code: 'WLD' };
      footballLeagues.push({
        id: item.id,
        sportmonksId: item.id,
        name: cleanString(item.name),
        shortName: cleanString(item.name.substring(0, 15)),
        country: cMeta.name,
        countryCode: cMeta.code,
        emoji: cMeta.emoji,
        isInternational: cMeta.isInternational || false,
        isCup: item.type === 'cup' || item.sub_type === 'play-offs',
      });
    }
  });

  const cricketLeagues = [];
  crRaw.forEach(item => {
    const cMeta = COUNTRY_MAP[String(item.country_id)] || { name: 'International', emoji: '🏏', code: 'INT', isInternational: true };
    cricketLeagues.push({
      id: item.id,
      sportmonksId: item.id,
      name: cleanString(item.name),
      shortName: cleanString(item.code || item.name.substring(0, 15)),
      country: cMeta.name,
      countryCode: cMeta.code,
      emoji: cMeta.emoji,
      isInternational: cMeta.isInternational || item.type === 'phase' || item.name.includes('ICC') || item.name.includes('World Cup'),
      isCup: item.type === 'cup' || item.type === 'phase',
    });
  });

  const output = `/**
 * Leagues tracked by BORO AI.
 *
 * Generated automatically from active plan subscriptions.
 */
export interface TrackedLeague {
  id: number;
  sportmonksId: number;
  name: string;
  shortName: string;
  country: string;
  countryCode?: string;
  emoji: string;
  isInternational?: boolean;
  isCup?: boolean;
}

export const FOOTBALL_LEAGUES: TrackedLeague[] = ${JSON.stringify(footballLeagues, null, 2)};

export const CRICKET_LEAGUES: TrackedLeague[] = ${JSON.stringify(cricketLeagues, null, 2)};

// In-place mutable arrays and objects to maintain reactive compatibility across imports
export const DEFAULT_LEAGUES: TrackedLeague[] = [];
export const DEFAULT_LEAGUE_IDS: number[] = [];
export const LEAGUE_TO_SPORTMONKS: Record<number, number> = {};
export const SPORTMONKS_TO_LEAGUE: Record<number, number> = {};

export const getLeagueById = (id: number): TrackedLeague | undefined => {
  return DEFAULT_LEAGUES.find((l) => l.id === id);
};

// Helper to update arrays/records in place based on selected sport
export const updateTrackedLeagues = (sport: string) => {
  const source = sport === 'cricket' ? CRICKET_LEAGUES : FOOTBALL_LEAGUES;

  // Clear and update DEFAULT_LEAGUES
  DEFAULT_LEAGUES.length = 0;
  DEFAULT_LEAGUES.push(...source);

  // Clear and update DEFAULT_LEAGUE_IDS
  DEFAULT_LEAGUE_IDS.length = 0;
  DEFAULT_LEAGUE_IDS.push(...DEFAULT_LEAGUES.map((l) => l.id));

  // Clear and update LEAGUE_TO_SPORTMONKS
  for (const key in LEAGUE_TO_SPORTMONKS) {
    delete LEAGUE_TO_SPORTMONKS[key];
  }
  // Clear and update SPORTMONKS_TO_LEAGUE
  for (const key in SPORTMONKS_TO_LEAGUE) {
    delete SPORTMONKS_TO_LEAGUE[key];
  }

  // Populate records
  source.forEach((l) => {
    LEAGUE_TO_SPORTMONKS[l.id] = l.sportmonksId;
    SPORTMONKS_TO_LEAGUE[l.sportmonksId] = l.id;
  });
};

import { useSettingsStore } from '@/store/settingsStore';

// Initialize
try {
  const currentSport = useSettingsStore.getState().settings.sport || 'football';
  updateTrackedLeagues(currentSport);
} catch {
  updateTrackedLeagues('football');
}

// Subscribe to store updates to dynamically adjust leagues
try {
  let prevSport = useSettingsStore.getState().settings.sport || 'football';
  useSettingsStore.subscribe(
    (state) => {
      const currentSport = state.settings.sport || 'football';
      if (currentSport !== prevSport) {
        prevSport = currentSport;
        updateTrackedLeagues(currentSport);
      }
    }
  );
} catch {}
`;

  fs.writeFileSync('src/constants/leagues.ts', output);
  console.log('Successfully generated src/constants/leagues.ts!');
}

generate();
