import { useMemo } from 'react';
import { useTodayFixtures } from './useFixtures';
import { PolymarketEvent } from '@/services/api/polymarket';

export function getPolymarketPrediction(event: PolymarketEvent): any {
  const market = event.markets?.[0];
  if (!market) return null;

  const maxPriceIndex = market.outcomePrices.reduce(
    (maxIdx, price, idx, arr) => (price > arr[maxIdx] ? idx : maxIdx),
    0
  );
  
  const topOutcome = market.outcomes[maxPriceIndex] || 'Yes';
  const topProbability = (market.outcomePrices[maxPriceIndex] || 0.5) * 100;

  const odds = market.outcomePrices[maxPriceIndex] 
    ? 1 / market.outcomePrices[maxPriceIndex] 
    : 2.0;

  const reasoning = [
    `Current market price implies a ${Math.round(topProbability)}% probability for "${topOutcome}".`,
    `Trading volume reaches $${(event.volume / 1e6).toFixed(2)}M, indicating high market consensus.`,
    `Crowd sentiment favors "${topOutcome}" with active order book liquidity.`
  ];

  return {
    fixtureId: event.id,
    homeWinPct: topProbability,
    drawPct: 0,
    awayWinPct: 100 - topProbability,
    predictedScore: { home: 0, away: 0 },
    bttsPct: 0,
    over25Pct: 0,
    under25Pct: 0,
    topPick: {
      market: 'WIN' as const,
      selection: topOutcome,
      probability: topProbability,
      odds,
    },
    confidence: (topProbability > 80 ? 'ELITE' : topProbability > 65 ? 'HIGH' : 'MEDIUM') as any,
    reasoning,
    valueBets: [],
    marketOverround: 1.02,
    metrics: {
      homeElo: 1000,
      awayElo: 1000,
      homeForm: 0.5,
      awayForm: 0.5,
      homeXg: 0,
      awayXg: 0,
      homeAdvantage: 0,
    },
    computedAt: Date.now(),
  };
}

export const useTodayPredictions = () => {
  const { data, isLoading, refetch, isRefetching, error } = useTodayFixtures('all');

  const predictionMap = useMemo(() => {
    const map = new Map<string, any>();
    (data ?? []).forEach((event) => {
      const pred = getPolymarketPrediction(event);
      if (pred) {
        map.set(event.id, pred);
      }
    });
    return map;
  }, [data]);

  return { isLoading, isRefetching, error, refetch, predictionMap };
};
