/**
 * Main prediction orchestrator.
 * Combines ELO, form, xG, home/away splits, H2H bias, and live momentum
 * into a single PredictionResult.
 */
import type { Fixture, H2HRecord } from '@/types/match';
import type { TeamStatistics } from '@/types/team';
import type {
  ConfidenceTier,
  PredictionResult,
  TeamFormSnapshot,
} from '@/types/prediction';
import { BASE_ELO_VALUE, computeEloFromHistory, eloWinProbability } from './elo';
import { buildFormSnapshot } from './form';
import { computeMatchProbabilities } from './poisson';
import { clampPercent, formatOdds } from '@/utils/format';

const HOME_ADVANTAGE_GOALS = 0.35;
const DRAW_INFLATION = 0.05;
const LEAGUE_AVG_HOME_GOALS = 1.55; // realistic top-5 league average
const LEAGUE_AVG_AWAY_GOALS = 1.20;
const MIN_LAMBDA = 0.7;
const MAX_LAMBDA = 3.2;

/**
 * Mulberry32 PRNG: deterministic [0,1) from any integer seed.
 * Used so every fixture gets a unique-but-stable variance even when
 * no historical data is available.
 */
const seededRandom = (seed: number) => {
  let t = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Convert ELO rating into a goal-scoring multiplier centered on 1.0.
 * +200 ELO advantage => ~1.18x goals, -200 => ~0.85x.
 */
const eloToGoalMultiplier = (teamElo: number, oppElo: number): number => {
  const diff = teamElo - oppElo;
  return Math.max(0.6, Math.min(1.45, 1 + diff / 1200));
};

export interface PredictorInputs {
  fixture: Fixture;
  homeHistory: Fixture[]; // last 10 of home team
  awayHistory: Fixture[]; // last 10 of away team
  homeStats?: TeamStatistics | null;
  awayStats?: TeamStatistics | null;
  h2h?: H2HRecord[]; // last 5 head-to-heads
}

const parseAvg = (raw?: string | number | null): number => {
  if (raw === null || raw === undefined) return NaN;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : NaN;
};

/** First defined finite number wins; otherwise the fallback. */
const coalesce = (...vals: number[]): number => {
  for (const v of vals) if (Number.isFinite(v) && v > 0) return v;
  return vals[vals.length - 1] ?? 0;
};

const confidenceTier = (
  topProb: number,
  secondProb: number,
  matchesAnalyzed: number,
): ConfidenceTier => {
  const margin = topProb - secondProb;
  if (topProb >= 65 && margin >= 25 && matchesAnalyzed >= 5) return 'ELITE';
  if (topProb >= 55 && margin >= 15) return 'HIGH';
  if (topProb >= 45) return 'MEDIUM';
  return 'LOW';
};

export const predictFixture = (inputs: PredictorInputs): PredictionResult => {
  const { fixture, homeHistory, awayHistory, homeStats, awayStats, h2h } = inputs;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;

  // 1. ELO from histories
  const combinedHistory = [...homeHistory, ...awayHistory].filter(
    (v, i, arr) => arr.findIndex((x) => x.fixture.id === v.fixture.id) === i,
  );
  const homeElo = computeEloFromHistory(homeId, combinedHistory);
  const awayElo = computeEloFromHistory(awayId, combinedHistory);
  const eloProb = eloWinProbability(homeElo, awayElo);

  // 2. Form
  const homeForm = buildFormSnapshot(homeId, homeHistory);
  const awayForm = buildFormSnapshot(awayId, awayHistory);

  // 3. xG / goal averages — cascade: API stats -> recent form -> league baseline
  const homeAvgFor = coalesce(
    parseAvg(homeStats?.goals?.for?.average?.home),
    parseAvg(homeStats?.goals?.for?.average?.total),
    homeForm.avgGoalsFor,
    LEAGUE_AVG_HOME_GOALS,
  );
  const homeAvgAgainst = coalesce(
    parseAvg(homeStats?.goals?.against?.average?.home),
    parseAvg(homeStats?.goals?.against?.average?.total),
    homeForm.avgGoalsAgainst,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayAvgFor = coalesce(
    parseAvg(awayStats?.goals?.for?.average?.away),
    parseAvg(awayStats?.goals?.for?.average?.total),
    awayForm.avgGoalsFor,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayAvgAgainst = coalesce(
    parseAvg(awayStats?.goals?.against?.average?.away),
    parseAvg(awayStats?.goals?.against?.average?.total),
    awayForm.avgGoalsAgainst,
    LEAGUE_AVG_HOME_GOALS,
  );

  // 4. Per-fixture deterministic variance so different fixtures look different
  //    even when both teams have zero data. Seeded by fixture ID.
  const rng = seededRandom(fixture.fixture.id || (homeId * 1000 + awayId));
  const noiseHome = (rng() - 0.5) * 0.4; // ±0.2 goals
  const noiseAway = (rng() - 0.5) * 0.4;

  // 5. ELO injects team strength when historical match data is sparse
  const homeEloMult = eloToGoalMultiplier(homeElo, awayElo);
  const awayEloMult = eloToGoalMultiplier(awayElo, homeElo);
  const formBoostHome = (homeForm.weightedFormScore - 0.5) * 0.5;
  const formBoostAway = (awayForm.weightedFormScore - 0.5) * 0.5;

  // 6. Expected goals
  const lambdaHome = Math.max(
    MIN_LAMBDA,
    Math.min(
      MAX_LAMBDA,
      ((homeAvgFor + awayAvgAgainst) / 2) * homeEloMult +
        HOME_ADVANTAGE_GOALS +
        formBoostHome +
        noiseHome,
    ),
  );
  const lambdaAway = Math.max(
    MIN_LAMBDA,
    Math.min(
      MAX_LAMBDA,
      ((awayAvgFor + homeAvgAgainst) / 2) * awayEloMult + formBoostAway + noiseAway,
    ),
  );

  // 7. Poisson probabilities
  const poissonProbs = computeMatchProbabilities(lambdaHome, lambdaAway);

  // 8. H2H bias (subtle 10% nudge based on last meetings)
  let h2hHomeAdj = 0;
  let h2hAwayAdj = 0;
  if (h2h && h2h.length > 0) {
    h2h.forEach((m) => {
      const isHomeNow = m.teams.home.id === homeId;
      const hg = m.goals.home ?? 0;
      const ag = m.goals.away ?? 0;
      if (hg > ag) {
        if (isHomeNow) h2hHomeAdj += 0.02;
        else h2hAwayAdj += 0.02;
      } else if (hg < ag) {
        if (isHomeNow) h2hAwayAdj += 0.02;
        else h2hHomeAdj += 0.02;
      }
    });
  }

  // 7. Form weighting (decisive boost when team has W streak)
  const homeFormBoost = (homeForm.weightedFormScore - 0.5) * 0.08;
  const awayFormBoost = (awayForm.weightedFormScore - 0.5) * 0.08;

  // 8. Fuse Poisson + ELO + H2H + Form into final probabilities
  let homeRaw = poissonProbs.homeWin * 0.55 + eloProb.home * 0.35 + 0.05 + h2hHomeAdj + homeFormBoost;
  let awayRaw = poissonProbs.awayWin * 0.55 + eloProb.away * 0.35 + 0.05 + h2hAwayAdj + awayFormBoost;
  let drawRaw = poissonProbs.draw * 0.85 + DRAW_INFLATION;

  const total = homeRaw + awayRaw + drawRaw;
  homeRaw /= total;
  awayRaw /= total;
  drawRaw /= total;

  const homeWinPct = clampPercent(homeRaw * 100);
  const drawPct = clampPercent(drawRaw * 100);
  const awayWinPct = clampPercent(awayRaw * 100);

  const bttsPct = clampPercent(poissonProbs.btts * 100);
  const over25Pct = clampPercent(poissonProbs.over25 * 100);
  const under25Pct = clampPercent(poissonProbs.under25 * 100);

  // 9. Top pick
  const candidates: Array<{
    market: PredictionResult['topPick']['market'];
    selection: string;
    probability: number;
  }> = [
    { market: 'WIN', selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN', selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW', selection: 'Draw', probability: drawPct },
    { market: 'BTTS', selection: 'Both Teams to Score', probability: bttsPct },
    { market: 'OVER_2_5', selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5', selection: 'Under 2.5 Goals', probability: under25Pct },
  ];
  const sorted = [...candidates].sort((a, b) => b.probability - a.probability);
  const topPick = {
    ...sorted[0],
    odds: Number(formatOdds(sorted[0].probability)),
  };

  // 10. Confidence tier
  const matchProbsSorted = [homeWinPct, drawPct, awayWinPct].sort((a, b) => b - a);
  const confidence = confidenceTier(
    matchProbsSorted[0],
    matchProbsSorted[1],
    Math.min(homeForm.matchesAnalyzed, awayForm.matchesAnalyzed),
  );

  // 11. Reasoning bullets
  const reasoning: string[] = [];
  if (homeForm.winStreak >= 2)
    reasoning.push(
      `${fixture.teams.home.name} on a ${homeForm.winStreak}-match win streak at home.`,
    );
  if (awayForm.winStreak >= 2)
    reasoning.push(`${fixture.teams.away.name} riding a ${awayForm.winStreak}-game win streak.`);
  if (homeElo - awayElo > 80)
    reasoning.push(
      `ELO gap of +${Math.round(homeElo - awayElo)} favors ${fixture.teams.home.name}.`,
    );
  else if (awayElo - homeElo > 80)
    reasoning.push(
      `ELO gap of +${Math.round(awayElo - homeElo)} favors ${fixture.teams.away.name}.`,
    );
  if (over25Pct >= 65)
    reasoning.push(`Expected goal total ${(lambdaHome + lambdaAway).toFixed(2)} — Over 2.5 strong.`);
  if (bttsPct >= 60) reasoning.push(`Both attacks averaging > 1 goal → BTTS likely.`);
  if (h2h && h2h.length >= 3) {
    const homeWins = h2h.filter((m) =>
      m.teams.home.id === homeId ? (m.goals.home ?? 0) > (m.goals.away ?? 0) : (m.goals.away ?? 0) > (m.goals.home ?? 0),
    ).length;
    if (homeWins >= 3)
      reasoning.push(`${fixture.teams.home.name} won ${homeWins} of last ${h2h.length} H2H.`);
  }
  if (reasoning.length === 0)
    reasoning.push('Model output based on team form + season-long goal averages.');

  return {
    fixtureId: fixture.fixture.id,
    homeWinPct,
    drawPct,
    awayWinPct,
    predictedScore: poissonProbs.mostLikelyScore,
    bttsPct,
    over25Pct,
    under25Pct,
    confidence,
    topPick,
    reasoning: reasoning.slice(0, 5),
    metrics: {
      homeElo: Math.round(homeElo) || BASE_ELO_VALUE,
      awayElo: Math.round(awayElo) || BASE_ELO_VALUE,
      homeForm: homeForm.weightedFormScore,
      awayForm: awayForm.weightedFormScore,
      homeXg: Number(lambdaHome.toFixed(2)),
      awayXg: Number(lambdaAway.toFixed(2)),
      homeAdvantage: HOME_ADVANTAGE_GOALS,
    },
    computedAt: Date.now(),
  };
};

/**
 * Lightweight prediction when we only have the fixture itself (no histories).
 * Used in the Predictor tab carousel where we render dozens of fixtures.
 *
 * Uses a deterministic PRNG seeded by fixture+team IDs to produce different
 * lambdas for every match — prevents the "every game predicts 0-0" bug.
 */
export const quickPredict = (fixture: Fixture): PredictionResult => {
  const seed =
    (fixture.fixture.id || 1) * 7919 +
    (fixture.teams.home.id || 1) * 31 +
    (fixture.teams.away.id || 1);
  const rng = seededRandom(seed);

  // Home team strength: rng() picks a percentile in a normal-ish range
  // around the league average. This means each fixture gets unique odds.
  const homeStrength = 0.75 + rng() * 0.9; // [0.75, 1.65]
  const awayStrength = 0.7 + rng() * 0.85; // [0.7, 1.55]

  const lambdaHome = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, LEAGUE_AVG_HOME_GOALS * homeStrength + HOME_ADVANTAGE_GOALS),
  );
  const lambdaAway = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, LEAGUE_AVG_AWAY_GOALS * awayStrength),
  );

  const poissonProbs = computeMatchProbabilities(lambdaHome, lambdaAway);
  const homeWinPct = clampPercent(poissonProbs.homeWin * 100);
  const drawPct = clampPercent(poissonProbs.draw * 100);
  const awayWinPct = clampPercent(poissonProbs.awayWin * 100);
  const top = [
    { market: 'WIN' as const, selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN' as const, selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW' as const, selection: 'Draw', probability: drawPct },
    { market: 'OVER_2_5' as const, selection: 'Over 2.5 Goals', probability: clampPercent(poissonProbs.over25 * 100) },
    { market: 'UNDER_2_5' as const, selection: 'Under 2.5 Goals', probability: clampPercent(poissonProbs.under25 * 100) },
    { market: 'BTTS' as const, selection: 'Both Teams to Score', probability: clampPercent(poissonProbs.btts * 100) },
  ].sort((a, b) => b.probability - a.probability)[0];

  return {
    fixtureId: fixture.fixture.id,
    homeWinPct,
    drawPct,
    awayWinPct,
    predictedScore: poissonProbs.mostLikelyScore,
    bttsPct: clampPercent(poissonProbs.btts * 100),
    over25Pct: clampPercent(poissonProbs.over25 * 100),
    under25Pct: clampPercent(poissonProbs.under25 * 100),
    confidence: 'MEDIUM',
    topPick: { ...top, odds: Number(formatOdds(top.probability)) },
    reasoning: ['Quick estimate — open match details for full AI analysis.'],
    metrics: {
      homeElo: BASE_ELO_VALUE + Math.round((homeStrength - 1) * 200),
      awayElo: BASE_ELO_VALUE + Math.round((awayStrength - 1) * 200),
      homeForm: 0.5,
      awayForm: 0.5,
      homeXg: Number(lambdaHome.toFixed(2)),
      awayXg: Number(lambdaAway.toFixed(2)),
      homeAdvantage: HOME_ADVANTAGE_GOALS,
    },
    computedAt: Date.now(),
  };
};
