/**
 * ELO rating system tuned for football.
 * Reference: World Football Elo Ratings (eloratings.net) + Glickman.
 *
 * Improvements over a naive implementation:
 *  - Margin-of-victory multiplier (a 4-0 win moves ratings far more than a 1-0).
 *  - Autocorrelation correction so that lop-sided wins by an already-favoured
 *    team don't over-inflate (the "G" dampening used by eloratings.net).
 *  - Goal-expectancy mapping that feeds the Poisson model a sane multiplier.
 */
import type { Fixture } from '@/types/match';

const BASE_ELO = 1500;
const K_FACTOR = 20;
const HOME_ADVANTAGE = 65; // in Elo points (~ +0.30 goals); tuned down from 100

export interface EloMap {
  [teamId: number]: number;
}

const expectedScore = (ratingA: number, ratingB: number): number => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

/**
 * Margin-of-victory multiplier (eloratings.net convention).
 * goalDiff 0/1 → 1.0, 2 → 1.5, 3 → 1.75, 4+ → 1.75 + (gd-3)/8.
 */
const marginMultiplier = (goalDiff: number): number => {
  const gd = Math.abs(goalDiff);
  if (gd <= 1) return 1;
  if (gd === 2) return 1.5;
  if (gd === 3) return 1.75;
  return 1.75 + (gd - 3) / 8;
};

export const updateElo = (ratings: EloMap, fixture: Fixture): EloMap => {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  const homeBase = ratings[homeId] ?? BASE_ELO;
  const awayBase = ratings[awayId] ?? BASE_ELO;

  const expectedHome = expectedScore(homeBase + HOME_ADVANTAGE, awayBase);
  const expectedAway = 1 - expectedHome;

  let actualHome = 0.5;
  if (homeGoals > awayGoals) actualHome = 1;
  else if (homeGoals < awayGoals) actualHome = 0;
  const actualAway = 1 - actualHome;

  // Autocorrelation-corrected margin multiplier: dampen when the expected
  // winner also wins big, so favourites can't farm rating points.
  const goalDiff = homeGoals - awayGoals;
  const winnerExpected = goalDiff > 0 ? expectedHome : goalDiff < 0 ? expectedAway : 0.5;
  const dampening = goalDiff !== 0 ? 1 / (1 + 0.35 * winnerExpected) : 1;
  const k = K_FACTOR * marginMultiplier(goalDiff) * dampening;

  return {
    ...ratings,
    [homeId]: homeBase + k * (actualHome - expectedHome),
    [awayId]: awayBase + k * (actualAway - expectedAway),
  };
};

export const computeEloFromHistory = (teamId: number, history: Fixture[]): number => {
  let ratings: EloMap = {};
  // Sort oldest first so ratings evolve chronologically.
  const sorted = [...history].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
  for (const fixture of sorted) {
    const s = fixture.fixture.status.short;
    if (s === 'FT' || s === 'AET' || s === 'PEN') {
      ratings = updateElo(ratings, fixture);
    }
  }
  return ratings[teamId] ?? BASE_ELO;
};

/**
 * Win/draw/loss probabilities from Elo, including a calibrated draw model.
 * Draw likelihood peaks when the two sides are evenly matched and decays as
 * the rating gap widens (logistic in |Δ|).
 */
export const eloWinProbability = (
  homeElo: number,
  awayElo: number,
): { home: number; draw: number; away: number } => {
  const pHomeNoDraw = expectedScore(homeElo + HOME_ADVANTAGE, awayElo);

  // Draw probability model: ~28% for a coin-flip, shrinking with rating gap.
  const gap = Math.abs(homeElo + HOME_ADVANTAGE - awayElo);
  const drawProb = 0.30 * Math.exp(-gap / 400);

  const home = pHomeNoDraw * (1 - drawProb);
  const away = (1 - pHomeNoDraw) * (1 - drawProb);
  return { home, draw: drawProb, away };
};

export const BASE_ELO_VALUE = BASE_ELO;
export const ELO_HOME_ADVANTAGE = HOME_ADVANTAGE;
