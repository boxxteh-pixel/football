import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFixtureById } from '@/services/api/apiFootball';
import { settlePickAgainstFixture } from '@/services/ai/evaluate';
import { useBetSlipStore } from '@/store/betSlipStore';

/**
 * Auto-settles pending saved picks: for each pending pick whose kickoff has
 * passed, fetch the fixture and, if finished, mark it won/lost. Runs when the
 * My Picks screen is open.
 */
export const useSettlePicks = () => {
  const picks = useBetSlipStore((s) => s.picks);
  const settle = useBetSlipStore((s) => s.settle);

  // Pending picks whose kickoff is at least ~2h in the past (match should be done).
  const dueIds = picks
    .filter((p) => p.status === 'pending')
    .filter((p) => Date.parse(p.kickoff) + 2 * 60 * 60 * 1000 < Date.now())
    .map((p) => p.fixtureId);

  const uniqueDue = Array.from(new Set(dueIds));

  const { data } = useQuery({
    queryKey: ['settlePicks', uniqueDue.join(',')],
    enabled: uniqueDue.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const results = await Promise.all(
        uniqueDue.map((id) => fetchFixtureById(id).catch(() => null)),
      );
      return results.filter(Boolean);
    },
  });

  useEffect(() => {
    if (!data) return;
    for (const fixture of data) {
      if (!fixture) continue;
      const related = picks.filter((p) => p.fixtureId === fixture.fixture.id && p.status === 'pending');
      for (const pick of related) {
        const settlement = settlePickAgainstFixture(fixture, pick.market, pick.selection);
        if (settlement) settle(pick.id, settlement.status, settlement.result).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
};
