import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchMatchInsights } from '@/services/api/smInsights';
import { predictFromInsights } from '@/services/ai/predictor';
import { gradePrediction, type GradedPrediction } from '@/services/ai/evaluate';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

/**
 * The CANONICAL "BORO pick" for a fixture.
 *
 * Uses the exact same predictFromInsights(provider + devigged odds) path that
 * the Results tab and list cards use — so the pick shown on the match page is
 * IDENTICAL to the one that gets graded later (no more "match said BTTS but
 * Results said Under 2.5"). The pick is stable because it's derived from the
 * pre-match provider/odds data, which doesn't change once the game is on.
 */
export interface CanonicalPick {
  prediction: PredictionResult | null;
  graded: GradedPrediction | null;
  isLoading: boolean;
}

export const useCanonicalPick = (fixture: Fixture | null | undefined): CanonicalPick => {
  const id = fixture?.fixture.id;
  const homeId = fixture?.teams.home.id ?? 0;
  const awayId = fixture?.teams.away.id ?? 0;

  const query = useQuery({
    queryKey: ['canonicalInsights', id],
    queryFn: () => fetchMatchInsights(id!, homeId, awayId),
    enabled: hasApiKey() && Boolean(id),
    // Pre-match provider/odds → stable; cache long so the pick never flips.
    staleTime: 6 * 60 * 60 * 1000,
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
