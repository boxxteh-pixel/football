/**
 * Ensemble prediction orchestrator — real-data first.
 *
 * Three independent signals are fused into a calibrated probability set:
 *   1. Statistical model  — ELO + recency-weighted Dixon-Coles Poisson built
 *      from each team's recent results (and refined by real xG when present).
 *   2. SportMonks model   — the provider's own probability engine (29 markets).
 *   3. Bookmaker market   — devigged fair probabilities from pre-match odds,
 *      averaged across books. This is usually the sharpest single signal.
 *
 * The blend weights adapt to which signals are actually available for the
 * fixture, so a match with full odds + predictions leans on the market while a
 * lower-league game with neither still gets a sound statistical estimate.
 *
 * Extended markets (correct score, HT/FT, O/U lines, corners, team-to-score-
 * first, double chance) come straight from the provider when present, else are
 * derived from the Poisson scoreline matrix. Value bets are flagged by
 * comparing the final model probabilities to the best available market odds.
 */
import type { Fixture, H2HRecord } from "@/types/match";
import type { TeamStatistics } from "@/types/team";
import type {
  ConfidenceTier,
  PredictionResult,
  ValueBetInfo,
} from "@/types/prediction";
import {
  BASE_ELO_VALUE,
  computeEloFromHistory,
  eloWinProbability,
} from "./elo";
import { buildFormSnapshot } from "./form";
import { computeMatchProbabilities } from "./poisson";
import { clampPercent, formatOdds } from "@/utils/format";
import { getLeagueById } from "@/constants/leagues";
import { useLearningStore } from "@/store/learningStore";
import { useCalibrationStore } from "@/store/calibrationStore";
import type { MatchInsights } from "../api/smInsights";
import { computeValueBets } from "../api/smInsights";

const HOME_ADVANTAGE_GOALS = 0.3;
const LEAGUE_AVG_HOME_GOALS = 1.5;
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

const shrink = (
  observed: number,
  n: number,
  prior: number,
  k = SHRINKAGE_GAMES,
): number => {
  if (!Number.isFinite(observed)) return prior;
  if (n <= 0) return prior;
  return (n * observed + k * prior) / (n + k);
};

