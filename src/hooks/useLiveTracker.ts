import { useQuery } from '@tanstack/react-query';
import { fetchLiveTracker } from '@/services/api/smTracker';
import { hasApiKey } from '@/constants/config';
import { config } from '@/constants/config';
import type { Fixture } from '@/types/match';
import { isLive } from '@/types/match';

/**
 * Real live tracker data (ball coordinates, player positions, pressure, stats)
 * polled while the match is live. Short stale time + interval so the pitch keeps
 * moving without a page refresh.
 */
export const useLiveTracker = (fixture: Fixture | null | undefined) => {
  const live = fixture ? isLive(fixture.fixture.status.short) : false;
  const id = fixture?.fixture.id;
  const homeId = fixture?.teams.home.id ?? 0;
  const awayId = fixture?.teams.away.id ?? 0;

  return useQuery({
    queryKey: ['liveTracker', id],
    queryFn: () => fetchLiveTracker(id!, homeId, awayId),
    enabled: hasApiKey() && Boolean(id) && live,
    refetchInterval: live ? config.app.trackerRefreshMs : false,
    refetchIntervalInBackground: false,
    staleTime: config.app.trackerRefreshMs,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};
