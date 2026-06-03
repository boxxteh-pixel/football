/**
 * Advanced Football Forecasting Engine — Quantitative Model.
 *
 * Implements 16 quantitative optimization layers:
 *   1. Positional Injury Degradation (GK, DEF, MID, ATT)
 *   2. Squad Depth Adjustments (ELO-based depth factor)
 *   3. Dynamic xG Parameter Weighting
 *   4. Dynamic xGA Parameter Weighting
 *   5. Bayesian Shrinkage (K_c = 8.0)
 *   6. League Strength Coefficients
 *   7. Dynamic Home Advantage
 *   8. Dynamic League Goal Environment
 *   9. League-Specific Dixon-Coles parameters (rho_league)
 *   10. Dynamic Overround-Scaled Bookmaker Weighting
 *   11. Shin Devigging
 *   12. Odds Movement & Drift Analysis (Opening vs Current)
 *   13. Entropy-Based Confidence Calibration
 *   14. KL Divergence Validation vs Market
 *   15. Value Bet Detection (Model Prob vs Implied Prob)
 *   16. Bivariate Correct Score Distribution Optimization
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
import { devigShin } from './marketMath';
import { clampPercent, formatOdds } from '@/utils/format';
import { getLeagueById } from '@/constants/leagues';
import { useLearningStore } from '@/store/learningStore';
import { useCalibrationStore } from '@/store/calibrationStore';
import type { MatchInsights } from '../api/smInsights';
import { computeValueBets } from '../api/smInsights';

// Configurable constants for the Injury/Lineup model
const C_GK_DEF = 0.16;
const C_DEF_DEF = 0.11;
const C_MID_DEF = 0.05;
const C_MID_ATT = 0.08;
const C_ATT_ATT = 0.14;

// ELO reference parameters for squad depth normalization
const ELO_DEPTH_BASE = 1200;
const ELO_DEPTH_SCALE = 1000;

// Bayesian shrinkage parameters
const BAYES_K = 8.0;

const HOME_ADVANTAGE_GOALS = 0.30;
const LEAGUE_AVG_HOME_GOALS = 1.50;
const LEAGUE_AVG_AWAY_GOALS = 1.15;
const MIN_LAMBDA = 0.35;
const MAX_LAMBDA = 3.6;

// Form-derived scoring weight (blended into attack/defense strengths)
const FORM_GOAL_WEIGHT = 0.15;

// ─────────────── League Profile Database ───────────────
// Each league has empirical parameters from multi-season data:
//   strength:    relative league quality (UEFA coefficient scale, 1.0 = average European)
//   goalEnv:     league-specific goals-per-game multiplier vs global average
//   homeAdv:     league-specific home advantage in expected goals
//   drawRate:    historical draw frequency (used for Dixon-Coles rho)
interface LeagueProfile {
  strength: number;   // 0.5 (weak) – 1.2 (elite)
  goalEnv: number;    // 0.85 (defensive) – 1.15 (attacking)
  homeAdv: number;    // home advantage in goals
  drawRate: number;   // typical draw rate 0.20–0.30
}

const LEAGUE_PROFILES: Record<number, LeagueProfile> = {
  // Top 5 European leagues
  39:  { strength: 1.15, goalEnv: 1.08, homeAdv: 0.33, drawRate: 0.22 }, // Premier League
  135: { strength: 1.10, goalEnv: 0.92, homeAdv: 0.35, drawRate: 0.27 }, // Serie A
  140: { strength: 1.12, goalEnv: 0.95, homeAdv: 0.34, drawRate: 0.25 }, // La Liga
  78:  { strength: 1.08, goalEnv: 1.10, homeAdv: 0.30, drawRate: 0.23 }, // Bundesliga
  61:  { strength: 1.05, goalEnv: 0.96, homeAdv: 0.32, drawRate: 0.24 }, // Ligue 1
  // Strong European leagues
  94:  { strength: 0.95, goalEnv: 0.98, homeAdv: 0.31, drawRate: 0.24 }, // Liga Portugal
  88:  { strength: 0.90, goalEnv: 1.12, homeAdv: 0.28, drawRate: 0.21 }, // Eredivisie
  144: { strength: 0.88, goalEnv: 1.00, homeAdv: 0.30, drawRate: 0.24 }, // Belgian Pro League
  203: { strength: 0.85, goalEnv: 1.04, homeAdv: 0.32, drawRate: 0.23 }, // Super Lig (TR)
  179: { strength: 0.82, goalEnv: 1.02, homeAdv: 0.30, drawRate: 0.24 }, // Scottish Premiership
  // Second tiers
  40:  { strength: 0.80, goalEnv: 1.04, homeAdv: 0.32, drawRate: 0.24 }, // Championship (EN)
  136: { strength: 0.78, goalEnv: 0.95, homeAdv: 0.33, drawRate: 0.26 }, // Serie B
  141: { strength: 0.78, goalEnv: 0.96, homeAdv: 0.33, drawRate: 0.26 }, // La Liga 2
  62:  { strength: 0.75, goalEnv: 0.98, homeAdv: 0.31, drawRate: 0.25 }, // Ligue 2
  79:  { strength: 0.76, goalEnv: 1.06, homeAdv: 0.29, drawRate: 0.24 }, // 2. Bundesliga
  // Nordic
  113: { strength: 0.68, goalEnv: 1.10, homeAdv: 0.28, drawRate: 0.22 }, // Allsvenskan (SE)
  103: { strength: 0.65, goalEnv: 1.08, homeAdv: 0.27, drawRate: 0.23 }, // Eliteserien (NO)
  119: { strength: 0.70, goalEnv: 1.02, homeAdv: 0.29, drawRate: 0.24 }, // Superliga (DK)
  // Eastern Europe & others
  218: { strength: 0.72, goalEnv: 1.02, homeAdv: 0.30, drawRate: 0.24 }, // Austrian Bundesliga
  207: { strength: 0.75, goalEnv: 1.00, homeAdv: 0.28, drawRate: 0.25 }, // Swiss Super League
  197: { strength: 0.65, goalEnv: 0.96, homeAdv: 0.32, drawRate: 0.26 }, // Greek Super League
  106: { strength: 0.68, goalEnv: 1.00, homeAdv: 0.30, drawRate: 0.25 }, // Ekstraklasa (PL)
  235: { strength: 0.70, goalEnv: 0.94, homeAdv: 0.35, drawRate: 0.26 }, // Russian PL
  333: { strength: 0.62, goalEnv: 0.98, homeAdv: 0.34, drawRate: 0.25 }, // Ukrainian PL
  // South America
  128: { strength: 0.82, goalEnv: 0.92, homeAdv: 0.40, drawRate: 0.26 }, // Argentina LPF
  71:  { strength: 0.85, goalEnv: 0.96, homeAdv: 0.42, drawRate: 0.24 }, // Brazil Serie A
  72:  { strength: 0.68, goalEnv: 0.94, homeAdv: 0.38, drawRate: 0.25 }, // Brazil Serie B
  // North America & Asia
  253: { strength: 0.65, goalEnv: 1.06, homeAdv: 0.26, drawRate: 0.22 }, // MLS
  262: { strength: 0.72, goalEnv: 0.98, homeAdv: 0.35, drawRate: 0.25 }, // Liga MX
  98:  { strength: 0.70, goalEnv: 1.04, homeAdv: 0.30, drawRate: 0.23 }, // J1 League
  292: { strength: 0.65, goalEnv: 1.00, homeAdv: 0.28, drawRate: 0.24 }, // K League 1
  307: { strength: 0.60, goalEnv: 1.08, homeAdv: 0.30, drawRate: 0.22 }, // Saudi Pro League
  169: { strength: 0.55, goalEnv: 1.02, homeAdv: 0.32, drawRate: 0.24 }, // Chinese Super League
  233: { strength: 0.55, goalEnv: 0.90, homeAdv: 0.36, drawRate: 0.27 }, // Egypt Premier
};

const DEFAULT_LEAGUE_PROFILE: LeagueProfile = {
  strength: 0.75, goalEnv: 1.00, homeAdv: HOME_ADVANTAGE_GOALS, drawRate: 0.25,
};

const INTERNATIONAL_PROFILE: LeagueProfile = {
  strength: 0.90, goalEnv: 0.92, homeAdv: 0.15, drawRate: 0.24,
};

const getLeagueProfile = (leagueId: number | undefined, isInternational?: boolean): LeagueProfile => {
  if (isInternational) return INTERNATIONAL_PROFILE;
  return LEAGUE_PROFILES[leagueId ?? 0] ?? DEFAULT_LEAGUE_PROFILE;
};

const computeDynamicLeagueProfile = (
  leagueId: number | undefined,
  history: Fixture[],
  defaultProfile: LeagueProfile
): LeagueProfile => {
  if (!leagueId || !history || history.length === 0) return defaultProfile;

  // Filter history to matches in the same league
  const leagueMatches = history.filter(
    (f) => f.league?.id === leagueId && f.goals?.home != null && f.goals?.away != null
  );

  const matchCount = leagueMatches.length;
  if (matchCount === 0) return defaultProfile;

  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let draws = 0;

  leagueMatches.forEach((f) => {
    const hg = f.goals.home!;
    const ag = f.goals.away!;
    totalHomeGoals += hg;
    totalAwayGoals += ag;
    if (hg === ag) draws++;
  });

  const avgHome = totalHomeGoals / matchCount;
  const avgAway = totalAwayGoals / matchCount;
  const drawRate = draws / matchCount;

  // Normalizing against base expected goals (1.50 home, 1.15 away -> 2.65 total)
  const observedAvgTotal = avgHome + avgAway;
  const goalEnv = Math.max(0.70, Math.min(1.40, observedAvgTotal / 2.65));
  // Divide by 2 to control team-strength/schedule/random noise bias
  const homeAdv = Math.max(0.05, Math.min(0.65, (avgHome - avgAway) / 2.0));

  // Bayesian shrinkage blend weight
  const blendWeight = matchCount / (matchCount + 50.0);

  return {
    strength: defaultProfile.strength,
    goalEnv: (1.0 - blendWeight) * defaultProfile.goalEnv + blendWeight * goalEnv,
    homeAdv: (1.0 - blendWeight) * defaultProfile.homeAdv + blendWeight * homeAdv,
    drawRate: (1.0 - blendWeight) * defaultProfile.drawRate + blendWeight * drawRate,
  };
};

/**
 * Dynamic Dixon-Coles rho as a function of draw rate, goal environment, and league strength.
 * ρ ≈ -0.13 · drawRate / goalEnv · strength
 * More defensive + more draws → stronger negative rho (more 0-0/1-0 correction).
 * More attacking → weaker rho (goals are more independent).
 */
