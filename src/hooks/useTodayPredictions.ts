import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTodayInsights } from '@/services/api/smInsights';
import { predictFromInsights } from '@/services/ai/predictor';
import { useSettingsStore } from '@/store/settingsStore';
import { hasApiKey } from '@/constants/config';
import { todayIsoDate } from '@/utils/date';
import type { PredictionResult } from '@/types/prediction';

/**
 * Batched REAL predictions for today's fixtures across the user's leagues.
 *
 * Fetches every fixture once (with provider predictions + bookmaker odds inline)
 * and builds a fixtureId → PredictionResult map driven by real market data,
 * so list rows and the "best picks" carousel show genuine probabilities instead
 * of the old random placeholder estimates.
 */
export const useTodayPredictions = () => {
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);

  const query = useQuery({
    queryKey: ['todayInsights', todayIsoDate(), selectedLeagueIds.join(',')],
    queryFn: () => fetchTodayInsights(todayIsoDate(), selectedLeagueIds),
    enabled: hasApiKey() && selectedLeagueIds.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const predictionMap = useMemo(() => {
    const map = new Map<number, PredictionResult>();
    (query.data ?? []).forEach(({ fixture, insights }) => {
      map.set(fixture.fixture.id, predictFromInsights(fixture, insights));
    });
    return map;
  }, [query.data]);

  return { ...query, predictionMap };
};
