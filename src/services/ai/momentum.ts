/**
 * Live momentum analysis from match events.
 * Buckets events into 5-minute windows and weights them by type.
 */
import type { FixtureEvent, FixtureStatistic } from '@/types/match';

const EVENT_WEIGHTS: Record<string, number> = {
  Goal: 5,
  Card: -1,
  subst: 0.3,
  Var: 0,
};

const DETAIL_WEIGHTS: Record<string, number> = {
  'Normal Goal': 5,
  'Own Goal': -4,
  'Penalty': 4,
  'Missed Penalty': -2,
  'Yellow Card': -1,
  'Red Card': -3,
  'Second Yellow card': -3,
};

export interface MomentumWindow {
  startMin: number;
  endMin: number;
  homePressure: number; // 0-1
  awayPressure: number;
}

export const computeMomentumWindows = (
  events: FixtureEvent[],
  homeTeamId: number,
  windowSize = 5,
  maxMin = 90,
): MomentumWindow[] => {
  const windows: MomentumWindow[] = [];
  for (let start = 0; start < maxMin; start += windowSize) {
    const end = start + windowSize;
    let home = 0;
    let away = 0;
    events
      .filter((e) => e.time.elapsed >= start && e.time.elapsed < end)
      .forEach((e) => {
        const weight = DETAIL_WEIGHTS[e.detail] ?? EVENT_WEIGHTS[e.type] ?? 0;
        if (e.team.id === homeTeamId) home += Math.max(weight, 0);
        else away += Math.max(weight, 0);
      });
    const total = home + away;
    windows.push({
      startMin: start,
      endMin: end,
      homePressure: total > 0 ? home / total : 0.5,
      awayPressure: total > 0 ? away / total : 0.5,
    });
  }
  return windows;
};

export const extractStatNumber = (
  stats: FixtureStatistic[],
  teamId: number,
  key: string,
): number => {
  const teamStats = stats.find((s) => s.team.id === teamId);
  if (!teamStats) return 0;
  const stat = teamStats.statistics.find((s) => s.type.toLowerCase() === key.toLowerCase());
  if (!stat || stat.value === null) return 0;
  if (typeof stat.value === 'number') return stat.value;
  const parsed = parseFloat(String(stat.value).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const computePressureSwing = (
  events: FixtureEvent[],
  homeTeamId: number,
  recentMinutes = 10,
  currentElapsed = 90,
): number => {
  const since = Math.max(0, currentElapsed - recentMinutes);
  let homeWeight = 0;
  let awayWeight = 0;
  events
    .filter((e) => e.time.elapsed >= since)
    .forEach((e) => {
      const w = Math.abs(DETAIL_WEIGHTS[e.detail] ?? EVENT_WEIGHTS[e.type] ?? 0);
      if (e.team.id === homeTeamId) homeWeight += w;
      else awayWeight += w;
    });
  const total = homeWeight + awayWeight;
  if (total === 0) return 0;
  return ((homeWeight - awayWeight) / total) * 100;
};
