/**
 * Main prediction orchestrator.
 * Combines ELO, recency-weighted form, attack/defense goal rates (Dixon-Coles),
 * home/away splits, H2H bias, league context and Sportmonks Pro signals
 * into a single PredictionResult.
 *
 * Key modelling choices:
 *  - Empirical-Bayes shrinkage pulls small-sample goal rates toward the league
 *    mean, so a team with 2 games doesn't dominate the model with noise.
 *  - Home advantage is league-aware (cups & international ties get less).
 *  - ELO supplies a calibrated 1X2 prior; Poisson supplies goals + scorelines;
 *    form is a light nudge. Weights adapt to how much history we actually have.
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
import type { SportmonksPredictionParsed } from '../api/sportmonks';
import { getLeagueById } from '@/constants/leagues';
import { useLearningStore } from '@/store/learningStore';

const HOME_ADVANTAGE_GOALS = 0.30;
const LEAGUE_AVG_HOME_GOALS = 1.50; // realistic top-division home average
const LEAGUE_AVG_AWAY_GOALS = 1.15;
const MIN_LAMBDA = 0.35;
const MAX_LAMBDA = 3.6;

// Empirical-Bayes shrinkage strength: a team's goal rate is blended with the
// league baseline as if it had played SHRINKAGE_GAMES of perfectly-average football.
const SHRINKAGE_GAMES = 4;

/**
 * Mulberry32 PRNG: deterministic [0,1) from any integer seed.
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

/**
 * Empirical-Bayes shrinkage of a rate toward a prior.
 * With n observations and pseudo-count k, returns
 *   (n * observed + k * prior) / (n + k).
 */
const shrink = (observed: number, n: number, prior: number, k = SHRINKAGE_GAMES): number => {
  if (!Number.isFinite(observed)) return prior;
  if (n <= 0) return prior;
  return (n * observed + k * prior) / (n + k);
};

export interface PredictorInputs {
  fixture: Fixture;
  homeHistory: Fixture[]; // last 10 of home team
  awayHistory: Fixture[]; // last 10 of away team
  homeStats?: TeamStatistics | null;
  awayStats?: TeamStatistics | null;
  h2h?: H2HRecord[]; // last 5 head-to-heads
  sportmonksPred?: SportmonksPredictionParsed | null;
}

const parseAvg = (raw?: string | number | null): number => {
  if (raw === null || raw === undefined) return NaN;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : NaN;
};

/** First defined finite positive number wins; otherwise the fallback. */
const coalesce = (...vals: number[]): number => {
  for (const v of vals) if (Number.isFinite(v) && v > 0) return v;
  return vals[vals.length - 1] ?? 0;
};

/**
 * League-aware home advantage. Knockout cups are often played at neutral or
 * single venues and international ties have travel/altitude effects that wash
 * out classic home edge, so we shave it down.
 */
const homeAdvantageForLeague = (leagueId: number): number => {
  const league = getLeagueById(leagueId);
  if (!league) return HOME_ADVANTAGE_GOALS;
  if (league.isInternational) return HOME_ADVANTAGE_GOALS * 0.5;
  if (league.isCup) return HOME_ADVANTAGE_GOALS * 0.7;
  return HOME_ADVANTAGE_GOALS;
};

const confidenceTier = (
  topProb: number,
  secondProb: number,
  matchesAnalyzed: number,
  hasProSignal: boolean,
): ConfidenceTier => {
  const margin = topProb - secondProb;
  // Require both a high peak AND a clear margin, scaled by how much data we trust.
  const dataOk = matchesAnalyzed >= 4 || hasProSignal;
  if (topProb >= 62 && margin >= 22 && dataOk) return 'ELITE';
  if (topProb >= 52 && margin >= 12 && dataOk) return 'HIGH';
  if (topProb >= 42) return 'MEDIUM';
  return 'LOW';
};

