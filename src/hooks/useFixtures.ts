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

const oneDay = 24 * 60 * 60 * 1000;

export const useTodayFixtures = (leagueId?: number) =>
  useQuery({
    queryKey: ['fixtures', 'today', todayIsoDate(), leagueId ?? 'all'],
    queryFn: () => fetchFixturesByDate(todayIsoDate(), leagueId),
    staleTime: 5 * 60 * 1000, // 5 minutes — ensures fresh data on each visit
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });

export const useFixturesByDate = (date: string, leagueId?: number) =>
  useQuery({
    queryKey: ['fixtures', 'date', date, leagueId ?? 'all'],
    queryFn: () => fetchFixturesByDate(date, leagueId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useLiveFixtures = (leagueIds?: number[], enabled = true) =>
  useQuery({
    queryKey: ['fixtures', 'live', leagueIds?.join(',') ?? 'all'],
    queryFn: () => fetchLiveFixtures(leagueIds),
    refetchInterval: enabled ? config.app.liveRefreshMs : false,
    refetchIntervalInBackground: false,
    staleTime: config.app.liveRefreshMs / 2,
    enabled: enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useFixture = (id: number | undefined) =>
  useQuery({
    queryKey: ['fixture', id],
    queryFn: () => fetchFixtureById(id!),
    enabled: typeof id === 'number' && Number.isFinite(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
    enabled: typeof id === 'number' && Number.isFinite(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: isLiveFixture ? config.app.liveRefreshMs : false,
  });

export const useFixtureStats = (id: number | undefined, isLiveFixture: boolean) =>
  useQuery({
    queryKey: ['fixture', id, 'stats'],
    queryFn: () => fetchFixtureStatistics(id!),
    enabled: typeof id === 'number' && Number.isFinite(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: isLiveFixture ? config.app.liveRefreshMs : false,
  });

export const useStandings = (leagueId: number, season?: number) =>
  useQuery({
    queryKey: ['standings', leagueId, season ?? config.app.defaultSeason],
    queryFn: () => fetchStandings(leagueId, season),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useTeamLastFixtures = (teamId: number | undefined, last = 10) =>
  useQuery({
    queryKey: ['team', teamId, 'last', last],
    queryFn: () => fetchTeamLastFixtures(teamId!, last),
    enabled: typeof teamId === 'number' && Number.isFinite(teamId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useTeamStats = (
  teamId: number | undefined,
  leagueId: number | undefined,
  season?: number,
) =>
  useQuery({
    queryKey: ['team', teamId, 'stats', leagueId, season ?? config.app.defaultSeason],
    queryFn: () => fetchTeamStatistics(teamId!, leagueId!, season),
    enabled:
      typeof teamId === 'number' &&
      Number.isFinite(teamId) &&
      typeof leagueId === 'number' &&
      Number.isFinite(leagueId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useH2H = (homeId: number | undefined, awayId: number | undefined) =>
  useQuery({
    queryKey: ['h2h', homeId, awayId],
    queryFn: () => fetchHeadToHead(homeId!, awayId!),
    enabled:
      typeof homeId === 'number' &&
      Number.isFinite(homeId) &&
      typeof awayId === 'number' &&
      Number.isFinite(awayId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