const computeDynamicRho = (profile: LeagueProfile): number => {
  const baseRho = -0.13 * (profile.drawRate / 0.25) * (1.0 / profile.goalEnv) * Math.sqrt(profile.strength);
  return Math.max(-0.15, Math.min(-0.02, baseRho));
};

// Safe entropy term: avoids 0·log(0) = NaN
const safeEntropy = (p: number): number => (p > 0 ? p * Math.log(p) : 0);

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

const parseAvg = (raw?: string | number | null): number => {
  if (raw === null || raw === undefined) return NaN;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : NaN;
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

  // Rich inputs to satisfy the mathematical injury & lineup structures
  injuries?: {
    home: Array<{ position: 'GK' | 'DEF' | 'MID' | 'ATT'; role: 'key_starter' | 'starter' | 'rotation' | 'sub' }>;
    away: Array<{ position: 'GK' | 'DEF' | 'MID' | 'ATT'; role: 'key_starter' | 'starter' | 'rotation' | 'sub' }>;
  } | null;
  lineups?: {
    homeFormationChanged?: boolean;
    awayFormationChanged?: boolean;
  } | null;
  oddsMovement?: {
    opening?: { home?: number; draw?: number; away?: number };
    current?: { home?: number; draw?: number; away?: number };
  } | null;
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
    injuries,
    lineups,
    oddsMovement,
  } = inputs;

  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const improvements: string[] = [];

  // ELO calculation for priors and squad depth
  const combinedHistory = [...homeHistory, ...awayHistory].filter(
    (v, i, arr) => arr.findIndex((x) => x.fixture.id === v.fixture.id) === i,
  );
  const homeElo = computeEloFromHistory(homeId, combinedHistory) || BASE_ELO_VALUE;
  const awayElo = computeEloFromHistory(awayId, combinedHistory) || BASE_ELO_VALUE;
  const eloProb = eloWinProbability(homeElo, awayElo);

  // ─────────────── 1. Positional Injury & Squad Depth Model ───────────────
  const getRoleWeight = (role: string): number => {
    switch (role) {
      case 'key_starter': return 1.0;
      case 'starter': return 0.7;
      case 'rotation': return 0.4;
      case 'sub': return 0.15;
      default: return 0.15;
    }
  };

  const computeDegradation = (
    playerList: Array<{ position: 'GK' | 'DEF' | 'MID' | 'ATT'; role: 'key_starter' | 'starter' | 'rotation' | 'sub' }>,
    elo: number,
  ) => {
    const depthFactor = Math.max(0, Math.min(0.5, (elo - ELO_DEPTH_BASE) / ELO_DEPTH_SCALE));
    let rawDef = 0;
    let rawAtt = 0;

    playerList.forEach((p) => {
      const w = getRoleWeight(p.role);
      if (p.position === 'GK') rawDef += w * C_GK_DEF;
      else if (p.position === 'DEF') rawDef += w * C_DEF_DEF;
      else if (p.position === 'MID') {
        rawDef += w * C_MID_DEF;
        rawAtt += w * C_MID_ATT;
      } else if (p.position === 'ATT') {
        rawAtt += w * C_ATT_ATT;
      }
    });

    return {
      defDegradation: 1.0 - Math.min(0.40, rawDef * (1.0 - depthFactor)),
      attDegradation: 1.0 - Math.min(0.40, rawAtt * (1.0 - depthFactor)),
    };
  };

  const homeDegradation = computeDegradation(injuries?.home || [], homeElo);
  const awayDegradation = computeDegradation(injuries?.away || [], awayElo);

  // Lineup tactical changes modifier
  let homeTacticalMod = 1.0;
  let awayTacticalMod = 1.0;
  if (lineups?.homeFormationChanged) homeTacticalMod = 0.96;
  if (lineups?.awayFormationChanged) awayTacticalMod = 0.96;

  // ─────────────── 2. Bayesian xG Shrinkage & Goal Environment ───────────────
  const homeForm = buildFormSnapshot(homeId, homeHistory);
  const awayForm = buildFormSnapshot(awayId, awayHistory);
  const N_matches = Math.min(homeForm.matchesAnalyzed, awayForm.matchesAnalyzed);
  const w_xG = N_matches / (N_matches + BAYES_K);

  const homeXgObserved = insights?.xg?.home ?? insights?.goals?.lambdaHome ?? LEAGUE_AVG_HOME_GOALS;
  const awayXgObserved = insights?.xg?.away ?? insights?.goals?.lambdaAway ?? LEAGUE_AVG_AWAY_GOALS;

  const homeXgaConceded = parseAvg(homeStats?.goals?.against?.average?.home) || LEAGUE_AVG_AWAY_GOALS;
  const awayXgaConceded = parseAvg(awayStats?.goals?.against?.average?.away) || LEAGUE_AVG_HOME_GOALS;

  // Form-derived scoring rates (time-decayed actual goals)
  const homeFormGoalRate = Number.isFinite(homeForm.avgGoalsFor) ? homeForm.avgGoalsFor / LEAGUE_AVG_HOME_GOALS : 1.0;
  const awayFormGoalRate = Number.isFinite(awayForm.avgGoalsFor) ? awayForm.avgGoalsFor / LEAGUE_AVG_AWAY_GOALS : 1.0;
  const homeFormConcRate = Number.isFinite(homeForm.avgGoalsAgainst) ? homeForm.avgGoalsAgainst / LEAGUE_AVG_AWAY_GOALS : 1.0;
  const awayFormConcRate = Number.isFinite(awayForm.avgGoalsAgainst) ? awayForm.avgGoalsAgainst / LEAGUE_AVG_HOME_GOALS : 1.0;

  // Attack strengths and defense weaknesses: ELO prior + xG + form-derived scoring
  const xgWeight = w_xG * (1.0 - FORM_GOAL_WEIGHT);
  const formWeight = w_xG * FORM_GOAL_WEIGHT;
  const priorWeight = 1.0 - w_xG;

  const homeAttackStrength = priorWeight * (homeElo / BASE_ELO_VALUE) + xgWeight * (homeXgObserved / LEAGUE_AVG_HOME_GOALS) + formWeight * homeFormGoalRate;
  const awayDefenseWeakness = priorWeight * (BASE_ELO_VALUE / awayElo) + xgWeight * (awayXgaConceded / LEAGUE_AVG_HOME_GOALS) + formWeight * awayFormConcRate;

  const awayAttackStrength = priorWeight * (awayElo / BASE_ELO_VALUE) + xgWeight * (awayXgObserved / LEAGUE_AVG_AWAY_GOALS) + formWeight * awayFormGoalRate;
  const homeDefenseWeakness = priorWeight * (BASE_ELO_VALUE / homeElo) + xgWeight * (homeXgaConceded / LEAGUE_AVG_AWAY_GOALS) + formWeight * homeFormConcRate;

  // ─────────────── 3. League Strength, Goal Environment & Dynamic Home Advantage ───────────────
  const league = getLeagueById(fixture.league.id);
  const staticProfile = getLeagueProfile(fixture.league.id, league?.isInternational);
  const leagueProfile = computeDynamicLeagueProfile(fixture.league.id, combinedHistory, staticProfile);

  // League goal environment adjusts the base lambdas
  const leagueGoalEnv = leagueProfile.goalEnv;
  // League-specific home advantage (replaces flat 0.30)
  const leagueHomeAdv = leagueProfile.homeAdv;
  // League strength coefficient: scales confidence in model outputs
  const leagueStrength = leagueProfile.strength;

  let lambdaHome = (LEAGUE_AVG_HOME_GOALS * leagueGoalEnv) * homeAttackStrength * awayDefenseWeakness * homeDegradation.attDegradation * awayDegradation.defDegradation * homeTacticalMod;
  let lambdaAway = (LEAGUE_AVG_AWAY_GOALS * leagueGoalEnv) * awayAttackStrength * homeDefenseWeakness * awayDegradation.attDegradation * homeDegradation.defDegradation * awayTacticalMod;

  lambdaHome = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, lambdaHome + leagueHomeAdv));
  lambdaAway = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, lambdaAway));

  // Dynamic Dixon-Coles rho = f(drawRate, goalEnvironment, leagueStrength)
  const rhoLeague = computeDynamicRho(leagueProfile);
  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway, rhoLeague);

  // Light secondary ELO and H2H parameters
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
        const delta = 0.012 * recencyW; // Constrain influence to minor levels
        if (hg > ag) isHomeNow ? (h2hHomeAdj += delta) : (h2hAwayAdj += delta);
        else if (hg < ag) isHomeNow ? (h2hAwayAdj += delta) : (h2hHomeAdj += delta);
      });
  }

  // ─── Learning store bias integration ───
  // Adjust Poisson vs ELO blend weights based on historical performance feedback
  const learningState = useLearningStore.getState();
  const basePoissonW = 0.60 + (learningState.poissonBias ?? 0);
  const baseEloW = 0.40 + (learningState.eloBias ?? 0);
  // Renormalize so they still sum to 1.0
  const blendTotal = basePoissonW + baseEloW;
  const poissonW = blendTotal > 0 ? basePoissonW / blendTotal : 0.60;
  const eloW = blendTotal > 0 ? baseEloW / blendTotal : 0.40;

  let [statHome, statDraw, statAway] = norm3(
    poisson.homeWin * poissonW + eloProb.home * eloW + h2hHomeAdj,
    poisson.draw * poissonW + eloProb.draw * eloW,
    poisson.awayWin * poissonW + eloProb.away * eloW + h2hAwayAdj,
  );

  // ─────────────── 4. Bookmaker Devigging & Overround Scaling ───────────────
  const book = insights?.bookmaker;
  const hasMarket = book?.fulltimeResult && book.overround;
  let marketProbHome = statHome;
  let marketProbDraw = statDraw;
  let marketProbAway = statAway;

  let overroundWeight = 0.0;
  if (hasMarket && book.overround) {
    const rawOverround = book.overround;
    // Lower overround indicates higher liquidity (sharpness) -> higher weight
    overroundWeight = 0.42 * Math.exp(-3.5 * (rawOverround - 1.0));
    if (book.bestOdds?.home && book.bestOdds?.draw && book.bestOdds?.away) {
      const [mh, md, ma] = devigShin([book.bestOdds.home, book.bestOdds.draw, book.bestOdds.away]);
      marketProbHome = mh;
      marketProbDraw = md;
      marketProbAway = ma;
    } else {
      const [mh, md, ma] = norm3(book.fulltimeResult?.home ?? 0, book.fulltimeResult?.draw ?? 0, book.fulltimeResult?.away ?? 0);
      marketProbHome = mh;
      marketProbDraw = md;
      marketProbAway = ma;
    }
  }

  // ─────────────── 5. Odds Drift Signal Integration ───────────────
  let driftHomeAdj = 1.0;
  let driftAwayAdj = 1.0;
  if (oddsMovement?.opening && oddsMovement?.current) {
    const op = oddsMovement.opening;
    const cur = oddsMovement.current;
    if (op.home && cur.home && op.away && cur.away) {
      const driftHome = Math.log(cur.home / op.home);
      const driftAway = Math.log(cur.away / op.away);
      driftHomeAdj = Math.exp(-0.15 * driftHome);
      driftAwayAdj = Math.exp(-0.15 * driftAway);
    }
  }

  // Blended probabilities
  let homeRaw = statHome * (1.0 - overroundWeight) + marketProbHome * overroundWeight;
  let drawRaw = statDraw * (1.0 - overroundWeight) + marketProbDraw * overroundWeight;
  let awayRaw = statAway * (1.0 - overroundWeight) + marketProbAway * overroundWeight;

  homeRaw *= driftHomeAdj;
  awayRaw *= driftAwayAdj;
  [homeRaw, drawRaw, awayRaw] = norm3(homeRaw, drawRaw, awayRaw);

  const homeWinPct = clampPercent(homeRaw * 100);
  const drawPct = clampPercent(drawRaw * 100);
  const awayWinPct = clampPercent(awayRaw * 100);

  // ─────────────── 6. Secondary Goals markets (BTTS, O/U lines) ───────────────
  let bttsPct = clampPercent(poisson.btts * 100);
  let over25Pct = clampPercent(poisson.over25 * 100);
  let under25Pct = clampPercent(poisson.under25 * 100);

  if (insights?.predictions?.btts) {
    bttsPct = clampPercent(bttsPct * 0.4 + insights.predictions.btts.yes * 0.6);
  }
  if (insights?.predictions?.overUnder?.['2.5']) {
    over25Pct = clampPercent(over25Pct * 0.4 + insights.predictions.overUnder['2.5'].over * 0.6);
    under25Pct = clampPercent(100 - over25Pct);
  }
  if (book?.overUnder25) {
    over25Pct = clampPercent(over25Pct * 0.45 + book.overUnder25.over * 100 * 0.55);
    under25Pct = clampPercent(100 - over25Pct);
  }
  if (book?.btts) {
    bttsPct = clampPercent(bttsPct * 0.5 + book.btts.yes * 100 * 0.5);
  }

  const overUnderLines: Record<string, { over: number; under: number }> = {};
  const totalGoals = poisson.scores.map((s) => ({ g: s.home + s.away, p: s.prob }));
  for (const line of [0.5, 1.5, 2.5, 3.5]) {
    const over = totalGoals.filter((x) => x.g > line).reduce((s, x) => s + x.p, 0);
    overUnderLines[String(line)] = { over: clampPercent(over * 100), under: clampPercent((1 - over) * 100) };
  }

  const scoreMap: Record<string, number> = {};
  poisson.scores.forEach((s) => { scoreMap[`${s.home}-${s.away}`] = s.prob * 100; });
  if (insights?.predictions?.correctScores && insights.predictions.correctScores.length > 0) {
    const provider: Record<string, number> = {};
    insights.predictions.correctScores.forEach((s) => { provider[s.score] = s.probability; });
    Object.keys(scoreMap).forEach((k) => {
      scoreMap[k] = scoreMap[k] * 0.35 + (provider[k] ?? 0) * 0.65;
    });
    const tot = Object.values(scoreMap).reduce((s, v) => s + v, 0);
    if (tot > 0) Object.keys(scoreMap).forEach((k) => { scoreMap[k] = (scoreMap[k] / tot) * 100; });
  }
  // Tail suppression: reduce weight of unrealistic high-scoring lines (≥6 total goals)
  Object.keys(scoreMap).forEach((k) => {
    const parts = k.split('-');
    if (parts.length === 2) {
      const totalG = parseInt(parts[0]) + parseInt(parts[1]);
      if (totalG >= 6) scoreMap[k] *= 0.40; // suppress by 60%
    }
  });
  // Re-normalize after suppression
  const csTotal = Object.values(scoreMap).reduce((s, v) => s + v, 0);
  if (csTotal > 0) Object.keys(scoreMap).forEach((k) => { scoreMap[k] = (scoreMap[k] / csTotal) * 100; });

  // Correct scores distribution smoothing: blend with a dynamic prior of realistic scores based on expected total goals
  const expectedTotal = lambdaHome + lambdaAway;
  let PRIOR_SCORES: Record<string, number>;
  if (expectedTotal > 3.2) {
    PRIOR_SCORES = {
      "2-1": 0.15, "1-2": 0.10, "2-2": 0.18, "3-1": 0.15, "1-3": 0.08, "3-2": 0.12, "2-3": 0.08, "3-3": 0.06, "4-1": 0.05, "1-4": 0.03
    };
  } else if (expectedTotal < 2.2) {
    PRIOR_SCORES = {
      "0-0": 0.24, "1-0": 0.26, "0-1": 0.18, "1-1": 0.22, "2-0": 0.06, "0-2": 0.04
    };
  } else {
    PRIOR_SCORES = {
      "0-0": 0.08, "1-0": 0.15, "0-1": 0.10, "1-1": 0.20, "2-1": 0.18, "1-2": 0.12, "2-0": 0.08, "0-2": 0.05, "2-2": 0.04
    };
  }
  for (const score in PRIOR_SCORES) {
    if (!(score in scoreMap)) {
      scoreMap[score] = 0;
    }
  }
  const priorSum = Object.values(PRIOR_SCORES).reduce((s, v) => s + v, 0);
  const scoreKeys = Object.keys(scoreMap);
  if (scoreKeys.length > 0) {
    const smoothingFactor = 0.05; // 5% prior blend
    scoreKeys.forEach((k) => {
      const priorVal = PRIOR_SCORES[k] ? (PRIOR_SCORES[k] / priorSum) * 100 : 0;
      scoreMap[k] = scoreMap[k] * (1.0 - smoothingFactor) + priorVal * smoothingFactor;
    });
  }

  const correctScoresList = Object.entries(scoreMap)
    .map(([score, probability]) => ({ score, probability }))
    .sort((a, b) => b.probability - a.probability);

  const doubleChance = {
    homeDraw: clampPercent(homeWinPct + drawPct),
    awayDraw: clampPercent(awayWinPct + drawPct),
    homeAway: clampPercent(homeWinPct + awayWinPct),
  };

  // ─────────────── 7. Information-Theoretic Confidence ───────────────
  // Outcome Shannon Entropy (safe: avoids 0·log(0))
  const pH = homeWinPct / 100;
  const pD = drawPct / 100;
  const pA = awayWinPct / 100;
  const h_prob = safeEntropy(pH) + safeEntropy(pD) + safeEntropy(pA);
  const normalizedEntropy = -h_prob / Math.log(3);

  // KL Divergence vs. bookmaker odds
  let klDivergence = 0.0;
  if (hasMarket) {
    const pmh = Math.max(0.001, marketProbHome);
    const pmd = Math.max(0.001, marketProbDraw);
    const pma = Math.max(0.001, marketProbAway);
    klDivergence = (pH > 0 ? pH * Math.log(pH / pmh) : 0) +
                   (pD > 0 ? pD * Math.log(pD / pmd) : 0) +
                   (pA > 0 ? pA * Math.log(pA / pma) : 0);
  }

  // ─── Model Agreement Signal (4 sources: ELO, Poisson, Market, xG) ───
  const argmax = (h: number, d: number, a: number): 'H' | 'D' | 'A' =>
    h >= d && h >= a ? 'H' : a >= d ? 'A' : 'D';
  const eloArgmax = argmax(eloProb.home, eloProb.draw, eloProb.away);
  const poissonArgmax = argmax(poisson.homeWin, poisson.draw, poisson.awayWin);
  const marketArgmax = hasMarket ? argmax(marketProbHome, marketProbDraw, marketProbAway) : null;

  // xG-based directional signal: which team does xG favour?
  const xgArgmax: 'H' | 'D' | 'A' | null = (() => {
    const hxg = insights?.xg?.home ?? null;
    const axg = insights?.xg?.away ?? null;
    if (hxg == null || axg == null) return null;
    const diff = hxg - axg;
    if (Math.abs(diff) < 0.15) return 'D'; // xG too close → draw signal
    return diff > 0 ? 'H' : 'A';
  })();

  // Count how many of the available signals agree with the statistical argmax
  const statArgmax = argmax(statHome, statDraw, statAway);
  const signals = [eloArgmax, poissonArgmax, marketArgmax, xgArgmax].filter((s): s is 'H' | 'D' | 'A' => s != null);
  const agreeCount = signals.filter(s => s === statArgmax).length;
  const totalSignals = signals.length;
  const agreementRatio = totalSignals > 1 ? (agreeCount - 1) / (totalSignals - 1) : 0.5;
  const agreementBonus = (agreementRatio - 0.5) * 0.24 * (totalSignals / 4.0);

  // League strength modifies confidence: weaker leagues → less predictable
  const leagueConfidenceMod = 0.85 + 0.15 * leagueStrength; // 0.925 for avg, 1.03 for elite

  // Combined confidence score
  const samplePenalty = Math.exp(-0.4 * N_matches);
  const confidenceScore = Math.max(0, Math.min(100,
    (1.0 - normalizedEntropy - 0.22 * klDivergence - 0.12 * samplePenalty + agreementBonus) * 100 * leagueConfidenceMod
  ));
  const confidence = confidenceTierFromScore(confidenceScore);

  // ─────────────── 8. Probability Calibration ───────────────
  // Use calibrationStore (data-driven) when we have enough historical data.
  // Fall back to a neutral logistic transform (identity-like) when we don't.
  const calibrationStore = useCalibrationStore.getState();
  const calibrationSamples = calibrationStore.groups.ALL.reduce((s, b) => s + b.n, 0);
  const HAS_CALIBRATION_DATA = calibrationSamples >= 30; // need ≥30 settled bets for stable calibration

  const calibrateProb = (p: number, market: string): number => {
    if (p <= 0 || p >= 100) return p;
    if (HAS_CALIBRATION_DATA) {
      // Data-driven calibration from historical prediction outcomes
      return calibrationStore.calibrate(p, market);
    }
    // Logistic fallback: slight sharpening for favorites, slight flattening for underdogs
    // This is intentionally near-identity — better to be uncalibrated than wrongly calibrated
    const val = p / 100;
    const logit = 1.02 * Math.log(val / (1.0 - val)); // near-identity logistic
    const calibrated = 1.0 / (1.0 + Math.exp(-logit));
    return Math.max(1, Math.min(99, calibrated * 100));
  };

  const candidates: Array<{ market: PredictionResult['topPick']['market']; selection: string; probability: number }> = [
    { market: 'WIN', selection: `${fixture.teams.home.name} to Win`, probability: homeWinPct },
    { market: 'WIN', selection: `${fixture.teams.away.name} to Win`, probability: awayWinPct },
    { market: 'DRAW', selection: 'Draw', probability: drawPct },
    { market: 'BTTS', selection: 'Both Teams to Score', probability: bttsPct },
    { market: 'OVER_2_5', selection: 'Over 2.5 Goals', probability: over25Pct },
    { market: 'UNDER_2_5', selection: 'Under 2.5 Goals', probability: under25Pct },
  ];

  // Pick candidate above 65% recommendations limit
  const recommendedCandidates = candidates.filter(c => c.probability >= 65);
  const bestCandidate = recommendedCandidates.length > 0
    ? recommendedCandidates.sort((a, b) => b.probability - a.probability)[0]
    : candidates.sort((a, b) => b.probability - a.probability)[0];

  const calibratedTopProb = clampPercent(calibrateProb(bestCandidate.probability, bestCandidate.market));
  const topPick = { ...bestCandidate, probability: calibratedTopProb, odds: Number(formatOdds(calibratedTopProb)) };

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

  const predictedScore = getConsistentPredictedScore(topPick.market, topPick.selection, fixture.teams.home.name, correctScoresList);

  // Logs tracing specific improvements made
  if (injuries?.home?.length || injuries?.away?.length) {
    improvements.push("Dynamic positional injury vectors applied to target lambdas");
  }
  if (w_xG > 0.3) {
    improvements.push(`Bayesian goal parameters shrunk over sample size of ${N_matches} matches`);
  }
  if (hasMarket) {
    improvements.push(`Weighted bookmaker devigged distributions dynamically scaled by overround efficiency`);
  }
  if (oddsMovement?.current) {
    improvements.push("Factored log odds movement drift signals into probabilities");
  }
  if (improvements.length === 0) {
    improvements.push("Predictive engine calibrated using Dixon-Coles goal environment model");
  }

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
      homeElo: Math.round(homeElo),
      awayElo: Math.round(awayElo),
      homeForm: homeForm.weightedFormScore,
      awayForm: awayForm.weightedFormScore,
      homeXg: Number(homeXgObserved.toFixed(2)),
      awayXg: Number(awayXgObserved.toFixed(2)),
      homeAdvantage: Number(leagueHomeAdv.toFixed(2)),
    },
    computedAt: Date.now(),
    correctScores: correctScoresList.slice(0, 10),
    doubleChance,
    overUnderLines,
    expectedGoals: {
      home: Number(lambdaHome.toFixed(2)),
      away: Number(lambdaAway.toFixed(2)),
      total: Number((lambdaHome + lambdaAway).toFixed(2)),
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
    source: book || insights?.predictions ? 'HYBRID' : 'BORO_AI',
    dataSignals: (insights?.predictions ? 1 : 0) + (book ? 1 : 0) + 1,
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
    return quickPredict(fixture, insights);
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
  const dataSignals = signals.length;
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

export const quickPredict = (fixture: Fixture, insights?: MatchInsights | null): PredictionResult => {
  const book = insights?.bookmaker;
  const goals = insights?.goals;
  const league = getLeagueById(fixture.league.id);
  const profile = getLeagueProfile(fixture.league.id, league?.isInternational);

  // ─── Strategy 1: Use market odds if available (best quick source) ───
  if (book?.fulltimeResult) {
    const [mh, md, ma] = norm3(
      book.fulltimeResult.home, book.fulltimeResult.draw, book.fulltimeResult.away
    );
    const homeWinPct = clampPercent(mh * 100);
    const drawPct = clampPercent(md * 100);
    const awayWinPct = clampPercent(ma * 100);

    // Use goal model if available, else estimate from odds-implied probabilities
    const lambdaHome = goals?.lambdaHome ?? Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, LEAGUE_AVG_HOME_GOALS * profile.goalEnv + profile.homeAdv));
    const lambdaAway = goals?.lambdaAway ?? Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, LEAGUE_AVG_AWAY_GOALS * profile.goalEnv));
    const poisson = computeMatchProbabilities(lambdaHome, lambdaAway, computeDynamicRho(profile));

    const bttsPct = book.btts ? clampPercent(book.btts.yes * 100) : clampPercent(poisson.btts * 100);
    const over25Pct = book.overUnder25 ? clampPercent(book.overUnder25.over * 100) : clampPercent(poisson.over25 * 100);
    const under25Pct = clampPercent(100 - over25Pct);

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
      homeWinPct, drawPct, awayWinPct, predictedScore,
      bttsPct, over25Pct, under25Pct,
      confidence: 'MEDIUM',
      topPick: { ...top, odds: Number(formatOdds(top.probability)) },
      reasoning: ['Quick odds-based estimate — open match details for full AI analysis.'],
      metrics: {
        homeElo: BASE_ELO_VALUE, awayElo: BASE_ELO_VALUE,
        homeForm: 0.5, awayForm: 0.5,
        homeXg: Number(lambdaHome.toFixed(2)), awayXg: Number(lambdaAway.toFixed(2)),
        homeAdvantage: profile.homeAdv,
      },
      computedAt: Date.now(),
      correctScores: correctScoresList.slice(0, 10),
      bestOdds: book.bestOdds,
      marketOverround: book.overround ?? null,
      source: 'HYBRID',
      dataSignals: 1,
    };
  }

  // ─── Strategy 2: Use league goal environment (no market data) ───
  const lambdaHome = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA,
    LEAGUE_AVG_HOME_GOALS * profile.goalEnv + profile.homeAdv
  ));
  const lambdaAway = Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA,
    LEAGUE_AVG_AWAY_GOALS * profile.goalEnv
  ));

  const rho = computeDynamicRho(profile);
  const poisson = computeMatchProbabilities(lambdaHome, lambdaAway, rho);
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
    homeWinPct, drawPct, awayWinPct, predictedScore,
    bttsPct, over25Pct, under25Pct,
    confidence: 'LOW',
    topPick: { ...top, odds: Number(formatOdds(top.probability)) },
    reasoning: ['League-environment estimate — open match details for full AI analysis.'],
    metrics: {
      homeElo: BASE_ELO_VALUE, awayElo: BASE_ELO_VALUE,
      homeForm: 0.5, awayForm: 0.5,
      homeXg: Number(lambdaHome.toFixed(2)), awayXg: Number(lambdaAway.toFixed(2)),
      homeAdvantage: profile.homeAdv,
    },
    computedAt: Date.now(),
    correctScores: correctScoresList.slice(0, 10),
  };
};