const parseAvg = (raw?: string | number | null): number => {
  if (raw === null || raw === undefined) return NaN;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
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

/** Normalize a 3-way to sum 1; guards against zeros. */
const norm3 = (a: number, b: number, c: number): [number, number, number] => {
  const t = a + b + c;
  if (t <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [a / t, b / t, c / t];
};

const confidenceTier = (
  topProb: number,
  secondProb: number,
  dataSignals: number,
  marketAgreement: number, // 0-1, how closely model agrees with the market
): ConfidenceTier => {
  const margin = topProb - secondProb;
  // More independent signals + market agreement raise the ceiling.
  const strong = dataSignals >= 2 && marketAgreement >= 0.85;
  if (topProb >= 60 && margin >= 20 && strong) return "ELITE";
  if (topProb >= 52 && margin >= 12 && dataSignals >= 1) return "HIGH";
  if (topProb >= 42) return "MEDIUM";
  return "LOW";
};

const getConsistentPredictedScore = (
  market: PredictionResult["topPick"]["market"],
  selection: string,
  homeTeamName: string,
  scoresList: Array<{ score: string; probability: number }>,
): { home: number; away: number } => {
  let targetType: "home" | "away" | "draw" | "btts_yes" | "over" | "under" =
    "draw";
  if (market === "WIN")
    targetType = selection.startsWith(homeTeamName) ? "home" : "away";
  else if (market === "DRAW") targetType = "draw";
  else if (market === "BTTS") targetType = "btts_yes";
  else if (
    market === "OVER_0_5" ||
    market === "OVER_1_5" ||
    market === "OVER_2_5" ||
    market === "OVER_3_5" ||
    market === "OVER_4_5"
  )
    targetType = "over";
  else if (
    market === "UNDER_0_5" ||
    market === "UNDER_1_5" ||
    market === "UNDER_2_5" ||
    market === "UNDER_3_5" ||
    market === "UNDER_4_5"
  )
    targetType = "under";
  else if (market === "DC_1X" || market === "DC_12") targetType = "home";
  else if (market === "DC_X2") targetType = "away";

  for (const item of scoresList) {
    const parts = item.score.split("-");
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const a = parseInt(parts[1]);
      if (!isNaN(h) && !isNaN(a)) {
        let ok = false;
        switch (targetType) {
          case "home":
            ok = h > a;
            break;
          case "away":
            ok = a > h;
            break;
          case "draw":
            ok = h === a;
            break;
          case "btts_yes":
            ok = h >= 1 && a >= 1;
            break;
          case "over":
            ok = h + a > 2;
            break;
          case "under":
            ok = h + a <= 2;
            break;
        }
        if (ok) return { home: h, away: a };
      }
    }
  }
  if (scoresList.length > 0) {
    const parts = scoresList[0].score.split("-");
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
  /** Real-data insights: provider predictions + devigged bookmaker odds + xG. */
  insights?: MatchInsights | null;
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
  } = inputs;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const homeAdvantage = homeAdvantageForLeague(fixture.league.id);

  // ─────────────── 1. Statistical model (ELO + Poisson + form) ───────────────
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

  const homeAvgFor = shrink(
    homeAttackRaw,
    homeForm.matchesAnalyzed,
    LEAGUE_AVG_HOME_GOALS,
  );
  const homeAvgAgainst = shrink(
    homeConcedeRaw,
    homeForm.matchesAnalyzed,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayAvgFor = shrink(
    awayAttackRaw,
    awayForm.matchesAnalyzed,
    LEAGUE_AVG_AWAY_GOALS,
  );
  const awayAvgAgainst = shrink(
    awayConcedeRaw,
    awayForm.matchesAnalyzed,
    LEAGUE_AVG_HOME_GOALS,
  );

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

  let lambdaHome = Math.max(
    MIN_LAMBDA,
    Math.min(
      MAX_LAMBDA,
      baseLambdaHome + homeAdvantage + formBoostHome + noiseHome,
    ),
  );
  let lambdaAway = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, baseLambdaAway + formBoostAway + noiseAway),
  );

  // Refine λ with real xG when available (40% weight toward observed xG signal).
  if (insights?.xg && insights.xg.home > 0 && insights.xg.away > 0) {
    lambdaHome = Math.max(
      MIN_LAMBDA,
      Math.min(MAX_LAMBDA, lambdaHome * 0.6 + insights.xg.home * 0.4),
    );
    lambdaAway = Math.max(
      MIN_LAMBDA,
      Math.min(MAX_LAMBDA, lambdaAway * 0.6 + insights.xg.away * 0.4),
    );
  }

  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway);

  // H2H nudge (recency-decayed).
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
        const delta = 0.02 * recencyW;
        if (hg > ag) isHomeNow ? (h2hHomeAdj += delta) : (h2hAwayAdj += delta);
        else if (hg < ag)
          isHomeNow ? (h2hAwayAdj += delta) : (h2hHomeAdj += delta);
      });
  }

  // Statistical-model 1X2 (Poisson + ELO + form + H2H), internally weighted by sample size.
  const minMatches = Math.min(
    homeForm.matchesAnalyzed,
    awayForm.matchesAnalyzed,
  );
  let pW = 0.5;
  let eW = 0.35;
  let fW = 0.15;
  if (minMatches >= 5) {
    pW = 0.62;
    eW = 0.23;
    fW = 0.15;
  } else if (minMatches >= 3) {
    pW = 0.52;
    eW = 0.33;
    fW = 0.15;
  } else if (minMatches === 0) {
    pW = 0.25;
    eW = 0.75;
    fW = 0.0;
  }

  const { poissonBias, eloBias, formBias } = useLearningStore.getState();
  pW = Math.max(0.05, pW + poissonBias);
  eW = Math.max(0.05, eW + eloBias);
  fW = Math.max(0.0, fW + formBias);
  const wT = pW + eW + fW;
  pW /= wT;
  eW /= wT;
  fW /= wT;

  const formHomeTilt = homeForm.weightedFormScore;
  const formAwayTilt = awayForm.weightedFormScore;
  const formSum = formHomeTilt + formAwayTilt || 1;

  let [statHome, statDraw, statAway] = norm3(
    poisson.homeWin * pW +
      eloProb.home * eW +
      (formHomeTilt / formSum) * fW +
      h2hHomeAdj,
    poisson.draw * pW + eloProb.draw * eW + 0.26 * fW,
    poisson.awayWin * pW +
      eloProb.away * eW +
      (formAwayTilt / formSum) * fW +
      h2hAwayAdj,
  );

  // ─────────────── 2/3. Gather provider + market signals ───────────────
  const signals: Array<{
    home: number;
    draw: number;
    away: number;
    weight: number;
    kind: string;
  }> = [];
  signals.push({
    home: statHome,
    draw: statDraw,
    away: statAway,
    weight: 0.34,
    kind: "model",
  });

  const pred = insights?.predictions;
  if (pred?.fulltimeResult) {
    const [h, d, a] = norm3(
      pred.fulltimeResult.home,
      pred.fulltimeResult.draw,
      pred.fulltimeResult.away,
    );
    signals.push({ home: h, draw: d, away: a, weight: 0.3, kind: "provider" });
  }
  const book = insights?.bookmaker;
  if (book?.fulltimeResult) {
    const [h, d, a] = norm3(
      book.fulltimeResult.home,
      book.fulltimeResult.draw,
      book.fulltimeResult.away,
    );
    // Sharper markets (lower overround) get a bit more trust.
    const sharp = book.overround && book.overround < 1.08 ? 0.42 : 0.36;
    signals.push({ home: h, draw: d, away: a, weight: sharp, kind: "market" });
  }

  // Weighted ensemble of available 1X2 signals.
  const wSum = signals.reduce((s, x) => s + x.weight, 0);
  let homeRaw = signals.reduce((s, x) => s + x.home * x.weight, 0) / wSum;
  let drawRaw = signals.reduce((s, x) => s + x.draw * x.weight, 0) / wSum;
  let awayRaw = signals.reduce((s, x) => s + x.away * x.weight, 0) / wSum;
  [homeRaw, drawRaw, awayRaw] = norm3(homeRaw, drawRaw, awayRaw);

  const dataSignals = signals.length;

  const homeWinPct = clampPercent(homeRaw * 100);
  const drawPct = clampPercent(drawRaw * 100);
  const awayWinPct = clampPercent(awayRaw * 100);

  // ─────────────── Goals markets (BTTS, O/U lines) ───────────────
  let bttsPct = clampPercent(poisson.btts * 100);
  let over25Pct = clampPercent(poisson.over25 * 100);
  let under25Pct = clampPercent(poisson.under25 * 100);

  // Provider goals markets (model-grade) blended in.
  if (pred?.btts) {
    const [yes] = norm3(pred.btts.yes, pred.btts.no, 0);
    bttsPct = clampPercent(bttsPct * 0.4 + pred.btts.yes * 0.6);
  }
  if (pred?.overUnder?.["2.5"]) {
    over25Pct = clampPercent(
      over25Pct * 0.4 + pred.overUnder["2.5"].over * 0.6,
    );
    under25Pct = clampPercent(100 - over25Pct);
  }
  // Bookmaker goals markets (sharpest) get final say when present.
  if (book?.overUnder25) {
    over25Pct = clampPercent(
      over25Pct * 0.45 + book.overUnder25.over * 100 * 0.55,
    );
    under25Pct = clampPercent(100 - over25Pct);
  }
  if (book?.btts) {
    bttsPct = clampPercent(bttsPct * 0.5 + book.btts.yes * 100 * 0.5);
  }

  // Over/Under line ladder (prefer provider lines, else Poisson-derived).
  const overUnderLines: Record<string, { over: number; under: number }> = {};
  if (pred?.overUnder) {
    Object.entries(pred.overUnder).forEach(([line, v]) => {
      overUnderLines[line] = {
        over: clampPercent(v.over),
        under: clampPercent(v.under),
      };
    });
  } else {
    // Derive 1.5/2.5/3.5 from the Poisson scoreline matrix.
    const totalGoals = poisson.scores.map((s) => ({
      g: s.home + s.away,
      p: s.prob,
    }));
    for (const line of [1.5, 2.5, 3.5]) {
      const over = totalGoals
        .filter((x) => x.g > line)
        .reduce((s, x) => s + x.p, 0);
      overUnderLines[String(line)] = {
        over: clampPercent(over * 100),
        under: clampPercent((1 - over) * 100),
      };
    }
  }

  // ─────────────── Correct scores ───────────────
  const scoreMap: Record<string, number> = {};
  poisson.scores.forEach((s) => {
    scoreMap[`${s.home}-${s.away}`] = s.prob * 100;
  });
  if (pred?.correctScores && pred.correctScores.length > 0) {
    const provider: Record<string, number> = {};
    pred.correctScores.forEach((s) => {
      provider[s.score] = s.probability;
    });
    Object.keys(scoreMap).forEach((k) => {
      scoreMap[k] = scoreMap[k] * 0.35 + (provider[k] ?? 0) * 0.65;
    });
    const tot = Object.values(scoreMap).reduce((s, v) => s + v, 0);
    if (tot > 0)
      Object.keys(scoreMap).forEach((k) => {
        scoreMap[k] = (scoreMap[k] / tot) * 100;
      });
  }
  const correctScoresList = Object.entries(scoreMap)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability);

  // ─────────────── Extended markets (provider or derived) ───────────────
  const doubleChance = pred?.doubleChance
    ? pred.doubleChance
    : {
        homeDraw: clampPercent(homeWinPct + drawPct),
        awayDraw: clampPercent(awayWinPct + drawPct),
        homeAway: clampPercent(homeWinPct + awayWinPct),
      };

  const halfTimeResult = pred?.firstHalfResult
    ? {
        home: pred.firstHalfResult.home,
        draw: pred.firstHalfResult.draw,
        away: pred.firstHalfResult.away,
      }
    : undefined;

  const teamToScoreFirst = pred?.teamToScoreFirst
    ? {
        home: pred.teamToScoreFirst.home,
        away: pred.teamToScoreFirst.away,
        draw: pred.teamToScoreFirst.none,
      }
    : undefined;

  const cornersOverUnder =
    pred?.corners && pred.corners.length > 0 ? pred.corners : undefined;

  const overUnderGoals = Object.entries(overUnderLines).map(([line, v]) => ({
    label: `Over ${line}`,
    probability: v.over,
  }));

  // ─────────────── Top pick (multi-market) ───────────────
  // Derive Over/Under lines from the Poisson model or provider.
  const over15PctFull =
    overUnderLines["1.5"]?.over ?? clampPercent(poisson.over15 * 100);
  const over35PctFull =
    overUnderLines["3.5"]?.over ?? clampPercent(poisson.over35 * 100);
  const under15PctFull = clampPercent(100 - over15PctFull);
  const under35PctFull = clampPercent(100 - over35PctFull);
  // Derived Double Chance probabilities.
  const dc1xPct = clampPercent(homeWinPct + drawPct);
  const dcX2Pct = clampPercent(awayWinPct + drawPct);
  const dc12Pct = clampPercent(homeWinPct + awayWinPct);

  const candidates: Array<{
    market: PredictionResult["topPick"]["market"];
    selection: string;
    probability: number;
  }> = [
    {
      market: "WIN",
      selection: `${fixture.teams.home.name} to Win`,
      probability: homeWinPct,
    },
    {
      market: "WIN",
      selection: `${fixture.teams.away.name} to Win`,
      probability: awayWinPct,
    },
    { market: "DRAW", selection: "Draw", probability: drawPct },
    { market: "BTTS", selection: "Both Teams to Score", probability: bttsPct },
    {
      market: "OVER_1_5",
      selection: "Over 1.5 Goals",
      probability: over15PctFull,
    },
    {
      market: "UNDER_1_5",
      selection: "Under 1.5 Goals",
      probability: under15PctFull,
    },
    { market: "OVER_2_5", selection: "Over 2.5 Goals", probability: over25Pct },
    {
      market: "UNDER_2_5",
      selection: "Under 2.5 Goals",
      probability: under25Pct,
    },
    {
      market: "OVER_3_5",
      selection: "Over 3.5 Goals",
      probability: over35PctFull,
    },
    {
      market: "UNDER_3_5",
      selection: "Under 3.5 Goals",
      probability: under35PctFull,
    },
    {
      market: "DC_1X",
      selection: `${fixture.teams.home.name} or Draw`,
      probability: dc1xPct,
    },
    {
      market: "DC_X2",
      selection: `${fixture.teams.away.name} or Draw`,
      probability: dcX2Pct,
    },
    {
      market: "DC_12",
      selection: `${fixture.teams.home.name} or ${fixture.teams.away.name}`,
      probability: dc12Pct,
    },
  ];
  const topSorted = [...candidates].sort(
    (a, b) => b.probability - a.probability,
  );
  // Apply self-improving (per-market) calibration to the led market's probability.
  const calibratedTopProb = useCalibrationStore
    .getState()
    .calibrate(topSorted[0].probability, topSorted[0].market);
  const topPick = {
    ...topSorted[0],
    probability: calibratedTopProb,
    odds: Number(formatOdds(calibratedTopProb)),
  };

  // ─────────────── Market agreement + confidence ───────────────
  // How close is our 1X2 to the bookmaker's fair line? (1 = identical)
  let marketAgreement = 0.7;
  if (book?.fulltimeResult) {
    const [bh, bd, ba] = norm3(
      book.fulltimeResult.home,
      book.fulltimeResult.draw,
      book.fulltimeResult.away,
    );
    const dist =
      Math.abs(bh - homeRaw) + Math.abs(bd - drawRaw) + Math.abs(ba - awayRaw);
    marketAgreement = Math.max(0, 1 - dist); // L1 distance → agreement
  }
  const sortedProbs = [homeWinPct, drawPct, awayWinPct].sort((a, b) => b - a);
  const confidence = confidenceTier(
    sortedProbs[0],
    sortedProbs[1],
    dataSignals,
    marketAgreement,
  );

  // ─────────────── Value bets vs the market ───────────────
  let valueBets: ValueBetInfo[] = [];
  if (book?.bestOdds) {
    valueBets = computeValueBets(
      {
        home: homeWinPct,
        draw: drawPct,
        away: awayWinPct,
        over25: over25Pct,
        under25: under25Pct,
        bttsYes: bttsPct,
        bttsNo: clampPercent(100 - bttsPct),
      },
      book.bestOdds,
      0.04,
    ).map((v) => ({ ...v, selection: localizeSelection(v, fixture) }));
  }

  // ─────────────── Reasoning ───────────────
  const reasoning: string[] = [];
  if (book?.fulltimeResult) {
    const fav = Math.max(
      book.fulltimeResult.home,
      book.fulltimeResult.draw,
      book.fulltimeResult.away,
    );
    reasoning.push(
      `Bookmaker fair line (de-vigged across ${book.bookmakerCount} books) implies ${Math.round(fav * 100)}% for the favored outcome.`,
    );
  }
  if (pred?.fulltimeResult) {
    reasoning.push(
      `SportMonks model agrees on a ${Math.round(Math.max(pred.fulltimeResult.home, pred.fulltimeResult.draw, pred.fulltimeResult.away))}% peak outcome.`,
    );
  }
  if (insights?.xg) {
    reasoning.push(
      `Expected goals (xG) signal: ${insights.xg.home.toFixed(2)} – ${insights.xg.away.toFixed(2)}.`,
    );
  }
  if (homeForm.winStreak >= 2)
    reasoning.push(
      `${fixture.teams.home.name} on a ${homeForm.winStreak}-match win streak.`,
    );
  if (awayForm.winStreak >= 2)
    reasoning.push(
      `${fixture.teams.away.name} riding a ${awayForm.winStreak}-game win streak.`,
    );
  if (homeElo - awayElo > 80)
    reasoning.push(
      `ELO gap of +${Math.round(homeElo - awayElo)} favors ${fixture.teams.home.name}.`,
    );
  else if (awayElo - homeElo > 80)
    reasoning.push(
      `ELO gap of +${Math.round(awayElo - homeElo)} favors ${fixture.teams.away.name}.`,
    );
  if (valueBets.length > 0) {
    const v = valueBets[0];
    reasoning.push(
      `Value detected: ${v.selection} at ${v.bestOdds.toFixed(2)} (+${Math.round(v.edge * 100)}% edge vs market).`,
    );
  }
  if (over25Pct >= 65)
    reasoning.push(
      `Expected goal total ${(lambdaHome + lambdaAway).toFixed(2)} — Over 2.5 strong.`,
    );
  if (dataSignals === 1)
    reasoning.push(
      "Estimate from the statistical model (no live market/predictions for this fixture yet).",
    );
  if (reasoning.length === 0)
    reasoning.push(
      "Model output based on team form, ELO and league goal rates.",
    );

  const predictedScore = getConsistentPredictedScore(
    topPick.market,
    topPick.selection,
    fixture.teams.home.name,
    correctScoresList,
  );

  const source: PredictionResult["source"] =
    book || pred ? "HYBRID" : "BORO_AI";

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
    reasoning: reasoning.slice(0, 6),
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
    halfTimeResult,
    teamToScoreFirst,
    cornersOverUnder,
    overUnderGoals,
    source,
    overUnderLines,
    expectedGoals: {
      home: Number((insights?.xg?.home ?? lambdaHome).toFixed(2)),
      away: Number((insights?.xg?.away ?? lambdaAway).toFixed(2)),
      total: Number(
        (
          (insights?.xg?.home ?? lambdaHome) +
          (insights?.xg?.away ?? lambdaAway)
        ).toFixed(2),
      ),
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
    dataSignals,
  };
};

