import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchInsights } from '@/services/api/smInsights';
import { predictFromInsights } from '@/services/ai/predictor';
import { gradePrediction, type GradedPrediction } from '@/services/ai/evaluate';
import { hasApiKey } from '@/constants/config';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

/**
 * THE single source of truth for a fixture's prediction.
 *
 * Every surface (home cards, best-picks carousel, the match-page rainbow frame
 * and the Results grading) reads the SAME ['matchInsights', id] cache and runs
 * the SAME predictFromInsights on it — so a card and the match page can NEVER
 * disagree. The insights bundle (provider model + devigged odds + Dixon-Coles
 * season goals model) is cached 30 min, so it's stable and cheap (react-query
 * dedupes concurrent reads of the same fixture).
 */
export const MATCH_INSIGHTS_KEY = 'matchInsights';

export interface FixturePrediction {
  prediction: PredictionResult | null;
  graded: GradedPrediction | null;
  isLoading: boolean;
}

/**
 * @param fixture  the fixture to predict (null/undefined → idle)
 * @param _options reserved (kept for call-site clarity). The bundle is ALWAYS
 *   the full one now — provider model + devigged odds + Dixon-Coles season
 *   goals model — so every surface gets the identical pick.
 */
export const useFixturePrediction = (
  fixture: Fixture | null | undefined,
  _options?: { full?: boolean },
): FixturePrediction => {
  const id = fixture?.fixture.id;
  const homeId = fixture?.teams.home.id ?? 0;
  const awayId = fixture?.teams.away.id ?? 0;

  const query = useQuery({
    queryKey: [MATCH_INSIGHTS_KEY, id],
    queryFn: () => fetchMatchInsights(id!, homeId, awayId),
    enabled: hasApiKey() && Boolean(id),
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
