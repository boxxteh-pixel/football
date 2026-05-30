import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRecentResults } from '@/services/api/smInsights';
import { predictFromInsights } from '@/services/ai/predictor';
import { gradePrediction, summarizeAccuracy, type GradedPrediction } from '@/services/ai/evaluate';
import { useSettingsStore } from '@/store/settingsStore';
import { hasApiKey } from '@/constants/config';
import { todayIsoDate } from '@/utils/date';
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

export interface ResultRow {
  fixture: Fixture;
  prediction: PredictionResult;
  graded: GradedPrediction;
}

/**
 * Recent finished matches graded against the model's prediction.
 * Returns rows (newest first) plus an accuracy summary (hit rate + Brier).
 */
export const useResults = (days = 4) => {
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);

  const query = useQuery({
    queryKey: ['results', todayIsoDate(), selectedLeagueIds.join(','), days],
    queryFn: () => fetchRecentResults(todayIsoDate(), selectedLeagueIds, days),
    enabled: hasApiKey() && selectedLeagueIds.length > 0,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { rows, summary } = useMemo(() => {
    const list: ResultRow[] = (query.data ?? []).map(({ fixture, insights }) => {
      const prediction = predictFromInsights(fixture, insights);
      const graded = gradePrediction(fixture, prediction);
      return { fixture, prediction, graded };
    });
    const summary = summarizeAccuracy(list.map((r) => r.graded));
    return { rows: list, summary };
  }, [query.data]);

  return { ...query, rows, summary };
};
