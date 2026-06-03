/**
 * Ensemble prediction orchestrator — real-data first.
 * Refactored to align with a world-class statistical prediction engine.
 */
import type { Fixture, H2HRecord } from '@/types/match';
import type { TeamStatistics } from '@/types/team';
import type {
  ConfidenceTier,
  PredictionResult,
  ValueBetInfo,
} from '@/types/prediction';
import { BASE_ELO_VALUE, computeEloFromHistory, eloWinProbability } from './elo';
import { buildFormSnapshot } from './form';
import { computeMatchProbabilities } from './poisson';
import { clampPercent, formatOdds } from '@/utils/format';
import { getLeagueById } from '@/constants/leagues';
import { useLearningStore } from '@/store/learningStore';
import { useCalibrationStore } from '@/store/calibrationStore';
import type { MatchInsights } from '../api/smInsights';
import { computeValueBets } from '../api/smInsights';

const HOME_ADVANTAGE_GOALS = 0.30;
const LEAGUE_AVG_HOME_GOALS = 1.50;
const LEAGUE_AVG_AWAY_GOALS = 1.15;
const MIN_LAMBDA = 0.35;
const MAX_LAMBDA = 3.6;
const SHRINKAGE_GAMES = 4;

const seededRandom = (seed: number) => {
  let t = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const eloToGoalMultiplier = (teamElo: number, oppElo: number): number => {
  const diff = teamElo - oppElo;
  return Math.max(0.6, Math.min(1.45, 1 + diff / 1200));
};

const shrink = (observed: number, n: number, prior: number, k = SHRINKAGE_GAMES): number => {
  if (!Number.isFinite(observed)) return prior;
  if (n <= 0) return prior;
  return (n * observed + k * prior) / (n + k);
};

const parseAvg = (raw?: string | number | null): number => {
  if (raw === null || raw === undefined) return NaN;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : NaN;
};

const coalesce = (...vals: number[]): number => {
  for (const v of vals) if (Number.isFinite(v) && v > 0) return v;
  return vals[vals.length - 1] ?? 0;
};

const homeAdvantageForLeague = (leagueId: number): number => {
  const league = getLeagueById(leagueId);
  if (!league) return HOME_ADVANTAGE_GOALS;
  if (league.isInternational) return HOME_ADVANTAGE_GOALS * 0.5;
  if (league.isCup) return HOME_ADVANTAGE_GOALS * 0.7;
  return HOME_ADVANTAGE_GOALS;
};

const norm3 = (a: number, b: number, c: number): [number, number, number] => {
  const t = a + b + c;
  if (t <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [a / t, b / t, c / t];
};

const confidenceTierFromScore = (score: number): ConfidenceTier => {
  if (score >= 90) return 'ELITE';
  if (score >= 80) return 'HIGH';
  if (score >= 70) return 'MEDIUM';
  return 'LOW';
};

const getConsistentPredictedScore = (
  market: 'WIN' | 'DRAW' | 'BTTS' | 'OVER_2_5' | 'UNDER_2_5',
  selection: string,
  homeTeamName: string,
  scoresList: Array<{ score: string; probability: number }>,
): { home: number; away: number } => {
  let targetType: 'home' | 'away' | 'draw' | 'btts_yes' | 'over' | 'under' = 'draw';
  if (market === 'WIN') targetType = selection.startsWith(homeTeamName) ? 'home' : 'away';
  else if (market === 'DRAW') targetType = 'draw';
  else if (market === 'BTTS') targetType = 'btts_yes';
  else if (market === 'OVER_2_5') targetType = 'over';
  else if (market === 'UNDER_2_5') targetType = 'under';

  for (const item of scoresList) {
    const parts = item.score.split('-');
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const a = parseInt(parts[1]);
      if (!isNaN(h) && !isNaN(a)) {
        let ok = false;
        switch (targetType) {
          case 'home': ok = h > a; break;
          case 'away': ok = a > h; break;
          case 'draw': ok = h === a; break;
          case 'btts_yes': ok = h >= 1 && a >= 1; break;
          case 'over': ok = h + a > 2; break;
          case 'under': ok = h + a <= 2; break;
        }
        if (ok) return { home: h, away: a };
      }
    }
  }
  if (scoresList.length > 0) {
    const parts = scoresList[0].score.split('-');
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const a = parseInt(parts[1]);
      if (!isNaN(h) && !isNaN(a)) return { home: h, away: a };
    }
  }
  return { home: 1, away: 1 };
};

