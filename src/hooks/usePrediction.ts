import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Fixture } from '@/types/match';
import { predictFixture, quickPredict } from '@/services/ai/predictor';
import {
  fetchHeadToHead,
  fetchTeamLastFixtures,
  fetchTeamStatistics,
} from '@/services/api/apiFootball';
import { fetchMatchInsights } from '@/services/api/smInsights';
import { useLearningStore } from '@/store/learningStore';

/**
 * Lightweight, synchronous prediction used in list rows and cards.
 * No network calls — uses neutral Poisson defaults.
 */
export const useQuickPrediction = (fixture: Fixture) => {
  return useMemo(() => quickPredict(fixture), [fixture.fixture.id]);
};

/**
 * Full ensemble prediction: team histories + H2H + season stats +
 * real SportMonks insights (provider predictions, devigged bookmaker odds, xG).
 * Used on the Match Detail screen.
 */
export const useFullPrediction = (fixture: Fixture | null | undefined) => {
  const homeId = fixture?.teams.home.id;
  const awayId = fixture?.teams.away.id;
  const leagueId = fixture?.league.id;
  const season = fixture?.league.season;
  const enabled = Boolean(fixture && homeId && awayId && leagueId);

  return useQuery({
    queryKey: ['prediction', fixture?.fixture.id],
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const [homeHistory, awayHistory, homeStats, awayStats, h2h, insights] = await Promise.all([
        fetchTeamLastFixtures(homeId!, 10).catch(() => []),
        fetchTeamLastFixtures(awayId!, 10).catch(() => []),
        fetchTeamStatistics(homeId!, leagueId!, season).catch(() => null),
        fetchTeamStatistics(awayId!, leagueId!, season).catch(() => null),
        fetchHeadToHead(homeId!, awayId!, 5).catch(() => []),
        fetchMatchInsights(fixture!.fixture.id, homeId!, awayId!).catch(() => null),
      ]);

      const result = predictFixture({
        fixture: fixture!,
        homeHistory,
        awayHistory,
        homeStats,
        awayStats,
        h2h,
        insights,
      });

      // Self-learning feedback loop: record outcomes of completed matches.
      const statusShort = fixture!.fixture.status.short;
      const finished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort);
      if (finished && fixture!.goals.home !== null && fixture!.goals.away !== null) {
        useLearningStore.getState().recordOutcome(fixture!, result).catch(() => {});
      }

      return result;
    },
  });
};
