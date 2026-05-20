/**
 * Poisson goal model for scoreline + market probabilities.
 *
 * Given expected goals λ_home and λ_away, we compute the probability
 * matrix P[i][j] = P(home scores i) * P(away scores j),
 * then sum the cells matching each market.
 */

const factorial = (n: number): number => {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
};

const poisson = (k: number, lambda: number): number => {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
};

const MAX_GOALS = 6;

export interface MatchProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  btts: number;
  over25: number;
  under25: number;
  mostLikelyScore: { home: number; away: number; prob: number };
}

export const computeMatchProbabilities = (
  lambdaHome: number,
  lambdaAway: number,
): MatchProbabilities => {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over25 = 0;
  let mostLikely = { home: 0, away: 0, prob: 0 };

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      if (i > j) homeWin += p;
      else if (i < j) awayWin += p;
      else draw += p;
      if (i >= 1 && j >= 1) btts += p;
      if (i + j > 2) over25 += p;
      if (p > mostLikely.prob) mostLikely = { home: i, away: j, prob: p };
    }
  }

  return {
    homeWin,
    draw,
    awayWin,
    btts,
    over25,
    under25: 1 - over25,
    mostLikelyScore: mostLikely,
  };
};
