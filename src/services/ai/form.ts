/**
 * Weighted form analysis using recency decay.
 * Returns a 0-1 score representing how "in form" a team is.
 */
import type { Fixture } from '@/types/match';
import type { TeamFormSnapshot } from '@/types/prediction';

const RECENCY_WEIGHTS = [1.0, 0.85, 0.7, 0.55, 0.4]; // last 5 matches

export const buildFormSnapshot = (
  teamId: number,
  history: Fixture[],
  maxMatches = 5,
): TeamFormSnapshot => {
  const sorted = [...history]
    .filter(
      (f) =>
        (f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET') &&
        (f.teams.home.id === teamId || f.teams.away.id === teamId),
    )
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, maxMatches);

  const results: Array<'W' | 'D' | 'L'> = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let winStreak = 0;
  let streakBroken = false;
  const home = { played: 0, won: 0, drawn: 0, lost: 0 };
  const away = { played: 0, won: 0, drawn: 0, lost: 0 };

  sorted.forEach((fixture, idx) => {
    const isHome = fixture.teams.home.id === teamId;
    const teamGoals = (isHome ? fixture.goals.home : fixture.goals.away) ?? 0;
    const oppGoals = (isHome ? fixture.goals.away : fixture.goals.home) ?? 0;
    goalsFor += teamGoals;
    goalsAgainst += oppGoals;

    let result: 'W' | 'D' | 'L';
    if (teamGoals > oppGoals) result = 'W';
    else if (teamGoals < oppGoals) result = 'L';
    else result = 'D';

    results.push(result);
    const score = result === 'W' ? 1 : result === 'D' ? 0.5 : 0;
    const w = RECENCY_WEIGHTS[idx] ?? 0.3;
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
    avgGoalsFor: matchesAnalyzed > 0 ? goalsFor / matchesAnalyzed : NaN,
    avgGoalsAgainst: matchesAnalyzed > 0 ? goalsAgainst / matchesAnalyzed : NaN,
    winStreak,
    homeRecord: home,
    awayRecord: away,
    results,
  };
};
