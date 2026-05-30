/**
 * Weighted form analysis using EXPONENTIAL TIME DECAY.
 *
 * Research (Dixon & Coles 1997, and time-weighting extensions) shows recent
 * matches are far more predictive than older ones. Instead of fixed per-slot
 * weights we decay by actual elapsed time: weight = exp(-XI * days_ago).
 * XI ≈ 0.0065/day gives a ~3-month effective memory, the value commonly found
 * to minimise predictive loss on European league data.
 */
import type { Fixture } from '@/types/match';
import type { TeamFormSnapshot } from '@/types/prediction';

/** Time-decay constant (per day). Larger = shorter memory. */
export const XI_DECAY = 0.0065;
const DAY_SECONDS = 86400;

const decayWeight = (matchTs: number, nowTs: number): number => {
  const daysAgo = Math.max(0, (nowTs - matchTs) / DAY_SECONDS);
  return Math.exp(-XI_DECAY * daysAgo);
};

export const buildFormSnapshot = (
  teamId: number,
  history: Fixture[],
  maxMatches = 10,
): TeamFormSnapshot => {
  const nowTs = Math.floor(Date.now() / 1000);
  const sorted = [...history]
    .filter(
      (f) =>
        (f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN') &&
        (f.teams.home.id === teamId || f.teams.away.id === teamId),
    )
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, maxMatches);

  const results: Array<'W' | 'D' | 'L'> = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let wGoalsFor = 0;
  let wGoalsAgainst = 0;
  let goalWeightTotal = 0;
  let winStreak = 0;
  let streakBroken = false;
  const home = { played: 0, won: 0, drawn: 0, lost: 0 };
  const away = { played: 0, won: 0, drawn: 0, lost: 0 };

  sorted.forEach((fixture) => {
    const isHome = fixture.teams.home.id === teamId;
    const teamGoals = (isHome ? fixture.goals.home : fixture.goals.away) ?? 0;
    const oppGoals = (isHome ? fixture.goals.away : fixture.goals.home) ?? 0;
    goalsFor += teamGoals;
    goalsAgainst += oppGoals;

    const w = decayWeight(fixture.fixture.timestamp, nowTs);
    wGoalsFor += teamGoals * w;
    wGoalsAgainst += oppGoals * w;
    goalWeightTotal += w;

    let result: 'W' | 'D' | 'L';
    if (teamGoals > oppGoals) result = 'W';
    else if (teamGoals < oppGoals) result = 'L';
    else result = 'D';

    results.push(result);
    const score = result === 'W' ? 1 : result === 'D' ? 0.5 : 0;
    weightedSum += score * w;
    weightTotal += w;

    if (!streakBroken && result === 'W') winStreak += 1;
    else streakBroken = true;

    const bucket = isHome ? home : away;
    bucket.played += 1;
    if (result === 'W') bucket.won += 1;
    else if (result === 'D') bucket.drawn += 1;
    else bucket.lost += 1;
  });

  const weighted = weightTotal > 0 ? weightedSum / weightTotal : 0.5;
  const matchesAnalyzed = sorted.length;

  return {
    teamId,
    matchesAnalyzed,
    weightedFormScore: weighted,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: goalWeightTotal > 0 ? wGoalsFor / goalWeightTotal : NaN,
    avgGoalsAgainst: goalWeightTotal > 0 ? wGoalsAgainst / goalWeightTotal : NaN,
    winStreak,
    homeRecord: home,
    awayRecord: away,
    results,
  };
};
