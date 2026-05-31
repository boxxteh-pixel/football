import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMatchInsights, type MatchInsights } from '@/services/api/smInsights';
import { predictFromInsights } from '@/services/ai/predictor';
import { gradePrediction, type GradedPrediction } from '@/services/ai/evaluate';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

/**
 * THE single source of truth for a fixture's prediction.
 *
 * Every surface (home cards, best-picks carousel, the match-page rainbow frame,
 * and the Results grading) reads the prediction for a fixture through this hook,
 * keyed by ['matchInsights', id]. React-query dedupes that key, so they all
 * share ONE cached insights object and run the SAME predictFromInsights on it —
 * which makes it IMPOSSIBLE for the card to say one thing and the frame another.
 *
 * No random fallback is ever shown: while insights load, prediction is null and
 * the UI shows a neutral placeholder instead of a fabricated pick.
 */
export const MATCH_INSIGHTS_KEY = 'matchInsights';

export interface FixturePrediction {
  prediction: PredictionResult | null;
  graded: GradedPrediction | null;
  isLoading: boolean;
}

export const useFixturePrediction = (fixture: Fixture | null | undefined): FixturePrediction => {
  const id = fixture?.fixture.id;
  const homeId = fixture?.teams.home.id ?? 0;
  const awayId = fixture?.teams.away.id ?? 0;

  const query = useQuery({
    queryKey: [MATCH_INSIGHTS_KEY, id],
    queryFn: () => fetchMatchInsights(id!, homeId, awayId),
    enabled: hasApiKey() && Boolean(id),
    // Insights (provider model + devigged odds) are stable enough to cache;
    // keep them long so the displayed pick never flips between views.
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return useMemo(() => {
    if (!fixture || !query.data) {
      return { prediction: null, graded: null, isLoading: query.isLoading };
    }
    const prediction = predictFromInsights(fixture, query.data);
    const graded = gradePrediction(fixture, prediction);
    return { prediction, graded, isLoading: false };
  }, [fixture, query.data, query.isLoading]);
};

/**
 * Hook returning a function to PREFILL the shared insights cache from a batch
 * fetch (today/results), so list cards don't each trigger a separate request
 * yet still read the exact same data the per-fixture hook would.
 */
export const usePrefillInsights = () => {
  const qc = useQueryClient();
  return (entries: Array<{ fixtureId: number; insights: MatchInsights }>) => {
    for (const { fixtureId, insights } of entries) {
      const existing = qc.getQueryData([MATCH_INSIGHTS_KEY, fixtureId]);
      if (!existing) qc.setQueryData([MATCH_INSIGHTS_KEY, fixtureId], insights);
    }
  };
};
