/**
 * Default leagues tracked by BORO AI. IDs map to API-Football league IDs.
 * Source: https://www.api-football.com/documentation-v3#section/Authentication
 */
export interface TrackedLeague {
  id: number;
  name: string;
  shortName: string;
  country: string;
  countryCode?: string;
  emoji: string;
  isInternational?: boolean;
}

export const DEFAULT_LEAGUES: TrackedLeague[] = [
  { id: 39, name: 'Premier League', shortName: 'EPL', country: 'England', countryCode: 'GB', emoji: '󠁧󠁢' },
  { id: 140, name: 'La Liga', shortName: 'LaLiga', country: 'Spain', countryCode: 'ES', emoji: '' },
  { id: 135, name: 'Serie A', shortName: 'Serie A', country: 'Italy', countryCode: 'IT', emoji: '' },
  { id: 136, name: 'Serie B', shortName: 'Serie B', country: 'Italy', countryCode: 'IT', emoji: '' },
  { id: 78, name: 'Bundesliga', shortName: 'BuLi', country: 'Germany', countryCode: 'DE', emoji: '' },
  { id: 61, name: 'Ligue 1', shortName: 'L1', country: 'France', countryCode: 'FR', emoji: '' },
  { id: 88, name: 'Eredivisie', shortName: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', emoji: '' },
  { id: 94, name: 'Primeira Liga', shortName: 'Liga PT', country: 'Portugal', countryCode: 'PT', emoji: '' },
  { id: 307, name: 'Saudi Professional League', shortName: 'Saudi Pro', country: 'Saudi Arabia', countryCode: 'SA', emoji: '' },
  { id: 2, name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe', emoji: '', isInternational: true },
  { id: 3, name: 'UEFA Europa League', shortName: 'UEL', country: 'Europe', emoji: '', isInternational: true },
  { id: 253, name: 'Major League Soccer', shortName: 'MLS', country: 'USA', countryCode: 'US', emoji: '' },
];

export const DEFAULT_LEAGUE_IDS = DEFAULT_LEAGUES.map((l) => l.id);

export const getLeagueById = (id: number): TrackedLeague | undefined =>
  DEFAULT_LEAGUES.find((l) => l.id === id);
