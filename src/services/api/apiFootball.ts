import { config, hasApiKey } from '@/constants/config';
import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord } from '@/types/match';
import type { League, StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';
import { DEFAULT_LEAGUES, DEFAULT_LEAGUE_IDS } from '@/constants/leagues';
import {
  getMockFixtures,
  getMockLiveFixtures,
  getMockFixtureById,
  getMockFixtureEvents,
  getMockFixtureStats,
  getMockStandings,
  getMockTeamStats,
  getMockTeamLastFixtures,
  getMockHeadToHead,
  MOCK_LEAGUES,
} from './mockData';
import {
  fetchSportmonksFixturesByDate,
  fetchSportmonksFixturesByDateMulti,
  fetchSportmonksLiveFixtures,
  fetchSportmonksFixtureById,
  fetchSportmonksFixtureEvents,
  fetchSportmonksFixtureStatistics,
  fetchSportmonksStandings,
  fetchSportmonksTeamStatistics,
  fetchSportmonksTeamLastFixtures,
  fetchSportmonksHeadToHead,
} from './sportmonks';

// In-memory cache to prevent repetitive static calls during a single app session
const memoryCache = new Map<string, any>();

const cachedCall = async <T>(cacheKey: string, fetcherFn: () => Promise<T>): Promise<T> => {
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  const result = await fetcherFn();
  memoryCache.set(cacheKey, result);
  return result;
};

export const fetchFixturesByDate = async (
  date: string,
  leagueId?: number,
  season: number = config.app.defaultSeason,
): Promise<Fixture[]> => {
  if (!hasApiKey()) {
    return getMockFixtures(date, leagueId);
  }
  
  try {
    if (!leagueId) {
      // Batch ALL tracked leagues into a single paginated request instead of
      // firing one HTTP call per league (avoids rate-limit blowups as the
      // number of tracked leagues grows).
      const smResults = await fetchSportmonksFixturesByDateMulti(date, DEFAULT_LEAGUE_IDS);
      const byId = new Map<number, Fixture>();
      smResults.forEach((fixture) => byId.set(fixture.fixture.id, fixture));

      // If there are no matches today, return empty — do NOT inject fake mock data
      return [...byId.values()].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }

    // Single league query — return whatever the API gives (even if empty)
    return await fetchSportmonksFixturesByDate(date, leagueId);
  } catch (err) {
    console.error('[apiFootball] fetchFixturesByDate failed, falling back to mock:', err);
    return getMockFixtures(date, leagueId);
  }
};


export const fetchLiveFixtures = async (leagueIds?: number[]): Promise<Fixture[]> => {
  if (!hasApiKey()) {
    return getMockLiveFixtures(leagueIds);
  }
  
  try {
    // Return only real live fixtures — no mock injection
    return await fetchSportmonksLiveFixtures(leagueIds ?? DEFAULT_LEAGUE_IDS);
  } catch (err) {
    console.error('[apiFootball] fetchLiveFixtures failed, falling back to mock:', err);
    return getMockLiveFixtures(leagueIds);
  }
};

export const fetchFixtureById = async (id: number): Promise<Fixture | null> => {
  if (!hasApiKey()) {
    return getMockFixtureById(id);
  }
  
  try {
    const smFix = await fetchSportmonksFixtureById(id);
    if (smFix) return smFix;
    return getMockFixtureById(id);
  } catch (err) {
    return getMockFixtureById(id);
  }
};

export const fetchFixtureEvents = async (fixtureId: number): Promise<FixtureEvent[]> => {
  if (!hasApiKey()) {
    return getMockFixtureEvents(fixtureId);
  }
  
  try {
    return await fetchSportmonksFixtureEvents(fixtureId);
  } catch (err) {
    return getMockFixtureEvents(fixtureId);
  }
};

export const fetchFixtureStatistics = async (fixtureId: number): Promise<FixtureStatistic[]> => {
  if (!hasApiKey()) {
    return getMockFixtureStats(fixtureId);
  }
  
  try {
    return await fetchSportmonksFixtureStatistics(fixtureId);
  } catch (err) {
    return getMockFixtureStats(fixtureId);
  }
};

export const fetchStandings = async (
  leagueId: number,
  season: number = config.app.defaultSeason,
): Promise<StandingRow[]> => {
  const cacheKey = `standings-${leagueId}-${season}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey()) {
      return getMockStandings(leagueId);
    }
    try {
      const smStandings = await fetchSportmonksStandings(leagueId);
      if (smStandings && smStandings.length > 0) return smStandings;
      return getMockStandings(leagueId);
    } catch (err) {
      return getMockStandings(leagueId);
    }
  });
};

export const fetchTeamStatistics = async (
  teamId: number,
  leagueId: number,
  season: number = config.app.defaultSeason,
): Promise<TeamStatistics | null> => {
  const cacheKey = `teamStats-${teamId}-${leagueId}-${season}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey() || teamId >= 9000) {
      return getMockTeamStats(teamId, leagueId);
    }
    try {
      const smStats = await fetchSportmonksTeamStatistics(teamId, leagueId);
      if (smStats) return smStats;
      return getMockTeamStats(teamId, leagueId);
    } catch (err) {
      return getMockTeamStats(teamId, leagueId);
    }
  });
};

export const fetchTeamLastFixtures = async (
  teamId: number,
  last = 10,
): Promise<Fixture[]> => {
  const cacheKey = `teamLast-${teamId}-${last}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey() || teamId >= 9000) {
      return getMockTeamLastFixtures(teamId, last);
    }
    try {
      const smLast = await fetchSportmonksTeamLastFixtures(teamId, last);
      if (smLast && smLast.length > 0) return smLast;
      return getMockTeamLastFixtures(teamId, last);
    } catch (err) {
      return getMockTeamLastFixtures(teamId, last);
    }
  });
};

export const fetchHeadToHead = async (
  team1: number,
  team2: number,
  last = 5,
): Promise<H2HRecord[]> => {
  const cacheKey = `h2h-${team1}-${team2}-${last}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey() || team1 >= 9000 || team2 >= 9000) {
      return getMockHeadToHead(team1, team2, last);
    }
    try {
      const smH2h = await fetchSportmonksHeadToHead(team1, team2, last);
      if (smH2h && smH2h.length > 0) return smH2h;
      return getMockHeadToHead(team1, team2, last);
    } catch (err) {
      return getMockHeadToHead(team1, team2, last);
    }
  });
};

export const fetchLeagues = async (current = true): Promise<Array<{ league: League }>> => {
  return DEFAULT_LEAGUES.map((league) => ({
    league: {
      id: league.id,
      name: league.name,
      country: league.country,
      logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
      season: config.app.defaultSeason,
    },
  }));
};
