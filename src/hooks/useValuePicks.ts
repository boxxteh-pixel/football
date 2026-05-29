import { useQuery } from '@tanstack/react-query';
import { fetchValuePicksForDate } from '@/services/api/smInsights';
import { useSettingsStore } from '@/store/settingsStore';
import { hasApiKey } from '@/constants/config';
import { todayIsoDate } from '@/utils/date';

/**
 * Real value bets for today across the user's selected leagues, derived from
 * SportMonks provider predictions + devigged bookmaker odds. Empty when no
 * real market edges exist (never fabricated).
 */
export const useValuePicks = (minEdge = 0.05, limit = 6) => {
  const selectedLeagueIds = useSettingsStore((s) => s.settings.selectedLeagueIds);
  return useQuery({
    queryKey: ['valuePicks', todayIsoDate(), selectedLeagueIds.join(','), minEdge],
    queryFn: () => fetchValuePicksForDate(todayIsoDate(), selectedLeagueIds, minEdge, limit),
    enabled: hasApiKey() && selectedLeagueIds.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
};