export interface PredictorInputs {
  fixture: Fixture;
  homeHistory: Fixture[];
  awayHistory: Fixture[];
  homeStats?: TeamStatistics | null;
  awayStats?: TeamStatistics | null;
  h2h?: H2HRecord[];
  insights?: MatchInsights | null;

  // Additional optimizer inputs
  pressureIndex?: { home: number; away: number } | null;
  expectedLineups?: { homeStrength: number; awayStrength: number } | null;
  injuries?: { homeCount: number; awayCount: number } | null;
  suspensions?: { homeCount: number; awayCount: number } | null;
  standings?: { homePosition: number; awayPosition: number; totalTeams: number } | null;
}

export const predictFixture = (inputs: PredictorInputs): PredictionResult => {
  const {
    fixture,
    homeHistory,
    awayHistory,
    homeStats,
    awayStats,
    h2h,
    insights,
    pressureIndex,
    expectedLineups,
    injuries,
    suspensions,
    standings,
  } = inputs;

  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeAdvantage = homeAdvantageForLeague(fixture.league.id);
  const improvements: string[] = [];

  // ─────────────── 1. xG and xGA calculation (Priorities 1 & 2) ───────────────
  const homeXg = insights?.xg?.home ?? insights?.goals?.lambdaHome ?? 1.5;
  const awayXg = insights?.xg?.away ?? insights?.goals?.lambdaAway ?? 1.15;

  const homeXga = parseAvg(homeStats?.goals?.against?.average?.home) || 1.15;
  const awayXga = parseAvg(awayStats?.goals?.against?.average?.away) || 1.5;

  // ─────────────── 2. Base Model calculations ───────────────
  const combinedHistory = [...homeHistory, ...awayHistory].filter(
    (v, i, arr) => arr.findIndex((x) => x.fixture.id === v.fixture.id) === i,
  );
  const homeElo = computeEloFromHistory(homeId, combinedHistory);
  const awayElo = computeEloFromHistory(awayId, combinedHistory);
  const eloProb = eloWinProbability(homeElo, awayElo);

  const homeForm = buildFormSnapshot(homeId, homeHistory);
  const awayForm = buildFormSnapshot(awayId, awayHistory);

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

  const homeAttack = homeAvgFor / LEAGUE_AVG_HOME_GOALS;
  const awayDefense = awayAvgAgainst / LEAGUE_AVG_HOME_GOALS;
  const awayAttack = awayAvgFor / LEAGUE_AVG_AWAY_GOALS;
  const homeDefense = homeAvgAgainst / LEAGUE_AVG_AWAY_GOALS;

  let baseLambdaHome = LEAGUE_AVG_HOME_GOALS * homeAttack * awayDefense;
  let baseLambdaAway = LEAGUE_AVG_AWAY_GOALS * awayAttack * homeDefense;

  baseLambdaHome *= eloToGoalMultiplier(homeElo, awayElo);
  baseLambdaAway *= eloToGoalMultiplier(awayElo, homeElo);

  const rng = seededRandom(fixture.fixture.id || homeId * 1000 + awayId);
  const noiseHome = (rng() - 0.5) * 0.04;
  const noiseAway = (rng() - 0.5) * 0.04;
  const formBoostHome = (homeForm.weightedFormScore - 0.5) * 0.35;
  const formBoostAway = (awayForm.weightedFormScore - 0.5) * 0.35;

  let lambdaHome = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, baseLambdaHome + homeAdvantage + formBoostHome + noiseHome));
  let lambdaAway = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, baseLambdaAway + formBoostAway + noiseAway));

  if (insights?.xg && insights.xg.home > 0 && insights.xg.away > 0) {
    lambdaHome = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, lambdaHome * 0.6 + insights.xg.home * 0.4));
    lambdaAway = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, lambdaAway * 0.6 + insights.xg.away * 0.4));
    improvements.push("Integrated Sportmonks xG data into baseline goal expectations");
  }

  // Dixon-Coles goal distributions
  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway);

  // H2H (Light secondary signal)
  let h2hHomeAdj = 0;
  let h2hAwayAdj = 0;
  if (h2h && h2h.length > 0) {
    [...h2h]
      .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
      .forEach((m, idx) => {
        const recencyW = 1 / (1 + idx);
        const isHomeNow = m.teams.home.id === homeId;
        const hg = m.goals.home ?? 0;
        const ag = m.goals.away ?? 0;
        const delta = 0.015 * recencyW; // Keep H2H influence weak
        if (hg > ag) isHomeNow ? (h2hHomeAdj += delta) : (h2hAwayAdj += delta);
        else if (hg < ag) isHomeNow ? (h2hAwayAdj += delta) : (h2hHomeAdj += delta);
      });
  }

  // Statistical Model blending weights
  const minMatches = Math.min(homeForm.matchesAnalyzed, awayForm.matchesAnalyzed);
  let pW = 0.5;
  let eW = 0.35;
  let fW = 0.15;
  if (minMatches >= 5) { pW = 0.62; eW = 0.23; fW = 0.15; }
  else if (minMatches >= 3) { pW = 0.52; eW = 0.33; fW = 0.15; }
  else if (minMatches === 0) { pW = 0.25; eW = 0.75; fW = 0.0; }

  const formHomeTilt = homeForm.weightedFormScore;
  const formAwayTilt = awayForm.weightedFormScore;
  const formSum = formHomeTilt + formAwayTilt || 1;

  let [statHome, statDraw, statAway] = norm3(
    poisson.homeWin * pW + eloProb.home * eW + (formHomeTilt / formSum) * fW + h2hHomeAdj,
    poisson.draw * pW + eloProb.draw * eW + 0.26 * fW,
    poisson.awayWin * pW + eloProb.away * eW + (formAwayTilt / formSum) * fW + h2hAwayAdj,
  );

  // Blend with provider & bookmaker signals
  const signals: Array<{ home: number; draw: number; away: number; weight: number }> = [];
  signals.push({ home: statHome, draw: statDraw, away: statAway, weight: 0.34 });

  const pred = insights?.predictions;
  if (pred?.fulltimeResult) {
    const [h, d, a] = norm3(pred.fulltimeResult.home, pred.fulltimeResult.draw, pred.fulltimeResult.away);
    signals.push({ home: h, draw: d, away: a, weight: 0.30 });
  }
  const book = insights?.bookmaker;
  if (book?.fulltimeResult) {
    const [h, d, a] = norm3(book.fulltimeResult.home, book.fulltimeResult.draw, book.fulltimeResult.away);
    const sharp = book.overround && book.overround < 1.08 ? 0.42 : 0.36;
    signals.push({ home: h, draw: d, away: a, weight: sharp });
  }

  const wSum = signals.reduce((s, x) => s + x.weight, 0);
  let homeRaw = signals.reduce((s, x) => s + x.home * x.weight, 0) / wSum;
  let drawRaw = signals.reduce((s, x) => s + x.draw * x.weight, 0) / wSum;
  let awayRaw = signals.reduce((s, x) => s + x.away * x.weight, 0) / wSum;
  [homeRaw, drawRaw, awayRaw] = norm3(homeRaw, drawRaw, awayRaw);

  // ─────────────── 3. Apply Statistical Validation Checks ───────────────
  let adjustedHome = homeRaw;
  let adjustedDraw = drawRaw;
  let adjustedAway = awayRaw;

  // validation: xG vs Predicted Winner
  if (adjustedHome > adjustedAway && homeXg < awayXg) {
    adjustedHome -= 0.05;
    adjustedAway += 0.05;
    improvements.push("Calibrated home win probability down due to opposing xG advantage");
  } else if (adjustedAway > adjustedHome && awayXg < homeXg) {
    adjustedAway -= 0.05;
    adjustedHome += 0.05;
    improvements.push("Calibrated away win probability down due to opposing xG advantage");
  }

  // validation: xGA vs Predicted Winner
  if (adjustedHome > adjustedAway && homeXga > awayXga) {
    adjustedHome -= 0.03;
    adjustedAway += 0.03;
    improvements.push("Calibrated win probability due to higher home expected goals allowed (xGA)");
  }

  // validation: Pressure Index
  if (pressureIndex) {
    const diff = pressureIndex.home - pressureIndex.away;
    if (diff > 15) {
      adjustedHome += 0.06;
      adjustedAway -= 0.04;
      adjustedDraw -= 0.02;
      improvements.push("Adjusted probabilities using live Match Pressure Index");
    } else if (diff < -15) {
      adjustedAway += 0.06;
      adjustedHome -= 0.04;
      adjustedDraw -= 0.02;
      improvements.push("Adjusted probabilities using live Match Pressure Index");
    }
  }

  // validation: Expected Lineups
  if (expectedLineups) {
    const diff = expectedLineups.homeStrength - expectedLineups.awayStrength;
    if (diff > 10) {
      adjustedHome += 0.04;
      adjustedAway -= 0.04;
      improvements.push("Calibrated predictions using Expected Lineup tactical strengths");
    } else if (diff < -10) {
      adjustedAway += 0.04;
      adjustedHome -= 0.04;
      improvements.push("Calibrated predictions using Expected Lineup tactical strengths");
    }
  }

  // validation: Injuries and Suspensions
  if (injuries) {
    const penalty = (injuries.homeCount - injuries.awayCount) * 0.02;
    adjustedHome = Math.max(0.05, adjustedHome - penalty);
    adjustedAway = Math.max(0.05, adjustedAway + penalty);
    if (Math.abs(penalty) > 0.01) {
      improvements.push(`Adjusted win probabilities for team injury statistics (H: ${injuries.homeCount}, A: ${injuries.awayCount})`);
    }
  }

  if (suspensions) {
    const penalty = (suspensions.homeCount - suspensions.awayCount) * 0.025;
    adjustedHome = Math.max(0.05, adjustedHome - penalty);
    adjustedAway = Math.max(0.05, adjustedAway + penalty);
    if (Math.abs(penalty) > 0.01) {
      improvements.push(`Adjusted win probabilities for suspended roster players (H: ${suspensions.homeCount}, A: ${suspensions.awayCount})`);
    }
  }

  // validation: Standings
  if (standings) {
    const diff = standings.awayPosition - standings.homePosition; // Positive means Home is higher
    const step = diff / standings.totalTeams;
    adjustedHome = Math.max(0.05, adjustedHome + step * 0.05);
    adjustedAway = Math.max(0.05, adjustedAway - step * 0.05);
    improvements.push("Factored league table standing positions into the matchup estimation");
  }

  [adjustedHome, adjustedDraw, adjustedAway] = norm3(adjustedHome, adjustedDraw, adjustedAway);

  // validation: Overconfidence / underconfidence checks
  if (adjustedHome > 0.82) {
    adjustedHome = 0.82;
    [adjustedHome, adjustedDraw, adjustedAway] = norm3(adjustedHome, adjustedDraw, adjustedAway);
    improvements.push("Capped extreme win confidence to account for competitive league variance");
  } else if (adjustedAway > 0.82) {
    adjustedAway = 0.82;
    [adjustedHome, adjustedDraw, adjustedAway] = norm3(adjustedHome, adjustedDraw, adjustedAway);
    improvements.push("Capped extreme win confidence to account for competitive league variance");
  }

  const homeWinPct = clampPercent(adjustedHome * 100);
  const drawPct = clampPercent(adjustedDraw * 100);
  const awayWinPct = clampPercent(adjustedAway * 100);

  // ─────────────── 4. Goals & correct score distributions ───────────────
  let bttsPct = clampPercent(poisson.btts * 100);
  let over25Pct = clampPercent(poisson.over25 * 100);
  let under25Pct = clampPercent(poisson.under25 * 100);

  if (pred?.btts) {
    bttsPct = clampPercent(bttsPct * 0.4 + pred.btts.yes * 0.6);
  }
  if (pred?.overUnder?.['2.5']) {
    over25Pct = clampPercent(over25Pct * 0.4 + pred.overUnder['2.5'].over * 0.6);
    under25Pct = clampPercent(100 - over25Pct);
  }
  if (book?.overUnder25) {
    over25Pct = clampPercent(over25Pct * 0.45 + book.overUnder25.over * 100 * 0.55);
    under25Pct = clampPercent(100 - over25Pct);
  }
  if (book?.btts) {
    bttsPct = clampPercent(bttsPct * 0.5 + book.btts.yes * 100 * 0.5);
  }

  // Over/Under ladder
  const overUnderLines: Record<string, { over: number; under: number }> = {};
  const totalGoals = poisson.scores.map((s) => ({ g: s.home + s.away, p: s.prob }));
  for (const line of [0.5, 1.5, 2.5, 3.5]) {
    const over = totalGoals.filter((x) => x.g > line).reduce((s, x) => s + x.p, 0);
    overUnderLines[String(line)] = { over: clampPercent(over * 100), under: clampPercent((1 - over) * 100) };
  }

  // Correct scores
  const scoreMap: Record<string, number> = {};
  poisson.scores.forEach((s) => { scoreMap[`${s.home}-${s.away}`] = s.prob * 100; });
  if (pred?.correctScores && pred.correctScores.length > 0) {
    const provider: Record<string, number> = {};
    pred.correctScores.forEach((s) => { provider[s.score] = s.probability; });
    Object.keys(scoreMap).forEach((k) => {
      scoreMap[k] = scoreMap[k] * 0.35 + (provider[k] ?? 0) * 0.65;
    });
    const tot = Object.values(scoreMap).reduce((s, v) => s + v, 0);
    if (tot > 0) Object.keys(scoreMap).forEach((k) => { scoreMap[k] = (scoreMap[k] / tot) * 100; });
  }
  const correctScoresList = Object.entries(scoreMap)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability);

  // Double chance
  const doubleChance = {
    homeDraw: clampPercent(homeWinPct + drawPct),
    awayDraw: clampPercent(awayWinPct + drawPct),
    homeAway: clampPercent(homeWinPct + awayWinPct),
  };

  // ─────────────── 5. Pick Recommendations (Confidence >= 65%) ───────────────
  const candidates: Array<{ market: PredictionResult['topPick']['market']; selection: string; probability: number }> = [
    { market: 'WIN', selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN', selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW', selection: 'Draw', probability: drawPct },
    { market: 'BTTS', selection: 'Both Teams to Score', probability: bttsPct },
    { market: 'OVER_2_5', selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5', selection: 'Under 2.5 Goals', probability: under25Pct },
  ];

  // Filter recommendations below 65% unless explicitly required
  const recommendedCandidates = candidates.filter(c => c.probability >= 65);
  const bestCandidate = recommendedCandidates.length > 0
    ? recommendedCandidates.sort((a, b) => b.probability - a.probability)[0]
    : candidates.sort((a, b) => b.probability - a.probability)[0]; // Fallback to highest if none are >= 65%

  const calibratedTopProb = useCalibrationStore.getState().calibrate(bestCandidate.probability, bestCandidate.market);
  const topPick = { ...bestCandidate, probability: calibratedTopProb, odds: Number(formatOdds(calibratedTopProb)) };

  // Safest Bet (highest probability outcome among the general markets)
  const safestCandidate = candidates.sort((a, b) => b.probability - a.probability)[0];

  // Confidence Rules
  const maxProb = Math.max(homeWinPct, drawPct, awayWinPct);
  let confidenceScore = 60;
  if (maxProb >= 95) confidenceScore = 95;
  else if (maxProb >= 90) confidenceScore = 91;
  else if (maxProb >= 80) confidenceScore = 84;
  else if (maxProb >= 70) confidenceScore = 74;
  else if (maxProb >= 60) confidenceScore = 65;
  else confidenceScore = 55;

  // Adjust confidence score if validation indicators agree/conflict
  let agreementScore = 0;
  if (homeWinPct > awayWinPct) {
    if (homeXg > awayXg) agreementScore += 2;
    if (homeElo > awayElo) agreementScore += 2;
    if (pressureIndex && pressureIndex.home > pressureIndex.away) agreementScore += 2;
  } else if (awayWinPct > homeWinPct) {
    if (awayXg > homeXg) agreementScore += 2;
    if (awayElo > homeElo) agreementScore += 2;
    if (pressureIndex && pressureIndex.away > pressureIndex.home) agreementScore += 2;
  }
  confidenceScore = Math.min(100, Math.max(40, confidenceScore + agreementScore));
  const confidence = confidenceTierFromScore(confidenceScore);

  // Value bets vs the market
  let valueBets: ValueBetInfo[] = [];
  if (book?.bestOdds) {
    valueBets = computeValueBets(
      {
        home: homeWinPct, draw: drawPct, away: awayWinPct,
        over25: over25Pct, under25: under25Pct,
        bttsYes: bttsPct, bttsNo: clampPercent(100 - bttsPct),
      },
      book.bestOdds,
      0.03,
    ).map((v) => ({ ...v, selection: localizeSelection(v, fixture) }));
  }

  // Generate top correct scores (Realism check)
  const predictedScore = getConsistentPredictedScore(topPick.market, topPick.selection, fixture.teams.home.name, correctScoresList);

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
    reasoning: improvements.slice(0, 5),
    metrics: {
      homeElo: Math.round(homeElo) || BASE_ELO_VALUE,
      awayElo: Math.round(awayElo) || BASE_ELO_VALUE,
      homeForm: homeForm.weightedFormScore,
      awayForm: awayForm.weightedFormScore,
      homeXg: Number((insights?.xg?.home ?? lambdaHome).toFixed(2)),
      awayXg: Number((insights?.xg?.away ?? lambdaAway).toFixed(2)),
      homeAdvantage,
    },
    computedAt: Date.now(),
    correctScores: correctScoresList.slice(0, 10),
    doubleChance,
    overUnderLines,
    expectedGoals: {
      home: Number((insights?.xg?.home ?? lambdaHome).toFixed(2)),
      away: Number((insights?.xg?.away ?? lambdaAway).toFixed(2)),
      total: Number(((insights?.xg?.home ?? lambdaHome) + (insights?.xg?.away ?? lambdaAway)).toFixed(2)),
    },
    marketProbabilities: book?.fulltimeResult
      ? {
          home: clampPercent(book.fulltimeResult.home * 100),
          draw: clampPercent(book.fulltimeResult.draw * 100),
          away: clampPercent(book.fulltimeResult.away * 100),
        }
      : undefined,
    bestOdds: book?.bestOdds,
    valueBets: valueBets.length ? valueBets : undefined,
    marketOverround: book?.overround ?? null,
    source: book || pred ? 'HYBRID' : 'BORO_AI',
    dataSignals: signals.length,
  };
};

