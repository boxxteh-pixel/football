/**
 * Market mathematics — turning bookmaker odds into clean probabilities.
 *
 * Bookmaker decimal odds embed a margin ("overround" / "vig"): the implied
 * probabilities of all outcomes in a market sum to >100%. To recover the
 * bookmaker's *fair* probability estimate we remove that margin ("devig").
 *
 * We use proportional (multiplicative) devigging by default — the simplest
 * unbiased method that works well for low-margin markets — and expose Shin's
 * method for binary/3-way markets where favourite-longshot bias matters.
 */

/** Decimal odds → raw implied probability (still contains margin). */
export const impliedFromDecimal = (decimalOdds: number): number => {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
};

/** Total booked probability of a market (1 + margin). */
export const overround = (decimalOdds: number[]): number =>
  decimalOdds.reduce((sum, o) => sum + impliedFromDecimal(o), 0);

/**
 * Proportional devig: normalize raw implied probabilities so they sum to 1.
 * Returns probabilities in the same order as the input odds.
 */
export const devigProportional = (decimalOdds: number[]): number[] => {
  const raw = decimalOdds.map(impliedFromDecimal);
  const total = raw.reduce((s, p) => s + p, 0);
  if (total <= 0) return decimalOdds.map(() => 0);
  return raw.map((p) => p / total);
};

/**
 * Shin (1992/93) devig — accounts for the proportion of insider trading `z`
 * and corrects favourite-longshot bias better than proportional scaling.
 * Solves for z by fixed-point iteration. Falls back to proportional on edge
 * cases. Best used on the 1X2 (3-way) and BTTS/O-U (2-way) markets.
 */
export const devigShin = (decimalOdds: number[], iterations = 60): number[] => {
  const pi = decimalOdds.map(impliedFromDecimal);
  const booksum = pi.reduce((s, p) => s + p, 0);
  if (booksum <= 0) return decimalOdds.map(() => 0);
  const n = pi.length;
  if (n < 2) return devigProportional(decimalOdds);

  let z = 0;
  for (let i = 0; i < iterations; i++) {
    // p_i = (sqrt(z^2 + 4(1-z) * pi_i^2 / booksum) - z) / (2(1-z))
    const probs = pi.map(
      (p) => (Math.sqrt(z * z + 4 * (1 - z) * ((p * p) / booksum)) - z) / (2 * (1 - z)),
    );
    const sum = probs.reduce((s, p) => s + p, 0);
    const newZ = (sum - 1) / (n - 1);
    if (!Number.isFinite(newZ) || newZ < 0) break;
    if (Math.abs(newZ - z) < 1e-9) {
      z = newZ;
      break;
    }
    z = Math.min(0.2, Math.max(0, newZ));
  }

  const probs = pi.map(
    (p) => (Math.sqrt(z * z + 4 * (1 - z) * ((p * p) / booksum)) - z) / (2 * (1 - z)),
  );
  const sum = probs.reduce((s, p) => s + p, 0);
  if (sum <= 0 || !Number.isFinite(sum)) return devigProportional(decimalOdds);
  return probs.map((p) => p / sum);
};

/** Fair decimal odds from a probability (0-1). */
export const fairOdds = (prob: number): number => {
  if (prob <= 0) return 0;
  return 1 / prob;
};

/**
 * Value edge of a bet: model probability vs the bookmaker's implied (fair) prob.
 * Positive = the model thinks the outcome is more likely than the market price.
 * Expressed as expected ROI per unit staked at the offered decimal odds.
 */
export const valueEdge = (modelProb: number, offeredOdds: number): number => {
  if (offeredOdds <= 1 || modelProb <= 0) return 0;
  return modelProb * offeredOdds - 1;
};

/**
 * Fractional Kelly stake (capped). Returns the fraction of bankroll to wager.
 * `fraction` lets callers use a conservative 1/4-Kelly etc.
 */
export const kellyStake = (
  modelProb: number,
  offeredOdds: number,
  fraction = 0.25,
  cap = 0.05,
): number => {
  const b = offeredOdds - 1;
  if (b <= 0) return 0;
  const q = 1 - modelProb;
  const k = (b * modelProb - q) / b;
  if (k <= 0) return 0;
  return Math.min(cap, k * fraction);
};

/** Weighted average of two probability distributions (already-normalized). */
export const blendDistributions = (
  a: number[],
  b: number[],
  weightB: number,
): number[] => {
  const wB = Math.max(0, Math.min(1, weightB));
  const wA = 1 - wB;
  return a.map((v, i) => v * wA + (b[i] ?? 0) * wB);
};
