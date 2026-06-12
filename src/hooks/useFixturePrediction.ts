import { useMemo } from 'react';
import { getPolymarketPrediction } from './useTodayPredictions';
import { PolymarketEvent } from '@/services/api/polymarket';

export interface FixturePrediction {
  prediction: any | null;
  graded: any | null;
  isLoading: boolean;
}

export const useFixturePrediction = (
  event: PolymarketEvent | null | undefined,
  _options?: { full?: boolean },
): FixturePrediction => {
  return useMemo(() => {
    if (!event) {
      return { prediction: null, graded: null, isLoading: false };
    }
    const prediction = getPolymarketPrediction(event);
    return { prediction, graded: null, isLoading: false };
  }, [event]);
};