const getConsistentPredictedScore = (
  market: 'WIN' | 'DRAW' | 'BTTS' | 'OVER_2_5' | 'UNDER_2_5',
  selection: string,
  homeTeamName: string,
  scoresList: Array<{ score: string; probability: number }>
): { home: number; away: number } => {
  let targetType: 'home' | 'away' | 'draw' | 'btts_yes' | 'over' | 'under' = 'draw';
  if (market === 'WIN') {
    if (selection.startsWith(homeTeamName)) {
      targetType = 'home';
    } else {
      targetType = 'away';
    }
  } else if (market === 'DRAW') {
    targetType = 'draw';
  } else if (market === 'BTTS') {
    targetType = 'btts_yes';
  } else if (market === 'OVER_2_5') {
    targetType = 'over';
  } else if (market === 'UNDER_2_5') {
    targetType = 'under';
  }

  for (const item of scoresList) {
    const parts = item.score.split('-');
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const a = parseInt(parts[1]);
      if (!isNaN(h) && !isNaN(a)) {
        let isConsistent = false;
        switch (targetType) {
          case 'home':
            isConsistent = h > a;
            break;
          case 'away':
            isConsistent = a > h;
            break;
          case 'draw':
            isConsistent = h === a;
            break;
          case 'btts_yes':
            isConsistent = h >= 1 && a >= 1;
            break;
          case 'over':
            isConsistent = (h + a) > 2;
            break;
          case 'under':
            isConsistent = (h + a) <= 2;
            break;
        }
        if (isConsistent) {
          return { home: h, away: a };
        }
      }
    }
  }

  // Fallback to top score in the list
  if (scoresList.length > 0) {
    const parts = scoresList[0].score.split('-');
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const a = parseInt(parts[1]);
      if (!isNaN(h) && !isNaN(a)) {
        return { home: h, away: a };
      }
    }
  }
  return { home: 1, away: 1 };
};

