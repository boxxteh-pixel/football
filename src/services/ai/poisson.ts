/**
 * Poisson goal model for scoreline + market probabilities.
 *
 * Given expected goals λ_home and λ_away, we compute the probability
 * matrix P[i][j] = P(home scores i) * P(away scores j),
 * then sum the cells matching each market.
 * 
 * Incorporates a Dixon-Coles model adjustment to correct for underestimation of low-scoring draws.
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

const MAX_GOALS = 8;
const DEFAULT_RHO = -0.06; // Dixon-Coles correlation parameter for low-scoring matches

const getDixonColesAdjustment = (i: number, j: number, lambdaHome: number, lambdaAway: number, rho: number): number => {
  if (lambdaHome <= 0 || lambdaAway <= 0) return 1;
  if (i === 0 && j === 0) return 1 - rho * lambdaHome * lambdaAway;
  if (i === 1 && j === 0) return 1 + rho * lambdaAway;
  if (i === 0 && j === 1) return 1 + rho * lambdaHome;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
};

export interface MatchProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  btts: number;
  over25: number;
  under25: number;
  mostLikelyScore: { home: number; away: number; prob: number };
  scores: Array<{ home: number; away: number; prob: number }>;
}

export const computeMatchProbabilities = (
  lambdaHome: number,
  lambdaAway: number,
  rho: number = DEFAULT_RHO,
): MatchProbabilities => {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over25 = 0;
  let mostLikely = { home: 0, away: 0, prob: 0 };
  const scores: Array<{ home: number; away: number; prob: number }> = [];

  let totalProb = 0;
  const rawScores: Array<{ home: number; away: number; prob: number }> = [];

  // Compute raw adjusted probabilities
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const baseProb = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      const adj = getDixonColesAdjustment(i, j, lambdaHome, lambdaAway, rho);
      const p = Math.max(0, baseProb * adj);
      totalProb += p;
      rawScores.push({ home: i, away: j, prob: p });
    }
  }

  // Normalize to sum exactly to 1.0
  const normFactor = totalProb > 0 ? 1 / totalProb : 1;

  rawScores.forEach(({ home: i, away: j, prob }) => {
    const p = prob * normFactor;
    if (i > j) homeWin += p;
    else if (i < j) awayWin += p;
    else draw += p;
    if (i >= 1 && j >= 1) btts += p;
    if (i + j > 2) over25 += p;
    if (p > mostLikely.prob) mostLikely = { home: i, away: j, prob: p };
    scores.push({ home: i, away: j, prob: p });
  });

  return {
    homeWin,
    draw,
    awayWin,
    btts,
    over25,
    under25: 1 - over25,
    mostLikelyScore: mostLikely,
    scores,
  };
};
