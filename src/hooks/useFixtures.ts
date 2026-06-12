import { useQuery } from '@tanstack/react-query';
import {
  fetchTrendingEvents,
  fetchEventsByCategory,
  fetchEventById,
  searchEvents,
  PolymarketEvent,
} from '@/services/api/polymarket';

export const useTodayFixtures = (categorySlug: string = 'all') =>
  useQuery({
    queryKey: ['polymarket', 'events', categorySlug],
    queryFn: () => fetchEventsByCategory(categorySlug),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });

export const useLiveFixtures = (categorySlug: string = 'all', enabled = true) =>
  useQuery({
    queryKey: ['polymarket', 'live', categorySlug],
    queryFn: () => fetchTrendingEvents(),
    refetchInterval: enabled ? 30000 : false,
    staleTime: 20000,
    enabled,
    placeholderData: (prev) => prev,
  });

export const useFixture = (id: string | undefined) =>
  useQuery({
    queryKey: ['polymarket', 'event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

export const useSearchEvents = (query: string) =>
  useQuery({
    queryKey: ['polymarket', 'search', query],
    queryFn: () => searchEvents(query),
    enabled: query.length > 1,
    staleTime: 60 * 1000,
  });

// Compatibility stubs so components don't crash
export const useFixtureEvents = (id: any, isLive: boolean) =>
  useQuery({
    queryKey: ['fixture-events', id],
    queryFn: async () => [],
    enabled: false,
  });

export const useFixtureStats = (id: any, isLive: boolean) =>
  useQuery({
    queryKey: ['fixture-stats', id],
    queryFn: async () => [],
    enabled: false,
  });

export const useStandings = (id: any) =>
  useQuery({
    queryKey: ['standings', id],
    queryFn: async () => [],
    enabled: false,
  });

export const useTeamLastFixtures = (id: any) =>
  useQuery({
    queryKey: ['team-last', id],
    queryFn: async () => [],
    enabled: false,
  });

export const useTeamStats = (teamId: any, leagueId: any) =>
  useQuery({
    queryKey: ['team-stats', teamId, leagueId],
    queryFn: async () => null,
    enabled: false,
  });

export const useH2H = (homeId: any, awayId: any) =>
  useQuery({
    queryKey: ['h2h', homeId, awayId],
    queryFn: async () => [],
    enabled: false,
  });
