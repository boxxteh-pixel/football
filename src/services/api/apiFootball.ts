import { config, hasApiKey, isCricketMode } from '@/constants/config';
import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord } from '@/types/match';
import { isLive, isScheduled } from '@/types/match';
import type { League, StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';
import { DEFAULT_LEAGUES, DEFAULT_LEAGUE_IDS } from '@/constants/leagues';
import { inMatchWindow, MATCH_WINDOW_FUTURE_MS } from '@/utils/date';
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
  fetchSportmonksFixturesBetween,
  fetchSportmonksFixturesBetweenAll,
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

      let results = [...byId.values()].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
      if (results.length === 0) {
        console.log(`[apiFootball] No tracked fixtures on ${date}. Querying unfiltered fallback...`);
        results = await fetchSportmonksFixturesBetweenAll(date, date);
      }
      return results;
    }

    // Single league query — return whatever the API gives (even if empty)
    return await fetchSportmonksFixturesByDate(date, leagueId);
  } catch (err) {
    console.error('[apiFootball] fetchFixturesByDate failed, falling back to mock:', err);
    return getMockFixtures(date, leagueId);
  }
};

/**
 * Smart upcoming fixtures: returns the given date's matches, or — when that day
 * is empty (e.g. off-season gaps, mid-week with no games) — the NEXT match day
 * within the lookahead window. Keeps the app useful instead of showing an empty
 * slate. Returns the resolved date alongside the fixtures.
 */
export const fetchUpcomingFixtures = async (
  fromDate: string,
  leagueIds: number[] = DEFAULT_LEAGUE_IDS,
  lookaheadDays = 7,
): Promise<{ date: string; fixtures: Fixture[] }> => {
  if (!hasApiKey()) {
    return { date: fromDate, fixtures: getMockFixtures(fromDate) };
  }
  
  const cricket = isCricketMode();
  // Cricket needs up to 10 matches over a wide range (e.g. 90 days)
  const actualLookahead = cricket ? 90 : lookaheadDays;

  try {
    // Fetch a window starting ONE day before (UTC) through the lookahead, so
    // late-night local kickoffs that live in the previous UTC date bucket are
    // captured (timezone-proof — fixes matches vanishing after local midnight).
    const startBound = new Date(fromDate + 'T00:00:00Z');
    startBound.setUTCDate(startBound.getUTCDate() - 1);
    const fromIso = startBound.toISOString().split('T')[0];
    const end = new Date(fromDate + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + actualLookahead);
    const toIso = end.toISOString().split('T')[0];

    let all = await fetchSportmonksFixturesBetween(fromIso, toIso, leagueIds);
    if (all.length === 0) {
      console.log(`[apiFootball] No tracked fixtures between ${fromIso} and ${toIso}. Querying unfiltered fallback...`);
      all = await fetchSportmonksFixturesBetweenAll(fromIso, toIso);
    }

    if (cricket) {
      const now = Date.now();
      // Keep only live/upcoming/finished matches today and onwards, sort ascending, slice to 10
      const upcomingCricket = all
        .filter((f) => f.fixture.timestamp * 1000 >= now - 4 * 3600 * 1000)
        .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp)
        .slice(0, 10);
      return { date: fromDate, fixtures: upcomingCricket };
    }

    // Primary: live + upcoming matches in the rolling window relative to now.
    const now = Date.now();
    const windowed = all
      .filter((f) => inMatchWindow(f.fixture.timestamp, now))
      .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    if (windowed.length > 0) {
      return { date: fromDate, fixtures: windowed };
    }

    // Fallback (off-season / empty window): earliest upcoming day with games.
    const byDay = new Map<string, Fixture[]>();
    all
      .filter((f) => (isLive(f.fixture.status.short) || isScheduled(f.fixture.status.short)) && f.fixture.timestamp * 1000 >= now - MATCH_WINDOW_FUTURE_MS)
      .forEach((f) => {
        const day = new Date(f.fixture.timestamp * 1000).toISOString().split('T')[0];
        const arr = byDay.get(day) ?? [];
        arr.push(f);
        byDay.set(day, arr);
      });
    const firstDay = [...byDay.keys()].sort()[0];
    if (!firstDay) return { date: fromDate, fixtures: [] };
    return {
      date: firstDay,
      fixtures: (byDay.get(firstDay) ?? []).sort((a, b) => a.fixture.timestamp - b.fixture.timestamp),
    };
  } catch (err) {
    console.error('[apiFootball] fetchUpcomingFixtures failed:', err);
    return { date: fromDate, fixtures: [] };
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
