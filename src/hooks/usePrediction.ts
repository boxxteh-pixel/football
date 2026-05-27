import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Fixture } from '@/types/match';
import { predictFixture, quickPredict } from '@/services/ai/predictor';
import {
  fetchHeadToHead,
  fetchTeamLastFixtures,
  fetchTeamStatistics,
} from '@/services/api/apiFootball';
import { fetchSportmonksPredictions } from '@/services/api/sportmonks';
import { useLearningStore } from '@/store/learningStore';

/**
 * Lightweight, synchronous prediction used in list rows and cards.
 * No network calls — uses neutral Poisson defaults.
 */
export const useQuickPrediction = (fixture: Fixture) => {
  return useMemo(() => quickPredict(fixture), [fixture.fixture.id]);
};

/**
 * Full prediction with histories + H2H + team season stats.
 * Used on Match Detail screen.
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const [homeHistory, awayHistory, homeStats, awayStats, h2h, sportmonksPred] = await Promise.all([
        fetchTeamLastFixtures(homeId!, 10).catch(() => []),
        fetchTeamLastFixtures(awayId!, 10).catch(() => []),
        fetchTeamStatistics(homeId!, leagueId!, season).catch(() => null),
        fetchTeamStatistics(awayId!, leagueId!, season).catch(() => null),
        fetchHeadToHead(homeId!, awayId!, 5).catch(() => []),
        fetchSportmonksPredictions(
          fixture!.fixture.date,
          fixture!.teams.home.name,
          fixture!.teams.away.name,
          fixture!.league.id
        ).catch(() => null),
      ]);
      const result = predictFixture({
        fixture: fixture!,
        homeHistory,
        awayHistory,
        homeStats,
        awayStats,
        h2h,
        sportmonksPred,
      });

      // Self-learning feedback loop: record outcome of completed matches to refine biases
      const statusShort = fixture!.fixture.status.short;
      const isMatchFinished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort);
      if (isMatchFinished && fixture!.goals.home !== null && fixture!.goals.away !== null) {
        useLearningStore.getState().recordOutcome(fixture!, result).catch(() => {});
      }

      return result;
    },
  });
};