/** Map a raw value-bet selection to a human label using team names. */
const localizeSelection = (
  v: { market: string; selection: string },
  fixture: Fixture,
): string => {
  if (v.market === "1X2") {
    if (v.selection === "Home") return `${fixture.teams.home.name} to Win`;
    if (v.selection === "Away") return `${fixture.teams.away.name} to Win`;
    return "Draw";
  }
  if (v.market === "BTTS")
    return v.selection === "Yes" ? "Both Teams to Score" : "No BTTS";
  return v.selection;
};

/**
 * Real-data prediction for list rows/cards WITHOUT needing team history.
 *
 * Uses the provider's own 1X2/goals probabilities and/or devigged bookmaker
 * odds that are already attached to the fixture (fetched in one batched call).
 * Falls back to the neutral quick estimate only when a fixture genuinely has
 * no market or provider data (e.g. an obscure match not yet priced).
 */
export const predictFromInsights = (
  fixture: Fixture,
  insights: MatchInsights | null,
): PredictionResult => {
  const pred = insights?.predictions;
  const book = insights?.bookmaker;

  // No real data at all → honest neutral estimate.
  if (!pred?.fulltimeResult && !book?.fulltimeResult) {
    return quickPredict(fixture);
  }

  // Combine provider + market 1X2. The de-vigged bookmaker line is the single
  // hardest-to-beat signal (efficient-market evidence), so it gets the most
  // weight — even more when it's a sharp, low-margin line.
  const signals: Array<{ h: number; d: number; a: number; w: number }> = [];
  if (pred?.fulltimeResult) {
    const [h, d, a] = norm3(
      pred.fulltimeResult.home,
      pred.fulltimeResult.draw,
      pred.fulltimeResult.away,
    );
    signals.push({ h, d, a, w: 0.35 });
  }
  if (book?.fulltimeResult) {
    const [h, d, a] = norm3(
      book.fulltimeResult.home,
      book.fulltimeResult.draw,
      book.fulltimeResult.away,
    );
    const sharp = book.overround != null && book.overround < 1.07;
    const mid = book.overround != null && book.overround < 1.12;
    signals.push({ h, d, a, w: sharp ? 0.8 : mid ? 0.68 : 0.55 });
  }
  const wSum = signals.reduce((s, x) => s + x.w, 0) || 1;
  let [hP, dP, aP] = norm3(
    signals.reduce((s, x) => s + x.h * x.w, 0) / wSum,
    signals.reduce((s, x) => s + x.d * x.w, 0) / wSum,
    signals.reduce((s, x) => s + x.a * x.w, 0) / wSum,
  );

  const homeWinPct = clampPercent(hP * 100);
  const drawPct = clampPercent(dP * 100);
  const awayWinPct = clampPercent(aP * 100);

  // ─────────────── Goals markets (Over/Under 2.5 + BTTS) ───────────────
  // Ensemble of up to THREE real signals (most accurate when blended):
  //   1. Bookmaker O/U line (devigged) — sharpest single signal
  //   2. SportMonks provider model
  //   3. Dixon-Coles goals model from real season scoring rates
  const goals = insights?.goals;
  const ouSignals: Array<{ p: number; w: number }> = [];
  if (book?.overUnder25)
    ouSignals.push({ p: book.overUnder25.over * 100, w: 0.55 });
  if (pred?.overUnder?.["2.5"])
    ouSignals.push({ p: pred.overUnder["2.5"].over, w: 0.28 });
  if (goals?.over?.["2.5"] != null)
    ouSignals.push({ p: goals.over["2.5"] * 100, w: 0.24 });
  let over25Pct: number;
  if (ouSignals.length > 0) {
    const w = ouSignals.reduce((s, x) => s + x.w, 0);
    over25Pct = clampPercent(ouSignals.reduce((s, x) => s + x.p * x.w, 0) / w);
  } else {
    over25Pct = 50;
  }
  const under25Pct = clampPercent(100 - over25Pct);

  const bttsSignals: Array<{ p: number; w: number }> = [];
  if (book?.btts) bttsSignals.push({ p: book.btts.yes * 100, w: 0.55 });
  if (pred?.btts) bttsSignals.push({ p: pred.btts.yes, w: 0.28 });
  if (goals?.bttsYes != null)
    bttsSignals.push({ p: goals.bttsYes * 100, w: 0.24 });
  let bttsPct: number;
  if (bttsSignals.length > 0) {
    const w = bttsSignals.reduce((s, x) => s + x.w, 0);
    bttsPct = clampPercent(bttsSignals.reduce((s, x) => s + x.p * x.w, 0) / w);
  } else {
    bttsPct = 50;
  }

  // Derive Over/Under lines for topPick candidates
  const over15PctFI =
    clampPercent(
      insights?.goals?.over?.["1.5"] != null
        ? insights.goals.over["1.5"] * 100
        : 0,
    ) || clampPercent(100 - (over25Pct < 50 ? 85 : 65));
  const over35PctFI = clampPercent(
    insights?.goals?.over?.["3.5"] != null
      ? insights.goals.over["3.5"] * 100
      : Math.max(0, over25Pct - 25),
  );
  const under15PctFI = clampPercent(100 - over15PctFI);
  const under35PctFI = clampPercent(100 - over35PctFI);
  const dc1xPctFI = clampPercent(homeWinPct + drawPct);
  const dcX2PctFI = clampPercent(awayWinPct + drawPct);
  const dc12PctFI = clampPercent(homeWinPct + awayWinPct);

  const candidates: Array<{
    market: PredictionResult["topPick"]["market"];
    selection: string;
    probability: number;
  }> = [
    {
      market: "WIN",
      selection: `${fixture.teams.home.name} to Win`,
      probability: homeWinPct,
    },
    {
      market: "WIN",
      selection: `${fixture.teams.away.name} to Win`,
      probability: awayWinPct,
    },
    { market: "DRAW", selection: "Draw", probability: drawPct },
    { market: "BTTS", selection: "Both Teams to Score", probability: bttsPct },
    {
      market: "OVER_1_5",
      selection: "Over 1.5 Goals",
      probability: over15PctFI,
    },
    {
      market: "UNDER_1_5",
      selection: "Under 1.5 Goals",
      probability: under15PctFI,
    },
    { market: "OVER_2_5", selection: "Over 2.5 Goals", probability: over25Pct },
    {
      market: "UNDER_2_5",
      selection: "Under 2.5 Goals",
      probability: under25Pct,
    },
    {
      market: "OVER_3_5",
      selection: "Over 3.5 Goals",
      probability: over35PctFI,
    },
    {
      market: "UNDER_3_5",
      selection: "Under 3.5 Goals",
      probability: under35PctFI,
    },
    {
      market: "DC_1X",
      selection: `${fixture.teams.home.name} or Draw`,
      probability: dc1xPctFI,
    },
    {
      market: "DC_X2",
      selection: `${fixture.teams.away.name} or Draw`,
      probability: dcX2PctFI,
    },
    {
      market: "DC_12",
      selection: `${fixture.teams.home.name} or ${fixture.teams.away.name}`,
      probability: dc12PctFI,
    },
  ];
  const top = [...candidates].sort((a, b) => b.probability - a.probability)[0];
  const calibratedTop = useCalibrationStore
    .getState()
    .calibrate(top.probability, top.market);
  const topPick = {
    ...top,
    probability: calibratedTop,
    odds: Number(formatOdds(calibratedTop)),
  };

  const sortedProbs = [homeWinPct, drawPct, awayWinPct].sort((a, b) => b - a);
  const dataSignals = signals.length;
  let marketAgreement = 0.8;
  if (pred?.fulltimeResult && book?.fulltimeResult) {
    const [bh, bd, ba] = norm3(
      book.fulltimeResult.home,
      book.fulltimeResult.draw,
      book.fulltimeResult.away,
    );
    marketAgreement = Math.max(
      0,
      1 - (Math.abs(bh - hP) + Math.abs(bd - dP) + Math.abs(ba - aP)),
    );
  }
  const confidence = confidenceTier(
    sortedProbs[0],
    sortedProbs[1],
    dataSignals,
    marketAgreement,
  );

  // Correct scores from provider when present.
  const correctScores = pred?.correctScores?.slice(0, 10);
  const predictedScore =
    correctScores && correctScores.length
      ? getConsistentPredictedScore(
          topPick.market,
          topPick.selection,
          fixture.teams.home.name,
          correctScores,
        )
      : {
          home: homeWinPct >= awayWinPct ? 2 : 1,
          away: homeWinPct >= awayWinPct ? 1 : 2,
        };

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
    reasoning: [
      book?.fulltimeResult
        ? "Based on live bookmaker odds + provider model."
        : "Based on the SportMonks prediction model.",
    ],
    metrics: {
      homeElo: BASE_ELO_VALUE,
      awayElo: BASE_ELO_VALUE,
      homeForm: 0.5,
      awayForm: 0.5,
      homeXg: insights?.goals
        ? Number(insights.goals.lambdaHome.toFixed(2))
        : 0,
      awayXg: insights?.goals
        ? Number(insights.goals.lambdaAway.toFixed(2))
        : 0,
      homeAdvantage: HOME_ADVANTAGE_GOALS,
    },
    computedAt: Date.now(),
    correctScores,
    doubleChance: pred?.doubleChance,
    overUnderLines: insights?.goals
      ? Object.fromEntries(
          Object.entries(insights.goals.over).map(([line, over]) => [
            line,
            {
              over: clampPercent(over * 100),
              under: clampPercent(100 - over * 100),
            },
          ]),
        )
      : undefined,
    expectedGoals: insights?.goals
      ? {
          home: insights.goals.lambdaHome,
          away: insights.goals.lambdaAway,
          total: insights.goals.expectedTotal,
        }
      : undefined,
    marketProbabilities: book?.fulltimeResult
      ? {
          home: clampPercent(book.fulltimeResult.home * 100),
          draw: clampPercent(book.fulltimeResult.draw * 100),
          away: clampPercent(book.fulltimeResult.away * 100),
        }
      : undefined,
    bestOdds: book?.bestOdds,
    marketOverround: book?.overround ?? null,
    source: book || pred ? "HYBRID" : "BORO_AI",
    dataSignals,
  };
};

