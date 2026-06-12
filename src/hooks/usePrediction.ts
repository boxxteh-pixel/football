import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPolymarketPrediction } from './useTodayPredictions';

export const useQuickPrediction = (event: any) => {
  return useMemo(() => getPolymarketPrediction(event), [event?.id]);
};

export const useFullPrediction = (event: any) => {
  return useQuery({
    queryKey: ['prediction', event?.id],
    enabled: !!event?.id,
    queryFn: async () => getPolymarketPrediction(event),
  });
};