export const predictFixture = (inputs: PredictorInputs): PredictionResult => {
  const { fixture, homeHistory, awayHistory, homeStats, awayStats, h2h, sportmonksPred } = inputs;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeAdvantage = homeAdvantageForLeague(fixture.league.id);

  // 1. ELO from histories
  const combinedHistory = [...homeHistory, ...awayHistory].filter(
    (v, i, arr) => arr.findIndex((x) => x.fixture.id === v.fixture.id) === i,
  );
  const homeElo = computeEloFromHistory(homeId, combinedHistory);
  const awayElo = computeEloFromHistory(awayId, combinedHistory);
  const eloProb = eloWinProbability(homeElo, awayElo);

  // 2. Form (recency-weighted)
  const homeForm = buildFormSnapshot(homeId, homeHistory);
  const awayForm = buildFormSnapshot(awayId, awayHistory);

  // 3. Goal rates — cascade: API season stats -> recent form -> league baseline,
  //    then shrink toward the league mean based on sample size (empirical Bayes).
  const homeAttackRaw = coalesce(
    parseAvg(homeStats?.goals?.for?.average?.home),
    parseAvg(homeStats?.goals?.for?.average?.total),
    homeForm.avgGoalsFor,
    LEAGUE_AVG_HOME_GOALS,
  );
  const homeConcedeRaw = coalesce(
    parseAvg(homeStats?.goals?.against?.average?.home),
    parseAvg(homeStats?.goals?.against?.average?.total),
    homeForm.avgGoalsAgainst,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayAttackRaw = coalesce(
    parseAvg(awayStats?.goals?.for?.average?.away),
    parseAvg(awayStats?.goals?.for?.average?.total),
    awayForm.avgGoalsFor,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayConcedeRaw = coalesce(
    parseAvg(awayStats?.goals?.against?.average?.away),
    parseAvg(awayStats?.goals?.against?.average?.total),
    awayForm.avgGoalsAgainst,
    LEAGUE_AVG_HOME_GOALS,
  );

  const homeAvgFor = shrink(homeAttackRaw, homeForm.matchesAnalyzed, LEAGUE_AVG_HOME_GOALS);
  const homeAvgAgainst = shrink(homeConcedeRaw, homeForm.matchesAnalyzed, LEAGUE_AVG_AWAY_GOALS);
  const awayAvgFor = shrink(awayAttackRaw, awayForm.matchesAnalyzed, LEAGUE_AVG_AWAY_GOALS);
  const awayAvgAgainst = shrink(awayConcedeRaw, awayForm.matchesAnalyzed, LEAGUE_AVG_HOME_GOALS);

  // 4. Attack/Defense strengths (Dixon-Coles multiplicative style)
  const homeAttack = homeAvgFor / LEAGUE_AVG_HOME_GOALS;
  const awayDefense = awayAvgAgainst / LEAGUE_AVG_HOME_GOALS;
  const awayAttack = awayAvgFor / LEAGUE_AVG_AWAY_GOALS;
  const homeDefense = homeAvgAgainst / LEAGUE_AVG_AWAY_GOALS;

  // 5. Baseline expected goals using Dixon-Coles multiplicative interaction
  let baseLambdaHome = LEAGUE_AVG_HOME_GOALS * homeAttack * awayDefense;
  let baseLambdaAway = LEAGUE_AVG_AWAY_GOALS * awayAttack * homeDefense;

  // ELO goal multiplier
  const homeEloMult = eloToGoalMultiplier(homeElo, awayElo);
  const awayEloMult = eloToGoalMultiplier(awayElo, homeElo);
  baseLambdaHome *= homeEloMult;
  baseLambdaAway *= awayEloMult;

  // Per-fixture deterministic micro-variance (tiny — keeps ties from being identical).
  const rng = seededRandom(fixture.fixture.id || (homeId * 1000 + awayId));
  const noiseHome = (rng() - 0.5) * 0.04;
  const noiseAway = (rng() - 0.5) * 0.04;

  // Form nudge (small, multiplicative-ish through addition on goals).
  const formBoostHome = (homeForm.weightedFormScore - 0.5) * 0.35;
  const formBoostAway = (awayForm.weightedFormScore - 0.5) * 0.35;

  const lambdaHome = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, baseLambdaHome + homeAdvantage + formBoostHome + noiseHome),
  );
  const lambdaAway = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, baseLambdaAway + formBoostAway + noiseAway),
  );

  // 6. Poisson probabilities (with Dixon-Coles low-score correction)
  const poissonProbs = computeMatchProbabilities(lambdaHome, lambdaAway);

  // 7. H2H bias (subtle nudge based on last meetings, decayed by recency)
  let h2hHomeAdj = 0;
  let h2hAwayAdj = 0;
  if (h2h && h2h.length > 0) {
    const sortedH2h = [...h2h].sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);
    sortedH2h.forEach((m, idx) => {
      const recencyW = 1 / (1 + idx); // 1, 0.5, 0.33...
      const isHomeNow = m.teams.home.id === homeId;
      const hg = m.goals.home ?? 0;
      const ag = m.goals.away ?? 0;
      const delta = 0.025 * recencyW;
      if (hg > ag) {
        if (isHomeNow) h2hHomeAdj += delta;
        else h2hAwayAdj += delta;
      } else if (hg < ag) {
        if (isHomeNow) h2hAwayAdj += delta;
        else h2hHomeAdj += delta;
      }
    });
  }

  // 8. Dynamic weights based on match-history sample size.
  const minMatches = Math.min(homeForm.matchesAnalyzed, awayForm.matchesAnalyzed);

  let poissonWeight = 0.50;
  let eloWeight = 0.35;
  let formWeight = 0.15;

  if (minMatches >= 5) {
    poissonWeight = 0.62;
    eloWeight = 0.23;
    formWeight = 0.15;
  } else if (minMatches >= 3) {
    poissonWeight = 0.52;
    eloWeight = 0.33;
    formWeight = 0.15;
  } else if (minMatches === 0) {
    // No history at all: lean almost entirely on the ELO prior (which itself
    // falls back to a neutral 1500, giving a sane ~home-advantage-only split).
    poissonWeight = 0.25;
    eloWeight = 0.75;
    formWeight = 0.00;
  }

  // Inject learned biases from the self-learning feedback loop.
  const { poissonBias, eloBias, formBias } = useLearningStore.getState();
  poissonWeight = Math.max(0.05, poissonWeight + poissonBias);
  eloWeight = Math.max(0.05, eloWeight + eloBias);
  formWeight = Math.max(0.00, formWeight + formBias);

  // Re-normalize weights to sum to 1.0.
  const weightTotal = poissonWeight + eloWeight + formWeight;
  if (weightTotal > 0) {
    poissonWeight /= weightTotal;
    eloWeight /= weightTotal;
    formWeight /= weightTotal;
  }

  // 9. Fuse Poisson + ELO + Form + H2H into final 1X2 probabilities.
  //    Form contributes to W/L (not draw) via its directional tilt.
  const formHomeTilt = homeForm.weightedFormScore;
  const formAwayTilt = awayForm.weightedFormScore;
  const formSum = formHomeTilt + formAwayTilt || 1;

  let homeRaw =
    poissonProbs.homeWin * poissonWeight +
    eloProb.home * eloWeight +
    (formHomeTilt / formSum) * formWeight +
    h2hHomeAdj;
  let awayRaw =
    poissonProbs.awayWin * poissonWeight +
    eloProb.away * eloWeight +
    (formAwayTilt / formSum) * formWeight +
    h2hAwayAdj;
  let drawRaw =
    poissonProbs.draw * poissonWeight +
    eloProb.draw * eloWeight +
    0.26 * formWeight;

  let total = homeRaw + awayRaw + drawRaw;
  homeRaw /= total;
  awayRaw /= total;
  drawRaw /= total;

  // Blend Sportmonks Pro predictions when available (weighted toward the pro model).
  if (sportmonksPred) {
    const smHome = sportmonksPred.homeWinPct / 100;
    const smAway = sportmonksPred.awayWinPct / 100;
    const smDraw = sportmonksPred.drawPct / 100;

    homeRaw = homeRaw * 0.30 + smHome * 0.70;
    awayRaw = awayRaw * 0.30 + smAway * 0.70;
    drawRaw = drawRaw * 0.30 + smDraw * 0.70;

    const hybridTotal = homeRaw + awayRaw + drawRaw;
    homeRaw /= hybridTotal;
    awayRaw /= hybridTotal;
    drawRaw /= hybridTotal;
  }

  const homeWinPct = clampPercent(homeRaw * 100);
  const drawPct = clampPercent(drawRaw * 100);
  const awayWinPct = clampPercent(awayRaw * 100);

  let bttsPct = clampPercent(poissonProbs.btts * 100);
  let over25Pct = clampPercent(poissonProbs.over25 * 100);
  let under25Pct = clampPercent(poissonProbs.under25 * 100);

  if (sportmonksPred) {
    bttsPct = clampPercent(bttsPct * 0.30 + sportmonksPred.bttsPct * 0.70);
    over25Pct = clampPercent(over25Pct * 0.30 + sportmonksPred.over25Pct * 0.70);
    under25Pct = clampPercent(under25Pct * 0.30 + sportmonksPred.under25Pct * 0.70);
  }

  // 10. Correct scores list generation and blending
  const blendedScoresMap: Record<string, number> = {};
  poissonProbs.scores.forEach((s) => {
    const key = `${s.home}-${s.away}`;
    blendedScoresMap[key] = s.prob * 100;
  });

  if (sportmonksPred && sportmonksPred.correctScores && sportmonksPred.correctScores.length > 0) {
    const smMap: Record<string, number> = {};
    sportmonksPred.correctScores.forEach((s) => {
      smMap[s.score] = s.probability;
    });

    Object.keys(blendedScoresMap).forEach((key) => {
      const smVal = smMap[key] ?? 0;
      const localVal = blendedScoresMap[key];
      blendedScoresMap[key] = localVal * 0.30 + smVal * 0.70;
    });

    const totalBlended = Object.values(blendedScoresMap).reduce((sum, v) => sum + v, 0);
    if (totalBlended > 0) {
      Object.keys(blendedScoresMap).forEach((key) => {
        blendedScoresMap[key] = (blendedScoresMap[key] / totalBlended) * 100;
      });
    }
  }

  const correctScoresList = Object.entries(blendedScoresMap)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability);

  // 11. Top pick
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

  // 12. Confidence tier
  const matchProbsSorted = [homeWinPct, drawPct, awayWinPct].sort((a, b) => b - a);
  let confidence = confidenceTier(
    matchProbsSorted[0],
    matchProbsSorted[1],
    Math.min(homeForm.matchesAnalyzed, awayForm.matchesAnalyzed),
    Boolean(sportmonksPred),
  );

  // 13. Reasoning bullets
  const reasoning: string[] = [];
  if (sportmonksPred) {
    reasoning.push(
      `Sportmonks Pro AI predicts a ${Math.round(Math.max(sportmonksPred.homeWinPct, sportmonksPred.awayWinPct, sportmonksPred.drawPct))}% probability for this match outcome.`
    );
  }
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
  if (minMatches < 3 && !sportmonksPred)
    reasoning.push('Limited recent data — estimate leans on ELO prior and league averages.');
  if (reasoning.length === 0)
    reasoning.push('Model output based on team form + season-long goal averages.');

  // 14. Determine predicted score aligned with top pick
  const predictedScore = getConsistentPredictedScore(
    topPick.market,
    topPick.selection,
    fixture.teams.home.name,
    correctScoresList
  );

  return {
    fixtureId: fixture.fixture.id,
    homeWinPct,
    drawPct,
    awayWinPct,
    predictedScore,
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
      homeAdvantage,
    },
    computedAt: Date.now(),

    // Sportmonks Pro extended markets
    correctScores: correctScoresList.slice(0, 10),
    doubleChance: sportmonksPred?.doubleChance,
    halfTimeResult: sportmonksPred?.halfTimeResult,
    teamToScoreFirst: sportmonksPred?.teamToScoreFirst,
    cornersOverUnder: sportmonksPred?.cornersOverUnder,
    overUnderGoals: sportmonksPred?.overUnderGoals,
    source: sportmonksPred ? 'HYBRID' : 'BORO_AI',
  };
};