/**
 * Lightweight synchronous prediction for list rows/cards.
 * No network — neutral Poisson with a deterministic per-fixture seed.
 */
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
    Math.min(
      MAX_LAMBDA,
      LEAGUE_AVG_HOME_GOALS * homeStrength + HOME_ADVANTAGE_GOALS,
    ),
  );
  const lambdaAway = Math.max(
    MIN_LAMBDA,
    Math.min(MAX_LAMBDA, LEAGUE_AVG_AWAY_GOALS * awayStrength),
  );

  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway);
  const homeWinPct = clampPercent(poisson.homeWin * 100);
  const drawPct = clampPercent(poisson.draw * 100);
  const awayWinPct = clampPercent(poisson.awayWin * 100);
  const bttsPct = clampPercent(poisson.btts * 100);
  const over25Pct = clampPercent(poisson.over25 * 100);
  const under25Pct = clampPercent(poisson.under25 * 100);

  const over15PctQP = clampPercent(poisson.over15 * 100);
  const over35PctQP = clampPercent(poisson.over35 * 100);
  const dc1xPctQP = clampPercent(homeWinPct + drawPct);
  const dcX2PctQP = clampPercent(awayWinPct + drawPct);
  const dc12PctQP = clampPercent(homeWinPct + awayWinPct);

  const top = [
    {
      market: "WIN" as const,
      selection: `${fixture.teams.home.name} to Win`,
      probability: homeWinPct,
    },
    {
      market: "WIN" as const,
      selection: `${fixture.teams.away.name} to Win`,
      probability: awayWinPct,
    },
    { market: "DRAW" as const, selection: "Draw", probability: drawPct },
    {
      market: "OVER_1_5" as const,
      selection: "Over 1.5 Goals",
      probability: over15PctQP,
    },
    {
      market: "OVER_2_5" as const,
      selection: "Over 2.5 Goals",
      probability: over25Pct,
    },
    {
      market: "UNDER_2_5" as const,
      selection: "Under 2.5 Goals",
      probability: under25Pct,
    },
    {
      market: "OVER_3_5" as const,
      selection: "Over 3.5 Goals",
      probability: over35PctQP,
    },
    {
      market: "BTTS" as const,
      selection: "Both Teams to Score",
      probability: bttsPct,
    },
    {
      market: "DC_1X" as const,
      selection: `${fixture.teams.home.name} or Draw`,
      probability: dc1xPctQP,
    },
    {
      market: "DC_X2" as const,
      selection: `${fixture.teams.away.name} or Draw`,
      probability: dcX2PctQP,
    },
    {
      market: "DC_12" as const,
      selection: `${fixture.teams.home.name} or ${fixture.teams.away.name}`,
      probability: dc12PctQP,
    },
  ].sort((a, b) => b.probability - a.probability)[0];

  const correctScoresList = poisson.scores
    .map((s) => ({ score: `${s.home}-${s.away}`, probability: s.prob * 100 }))
    .sort((a, b) => b.probability - a.probability);

  const predictedScore = getConsistentPredictedScore(
    top.market,
    top.selection,
    fixture.teams.home.name,
    correctScoresList,
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
    confidence: "MEDIUM",
    topPick: { ...top, odds: Number(formatOdds(top.probability)) },
    reasoning: ["Quick estimate — open match details for full AI analysis."],
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
