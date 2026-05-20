/**
 * ELO rating system tuned for football.
 * Reference: Mark E. Glickman / WorldFootballElo.
 */
import type { Fixture } from '@/types/match';

const BASE_ELO = 1500;
const K_FACTOR = 20;
const HOME_ADVANTAGE = 100;
const GOAL_DIFF_BONUS = 8; // per goal differential

export interface EloMap {
  [teamId: number]: number;
}

const expectedScore = (ratingA: number, ratingB: number): number => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

export const updateElo = (
  ratings: EloMap,
  fixture: Fixture,
): EloMap => {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  const homeRating = (ratings[homeId] ?? BASE_ELO) + HOME_ADVANTAGE;
  const awayRating = ratings[awayId] ?? BASE_ELO;

  const expectedHome = expectedScore(homeRating, awayRating);
  const expectedAway = 1 - expectedHome;

  let actualHome = 0.5;
  if (homeGoals > awayGoals) actualHome = 1;
  else if (homeGoals < awayGoals) actualHome = 0;
  const actualAway = 1 - actualHome;

  const goalDiff = Math.abs(homeGoals - awayGoals);
  const k = K_FACTOR + Math.min(goalDiff, 5) * GOAL_DIFF_BONUS / 4;

  return {
    ...ratings,
    [homeId]: (ratings[homeId] ?? BASE_ELO) + k * (actualHome - expectedHome),
    [awayId]: (ratings[awayId] ?? BASE_ELO) + k * (actualAway - expectedAway),
  };
};

export const computeEloFromHistory = (
  teamId: number,
  history: Fixture[],
): number => {
  let ratings: EloMap = {};
  // Sort oldest first
  const sorted = [...history].sort(
    (a, b) => a.fixture.timestamp - b.fixture.timestamp,
  );
  for (const fixture of sorted) {
    if (fixture.fixture.status.short === 'FT' || fixture.fixture.status.short === 'AET') {
      ratings = updateElo(ratings, fixture);
    }
  }
  return ratings[teamId] ?? BASE_ELO;
};

export const eloWinProbability = (
  homeElo: number,
  awayElo: number,
): { home: number; away: number } => {
  const home = expectedScore(homeElo + HOME_ADVANTAGE, awayElo);
  return { home, away: 1 - home };
};

export const BASE_ELO_VALUE = BASE_ELO;