export const quickPredict = (fixture: Fixture): PredictionResult => {
  const seed =
    (fixture.fixture.id || 1) * 7919 +
    (fixture.teams.home.id || 1) * 31 +
    (fixture.teams.away.id || 1);
  const rng = seededRandom(seed);

  const homeStrength = 0.75 + rng() * 0.9;
  const awayStrength = 0.7 + rng() * 0.85;

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
  
  const bttsPct = clampPercent(poissonProbs.btts * 100);
  const over25Pct = clampPercent(poissonProbs.over25 * 100);
  const under25Pct = clampPercent(poissonProbs.under25 * 100);

  const top = [
    { market: 'WIN' as const, selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN' as const, selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW' as const, selection: 'Draw', probability: drawPct },
    { market: 'OVER_2_5' as const, selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5' as const, selection: 'Under 2.5 Goals', probability: under25Pct },
    { market: 'BTTS' as const, selection: 'Both Teams to Score', probability: bttsPct },
  ].sort((a, b) => b.probability - a.probability)[0];

  const correctScoresList = poissonProbs.scores
    .map((s) => ({ score: `${s.home}-${s.away}`, probability: s.prob * 100 }))
    .sort((a, b) => b.probability - a.probability);

  const predictedScore = getConsistentPredictedScore(
    top.market,
    top.selection,
    fixture.teams.home.name,
    correctScoresList
  );

  return {
    fixtureId: fixture.fixture.id,
    homeWinPct,
    drawPct,
    awayWinPct,
    predictedScore,
    bttsPct,
    over25Pct,
    under25Pct,
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
    correctScores: correctScoresList.slice(0, 10),
  };
};