const localizeSelection = (v: { market: string; selection: string }, fixture: Fixture): string => {
  if (v.market === '1X2') {
    if (v.selection === 'Home') return `${fixture.teams.home.name} to Win`;
    if (v.selection === 'Away') return `${fixture.teams.away.name} to Win`;
    return 'Draw';
  }
  if (v.market === 'BTTS') return v.selection === 'Yes' ? 'Both Teams to Score' : 'No BTTS';
  return v.selection;
};

export const predictFromInsights = (fixture: Fixture, insights: MatchInsights | null): PredictionResult => {
  const pred = insights?.predictions;
  const book = insights?.bookmaker;

  if (!pred?.fulltimeResult && !book?.fulltimeResult) {
    return quickPredict(fixture);
  }

  const signals: Array<{ h: number; d: number; a: number; w: number }> = [];
  if (pred?.fulltimeResult) {
    const [h, d, a] = norm3(pred.fulltimeResult.home, pred.fulltimeResult.draw, pred.fulltimeResult.away);
    signals.push({ h, d, a, w: 0.35 });
  }
  if (book?.fulltimeResult) {
    const [h, d, a] = norm3(book.fulltimeResult.home, book.fulltimeResult.draw, book.fulltimeResult.away);
    const sharp = book.overround != null && book.overround < 1.07;
    const mid = book.overround != null && book.overround < 1.12;
    signals.push({ h, d, a, w: sharp ? 0.8 : mid ? 0.68 : 0.55 });
  }
  const wSum = signals.reduce((s, x) => s + x.w, 0) || 1;
  const [hP, dP, aP] = norm3(
    signals.reduce((s, x) => s + x.h * x.w, 0) / wSum,
    signals.reduce((s, x) => s + x.d * x.w, 0) / wSum,
    signals.reduce((s, x) => s + x.a * x.w, 0) / wSum,
  );

  const homeWinPct = clampPercent(hP * 100);
  const drawPct = clampPercent(dP * 100);
  const awayWinPct = clampPercent(aP * 100);

  const goals = insights?.goals;
  const ouSignals: Array<{ p: number; w: number }> = [];
  if (book?.overUnder25) ouSignals.push({ p: book.overUnder25.over * 100, w: 0.55 });
  if (pred?.overUnder?.['2.5']) ouSignals.push({ p: pred.overUnder['2.5'].over, w: 0.28 });
  if (goals?.over?.['2.5'] != null) ouSignals.push({ p: goals.over['2.5'] * 100, w: 0.24 });
  let over25Pct = 50;
  if (ouSignals.length > 0) {
    const w = ouSignals.reduce((s, x) => s + x.w, 0);
    over25Pct = clampPercent(ouSignals.reduce((s, x) => s + x.p * x.w, 0) / w);
  }
  const under25Pct = clampPercent(100 - over25Pct);

  const bttsSignals: Array<{ p: number; w: number }> = [];
  if (book?.btts) bttsSignals.push({ p: book.btts.yes * 100, w: 0.55 });
  if (pred?.btts) bttsSignals.push({ p: pred.btts.yes, w: 0.28 });
  if (goals?.bttsYes != null) bttsSignals.push({ p: goals.bttsYes * 100, w: 0.24 });
  let bttsPct = 50;
  if (bttsSignals.length > 0) {
    const w = bttsSignals.reduce((s, x) => s + x.w, 0);
    bttsPct = clampPercent(bttsSignals.reduce((s, x) => s + x.p * x.w, 0) / w);
  }

  const candidates: Array<{ market: PredictionResult['topPick']['market']; selection: string; probability: number }> = [
    { market: 'WIN', selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN', selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW', selection: 'Draw', probability: drawPct },
    { market: 'BTTS', selection: 'Both Teams to Score', probability: bttsPct },
    { market: 'OVER_2_5', selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5', selection: 'Under 2.5 Goals', probability: under25Pct },
  ];
  const top = [...candidates].sort((a, b) => b.probability - a.probability)[0];
  const calibratedTop = useCalibrationStore.getState().calibrate(top.probability, top.market);
  const topPick = { ...top, probability: calibratedTop, odds: Number(formatOdds(calibratedTop)) };

  const sortedProbs = [homeWinPct, drawPct, awayWinPct].sort((a, b) => b - a);
  const dataSignals = signals.length;
  let marketAgreement = 0.8;
  if (pred?.fulltimeResult && book?.fulltimeResult) {
    const [bh, bd, ba] = norm3(book.fulltimeResult.home, book.fulltimeResult.draw, book.fulltimeResult.away);
    marketAgreement = Math.max(0, 1 - (Math.abs(bh - hP) + Math.abs(bd - dP) + Math.abs(ba - aP)));
  }

  // Set confidence score mapped to the rules
  const maxProb = Math.max(homeWinPct, drawPct, awayWinPct);
  let confidenceScore = 65;
  if (maxProb >= 95) confidenceScore = 95;
  else if (maxProb >= 90) confidenceScore = 91;
  else if (maxProb >= 80) confidenceScore = 84;
  else if (maxProb >= 70) confidenceScore = 74;
  const confidence = confidenceTierFromScore(confidenceScore);

  const correctScores = pred?.correctScores?.slice(0, 10);
  const predictedScore = correctScores && correctScores.length
    ? getConsistentPredictedScore(topPick.market, topPick.selection, fixture.teams.home.name, correctScores)
    : { home: homeWinPct >= awayWinPct ? 2 : 1, away: homeWinPct >= awayWinPct ? 1 : 2 };

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
    reasoning: [book?.fulltimeResult ? 'Based on live bookmaker odds + provider model.' : 'Based on the SportMonks prediction model.'],
    metrics: {
      homeElo: BASE_ELO_VALUE,
      awayElo: BASE_ELO_VALUE,
      homeForm: 0.5,
      awayForm: 0.5,
      homeXg: insights?.goals ? Number(insights.goals.lambdaHome.toFixed(2)) : 0,
      awayXg: insights?.goals ? Number(insights.goals.lambdaAway.toFixed(2)) : 0,
      homeAdvantage: HOME_ADVANTAGE_GOALS,
    },
    computedAt: Date.now(),
    correctScores,
    doubleChance: pred?.doubleChance,
    overUnderLines: insights?.goals
      ? Object.fromEntries(
          Object.entries(insights.goals.over).map(([line, over]) => [
            line,
            { over: clampPercent(over * 100), under: clampPercent(100 - over * 100) },
          ]),
        )
      : undefined,
    expectedGoals: insights?.goals
      ? { home: insights.goals.lambdaHome, away: insights.goals.lambdaAway, total: insights.goals.expectedTotal }
      : undefined,
    marketProbabilities: book?.fulltimeResult
      ? { home: clampPercent(book.fulltimeResult.home * 100), draw: clampPercent(book.fulltimeResult.draw * 100), away: clampPercent(book.fulltimeResult.away * 100) }
      : undefined,
    bestOdds: book?.bestOdds,
    marketOverround: book?.overround ?? null,
    source: book || pred ? 'HYBRID' : 'BORO_AI',
    dataSignals,
  };
};

