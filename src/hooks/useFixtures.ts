import { useQuery } from '@tanstack/react-query';
import {
  fetchFixtureById,
  fetchFixtureEvents,
  fetchFixtureStatistics,
  fetchFixturesByDate,
  fetchLiveFixtures,
  fetchTeamLastFixtures,
  fetchTeamStatistics,
  fetchHeadToHead,
  fetchStandings,
} from '@/services/api/apiFootball';
import { config } from '@/constants/config';
import { isLive } from '@/types/match';
import { todayIsoDate } from '@/utils/date';

const fiveMinutes = 5 * 60 * 1000;
const oneHour = 60 * 60 * 1000;
const oneDay = 24 * 60 * 60 * 1000;

export const useTodayFixtures = (leagueId?: number) =>
  useQuery({
    queryKey: ['fixtures', 'today', todayIsoDate(), leagueId ?? 'all'],
    queryFn: () => fetchFixturesByDate(todayIsoDate(), leagueId),
    staleTime: fiveMinutes,
  });

export const useFixturesByDate = (date: string, leagueId?: number) =>
  useQuery({
    queryKey: ['fixtures', 'date', date, leagueId ?? 'all'],
    queryFn: () => fetchFixturesByDate(date, leagueId),
    staleTime: fiveMinutes,
  });

export const useLiveFixtures = (leagueIds?: number[]) =>
  useQuery({
    queryKey: ['fixtures', 'live', leagueIds?.join(',') ?? 'all'],
    queryFn: () => fetchLiveFixtures(leagueIds),
    refetchInterval: config.app.liveRefreshMs,
    refetchIntervalInBackground: false,
    staleTime: config.app.liveRefreshMs / 2,
  });

export const useFixture = (id: number | undefined) =>
  useQuery({
    queryKey: ['fixture', id],
    queryFn: () => fetchFixtureById(id!),
    enabled: typeof id === 'number',
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && isLive(data.fixture.status.short)) return config.app.liveRefreshMs;
      return false;
    },
  });

export const useFixtureEvents = (id: number | undefined, isLiveFixture: boolean) =>
  useQuery({
    queryKey: ['fixture', id, 'events'],
    queryFn: () => fetchFixtureEvents(id!),
    enabled: typeof id === 'number',
    refetchInterval: isLiveFixture ? config.app.liveRefreshMs : false,
  });

export const useFixtureStats = (id: number | undefined, isLiveFixture: boolean) =>
  useQuery({
    queryKey: ['fixture', id, 'stats'],
    queryFn: () => fetchFixtureStatistics(id!),
    enabled: typeof id === 'number',
    refetchInterval: isLiveFixture ? config.app.liveRefreshMs : false,
  });

export const useStandings = (leagueId: number, season?: number) =>
  useQuery({
    queryKey: ['standings', leagueId, season ?? config.app.defaultSeason],
    queryFn: () => fetchStandings(leagueId, season),
    staleTime: oneHour,
  });

export const useTeamLastFixtures = (teamId: number | undefined, last = 10) =>
  useQuery({
    queryKey: ['team', teamId, 'last', last],
    queryFn: () => fetchTeamLastFixtures(teamId!, last),
    enabled: typeof teamId === 'number',
    staleTime: oneHour,
  });

export const useTeamStats = (
  teamId: number | undefined,
  leagueId: number | undefined,
  season?: number,
) =>
  useQuery({
    queryKey: ['team', teamId, 'stats', leagueId, season ?? config.app.defaultSeason],
    queryFn: () => fetchTeamStatistics(teamId!, leagueId!, season),
    enabled: typeof teamId === 'number' && typeof leagueId === 'number',
    staleTime: oneHour,
  });

export const useH2H = (homeId: number | undefined, awayId: number | undefined) =>
  useQuery({
    queryKey: ['h2h', homeId, awayId],
    queryFn: () => fetchHeadToHead(homeId!, awayId!),
    enabled: typeof homeId === 'number' && typeof awayId === 'number',
    staleTime: oneDay,
  });
