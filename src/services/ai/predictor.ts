import type { PredictionResult } from '@/types/prediction';
import { getPolymarketPrediction } from '@/hooks/useTodayPredictions';

export interface PredictorInputs {
  event: any;
}

export const predictFixture = (inputs: PredictorInputs): PredictionResult | null => {
  return getPolymarketPrediction(inputs.event) as PredictionResult | null;
};

export const predictFromInsights = (event: any, insights: any): PredictionResult | null => {
  return getPolymarketPrediction(event) as PredictionResult | null;
};

export const quickPredict = (event: any, insights?: any): PredictionResult | null => {
  return getPolymarketPrediction(event) as PredictionResult | null;
};