export const quickPredict = (fixture: Fixture): PredictionResult => {
  const seed = (fixture.fixture.id || 1) * 7919 + (fixture.teams.home.id || 1) * 31 + (fixture.teams.away.id || 1);
  const rng = seededRandom(seed);
  const homeStrength = 0.75 + rng() * 0.9;
  const awayStrength = 0.7 + rng() * 0.85;

  const lambdaHome = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, LEAGUE_AVG_HOME_GOALS * homeStrength + HOME_ADVANTAGE_GOALS));
  const lambdaAway = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, LEAGUE_AVG_AWAY_GOALS * awayStrength));

  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway);
  const homeWinPct = clampPercent(poisson.homeWin * 100);
  const drawPct = clampPercent(poisson.draw * 100);
  const awayWinPct = clampPercent(poisson.awayWin * 100);
  const bttsPct = clampPercent(poisson.btts * 100);
  const over25Pct = clampPercent(poisson.over25 * 100);
  const under25Pct = clampPercent(poisson.under25 * 100);

  const top = [
    { market: 'WIN' as const, selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN' as const, selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW' as const, selection: 'Draw', probability: drawPct },
    { market: 'OVER_2_5' as const, selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5' as const, selection: 'Under 2.5 Goals', probability: under25Pct },
    { market: 'BTTS' as const, selection: 'Both Teams to Score', probability: bttsPct },
  ].sort((a, b) => b.probability - a.probability)[0];

  const correctScoresList = poisson.scores
    .map((s) => ({ score: `${s.home}-${s.away}`, probability: s.prob * 100 }))
    .sort((a, b) => b.probability - a.probability);

  const predictedScore = getConsistentPredictedScore(top.market, top.selection, fixture.teams.home.name, correctScoresList);

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
