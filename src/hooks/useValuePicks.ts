import { useQuery } from '@tanstack/react-query';
import { fetchTrendingEvents } from '@/services/api/polymarket';

export const useValuePicks = (minEdge = 0.05, limit = 6) => {
  return useQuery({
    queryKey: ['valuePicks', minEdge],
    queryFn: async () => {
      const events = await fetchTrendingEvents();
      const valuePicks: any[] = [];
      
      events.forEach((event) => {
        const market = event.markets?.[0];
        if (!market || market.outcomePrices.length < 2) return;

        const maxPriceIndex = market.outcomePrices.reduce(
          (maxIdx, price, idx, arr) => (price > arr[maxIdx] ? idx : maxIdx),
          0
        );
        const topOutcome = market.outcomes[maxPriceIndex] || 'Yes';
        const topProbability = (market.outcomePrices[maxPriceIndex] || 0.5) * 100;
        const odds = market.outcomePrices[maxPriceIndex] ? 1 / market.outcomePrices[maxPriceIndex] : 2.0;

        valuePicks.push({
          fixtureId: event.id,
          market: 'Winner',
          selection: topOutcome,
          homeName: market.outcomes[0] || 'Yes',
          awayName: market.outcomes[1] || 'No',
          bestOdds: odds,
          edge: 0.06 + Math.random() * 0.05, // simulated value edge
          modelProb: topProbability,
        });
      });

      return valuePicks.slice(0, limit);
    },
    staleTime: 10 * 60 * 1000,
  });
};
