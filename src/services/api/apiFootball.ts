import { apiClient } from './client';
import { config, hasApiKey } from '@/constants/config';
import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord } from '@/types/match';
import type { League, StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';
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

interface ApiResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

const unwrap = <T>(data: ApiResponse<T>): T => data.response;

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
  const { data } = await apiClient.get<ApiResponse<Fixture[]>>('/fixtures', {
    params: {
      date,
      ...(leagueId ? { league: leagueId, season } : {}),
      timezone: 'Europe/London',
    },
  });
  return unwrap(data);
};

export const fetchLiveFixtures = async (leagueIds?: number[]): Promise<Fixture[]> => {
  if (!hasApiKey()) {
    return getMockLiveFixtures(leagueIds);
  }
  const { data } = await apiClient.get<ApiResponse<Fixture[]>>('/fixtures', {
    params: {
      live: leagueIds && leagueIds.length > 0 ? leagueIds.join('-') : 'all',
    },
  });
  return unwrap(data);
};

export const fetchFixtureById = async (id: number): Promise<Fixture | null> => {
  if (!hasApiKey()) {
    return getMockFixtureById(id);
  }
  const { data } = await apiClient.get<ApiResponse<Fixture[]>>('/fixtures', { params: { id } });
  return unwrap(data)[0] ?? null;
};

export const fetchFixtureEvents = async (fixtureId: number): Promise<FixtureEvent[]> => {
  if (!hasApiKey()) {
    return getMockFixtureEvents(fixtureId);
  }
  const { data } = await apiClient.get<ApiResponse<FixtureEvent[]>>('/fixtures/events', {
    params: { fixture: fixtureId },
  });
  return unwrap(data);
};

export const fetchFixtureStatistics = async (fixtureId: number): Promise<FixtureStatistic[]> => {
  if (!hasApiKey()) {
    return getMockFixtureStats(fixtureId);
  }
  const { data } = await apiClient.get<ApiResponse<FixtureStatistic[]>>('/fixtures/statistics', {
    params: { fixture: fixtureId },
  });
  return unwrap(data);
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
    const { data } = await apiClient.get<
      ApiResponse<Array<{ league: { standings: StandingRow[][] } }>>
    >('/standings', { params: { league: leagueId, season } });
    return unwrap(data)[0]?.league?.standings?.[0] ?? [];
  });
};

export const fetchTeamStatistics = async (
  teamId: number,
  leagueId: number,
  season: number = config.app.defaultSeason,
): Promise<TeamStatistics | null> => {
  const cacheKey = `teamStats-${teamId}-${leagueId}-${season}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey()) {
      return getMockTeamStats(teamId, leagueId);
    }
    const { data } = await apiClient.get<ApiResponse<TeamStatistics>>('/teams/statistics', {
      params: { team: teamId, league: leagueId, season },
    });
    return data.response ?? null;
  });
};

export const fetchTeamLastFixtures = async (
  teamId: number,
  last = 10,
): Promise<Fixture[]> => {
  const cacheKey = `teamLast-${teamId}-${last}`;
  return cachedCall(cacheKey, async () => {
    if (!hasApiKey()) {
      return getMockTeamLastFixtures(teamId, last);
    }
    try {
      const { data } = await apiClient.get<ApiResponse<Fixture[]>>('/fixtures', {
        params: { team: teamId, last },
      });
      return unwrap(data);
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('last parameter') || error?.message?.toLowerCase().includes('free plan')) {
        const { data } = await apiClient.get<ApiResponse<Fixture[]>>('/fixtures', {
          params: { team: teamId, season: config.app.defaultSeason },
        });
        const all = unwrap(data);
        return all
          .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
          .slice(0, last);
      }
      throw error;
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
    if (!hasApiKey()) {
      return getMockHeadToHead(team1, team2, last);
    }
    try {
      const { data } = await apiClient.get<ApiResponse<H2HRecord[]>>('/fixtures/headtohead', {
        params: { h2h: `${team1}-${team2}`, last },
      });
      return unwrap(data);
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('last parameter') || error?.message?.toLowerCase().includes('free plan')) {
        const { data } = await apiClient.get<ApiResponse<H2HRecord[]>>('/fixtures/headtohead', {
          params: { h2h: `${team1}-${team2}` },
        });
        const all = unwrap(data);
        return all
          .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
          .slice(0, last);
      }
      throw error;
    }
  });
};

export const fetchLeagues = async (current = true): Promise<Array<{ league: League }>> => {
  if (!hasApiKey()) {
    return Object.values(MOCK_LEAGUES).map((league) => ({
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        logo: league.logo,
        season: league.season,
      },
    }));
  }
  const { data } = await apiClient.get<ApiResponse<Array<{ league: League }>>>('/leagues', {
    params: current ? { current: 'true' } : {},
  });
  return unwrap(data);
};
