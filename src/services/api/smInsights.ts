/**
 * Real-data match insights from SportMonks.
 *
 * Pulls EVERYTHING the model needs for one fixture in as few calls as possible:
 *   - SportMonks model predictions (29 markets: 1X2, O/U lines, BTTS, DC,
 *     correct score, HT/FT, team-to-score-first, corners, valuebet)
 *   - Pre-match bookmaker odds â†’ devigged fair probabilities (1X2, O/U2.5, BTTS, DC)
 *   - Expected goals (xG) when available
 *
 * Because our internal fixture IDs ARE SportMonks fixture IDs (fixtures are
 * mapped 1:1 from SportMonks), we fetch by ID directly â€” far more accurate than
 * the legacy fuzzy date/name matching.
 */
import { smGet, smGetAll, smGetAllByLeagues, TTL } from "./smClient";
import { PRED, MARKET } from "./smTypes";
import {
  devigShin,
  devigProportional,
  valueEdge,
  goalsModel,
} from "@/services/ai/marketMath";
import { LEAGUE_TO_SPORTMONKS } from "@/constants/leagues";
import {
  fetchFixtureGoalRates,
  fetchTeamRatesMap,
  type TeamGoalRates,
} from "./smGoals";
import { inMatchWindow, MATCH_WINDOW_FUTURE_MS } from "@/utils/date";
import type { Fixture } from "@/types/match";
import { mapSportmonksFixture } from "./sportmonks";

// League-average goals per game (home/away) used for shrinkage of small samples.
const LG_HOME = 1.5;
const LG_AWAY = 1.15;
const SHRINK_K = 5; // pseudo-matches pulling rates toward the league mean

/** Empirical-Bayes shrink of a per-game rate toward a prior. */
const shrinkRate = (
  obs: number | null,
  n: number | null,
  prior: number,
): number => {
  if (obs == null || !Number.isFinite(obs)) return prior;
  const games = n ?? 0;
  return (games * obs + SHRINK_K * prior) / (games + SHRINK_K);
};

/**
 * Build the Dixon-Coles goals model (Over/Under ladder + BTTS + expected total)
 * from two teams' REAL season scoring rates. Shared by every fetcher so the
 * match page, home cards and Results screen all derive the IDENTICAL goals
 * prediction — one pick everywhere. Returns null if either team's rates are
 * missing (the predictor then leans on provider/market goals signals).
 */
const buildGoalsModel = (
  hr: TeamGoalRates | null,
  ar: TeamGoalRates | null,
): MatchInsights["goals"] => {
  if (!hr || !ar) return null;
  // Prefer venue-specific rates, but fall back to overall when a split is empty
  // (e.g. a team that hasn't played at home yet this season).
  const pick = (split: number | null, all: number | null): number | null =>
    split != null && split > 0 ? split : all;
  const homeScored = shrinkRate(
    pick(hr.scoredHome, hr.scoredAll),
    hr.matchesPlayed,
    LG_HOME,
  );
  const awayConceded = shrinkRate(
    pick(ar.concededAway, ar.concededAll),
    ar.matchesPlayed,
    LG_HOME,
  );
  const awayScored = shrinkRate(
    pick(ar.scoredAway, ar.scoredAll),
    ar.matchesPlayed,
    LG_AWAY,
  );
  const homeConceded = shrinkRate(
    pick(hr.concededHome, hr.concededAll),
    hr.matchesPlayed,
    LG_AWAY,
  );

  // Expected goals = blend of (team's scoring) and (opponent's conceding),
  // scaled so league-average teams reproduce league-average goals.
  const lambdaHome = Math.max(
    0.2,
    Math.min(4, (homeScored + awayConceded) / 2),
  );
  const lambdaAway = Math.max(
    0.2,
    Math.min(4, (awayScored + homeConceded) / 2),
  );
  const gm = goalsModel(lambdaHome, lambdaAway);
  return {
    over: gm.over,
    bttsYes: gm.bttsYes,
    expectedTotal: gm.expectedTotal,
    lambdaHome: gm.lambdaHome,
    lambdaAway: gm.lambdaAway,
  };
};

export interface OneXTwo {
  home: number;
  draw: number;
  away: number;
}

export interface MarketProbabilities {
  fulltimeResult?: OneXTwo;
  firstHalfResult?: OneXTwo;
  doubleChance?: { homeDraw: number; awayDraw: number; homeAway: number };
  btts?: { yes: number; no: number };
  overUnder?: Record<string, { over: number; under: number }>; // keyed "2.5" etc.
  homeOverUnder?: Record<string, { over: number; under: number }>;
  awayOverUnder?: Record<string, { over: number; under: number }>;
  teamToScoreFirst?: { home: number; away: number; none: number };
  htft?: Array<{ label: string; probability: number }>;
  correctScores?: Array<{ score: string; probability: number }>;
  corners?: Array<{ label: string; probability: number }>;
}

export interface BookmakerProbabilities {
  fulltimeResult?: OneXTwo; // devigged, fair
  overUnder25?: { over: number; under: number };
  btts?: { yes: number; no: number };
  doubleChance?: { homeDraw: number; awayDraw: number; homeAway: number };
  bestOdds: {
    home?: number;
    draw?: number;
    away?: number;
    over25?: number;
    under25?: number;
    bttsYes?: number;
    bttsNo?: number;
  };
  overround: number | null; // market efficiency indicator
  bookmakerCount: number;
}

export interface ValueBet {
  market: string;
  selection: string;
  modelProb: number; // 0-100
  fairOdds: number;
  bestOdds: number;
  edge: number; // 0-1 ROI
}

export interface ModelGoals {
  over: Record<string, number>; // 0-1 P(over) by line "1.5","2.5","3.5"
  bttsYes: number; // 0-1
  expectedTotal: number;
  lambdaHome: number;
  lambdaAway: number;
}

export interface MatchInsights {
  fixtureId: number;
  predictions: MarketProbabilities | null;
  bookmaker: BookmakerProbabilities | null;
  xg: { home: number; away: number } | null;
  /** Dixon-Coles goals model from real season scoring rates (Over/Under, BTTS). */
  goals: ModelGoals | null;
  hasRealData: boolean;
}

const num = (v: any): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Parse the SportMonks predictions array into structured market probabilities. */
const parsePredictions = (predictions: any[]): MarketProbabilities | null => {
  if (!Array.isArray(predictions) || predictions.length === 0) return null;
  const out: MarketProbabilities = {};
  const overUnder: Record<string, { over: number; under: number }> = {};
  const homeOU: Record<string, { over: number; under: number }> = {};
  const awayOU: Record<string, { over: number; under: number }> = {};
  const corners: Array<{ label: string; probability: number }> = [];

  for (const p of predictions) {
    const dev: string = p?.type?.developer_name || "";
    const d = p?.predictions || {};

    switch (dev) {
      case PRED.FULLTIME_RESULT:
        out.fulltimeResult = {
          home: d.home ?? 0,
          draw: d.draw ?? 0,
          away: d.away ?? 0,
        };
        break;
      case PRED.FIRST_HALF_WINNER:
        out.firstHalfResult = {
          home: d.home ?? 0,
          draw: d.draw ?? 0,
          away: d.away ?? 0,
        };
        break;
      case PRED.BTTS:
        out.btts = { yes: d.yes ?? 0, no: d.no ?? 0 };
        break;
      case PRED.DOUBLE_CHANCE:
        out.doubleChance = {
          homeDraw: d.draw_home ?? 0,
          awayDraw: d.draw_away ?? 0,
          homeAway: d.home_away ?? 0,
        };
        break;
      case PRED.TEAM_TO_SCORE_FIRST:
        out.teamToScoreFirst = {
          home: d.home ?? 0,
          away: d.away ?? 0,
          none: d.draw ?? d.no_goals ?? 0,
        };
        break;
      case PRED.OVER_UNDER_05:
        overUnder["0.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.OVER_UNDER_15:
        overUnder["1.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.OVER_UNDER_25:
        overUnder["2.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.OVER_UNDER_35:
        overUnder["3.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.OVER_UNDER_45:
        overUnder["4.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.HOME_OVER_UNDER_05:
        homeOU["0.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.HOME_OVER_UNDER_15:
        homeOU["1.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.HOME_OVER_UNDER_25:
        homeOU["2.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.HOME_OVER_UNDER_35:
        homeOU["3.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.AWAY_OVER_UNDER_05:
        awayOU["0.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.AWAY_OVER_UNDER_15:
        awayOU["1.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.AWAY_OVER_UNDER_25:
        awayOU["2.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.AWAY_OVER_UNDER_35:
        awayOU["3.5"] = { over: d.yes ?? 0, under: d.no ?? 0 };
        break;
      case PRED.HTFT:
        if (d && typeof d === "object") {
          out.htft = Object.entries(d)
            .filter(([, v]) => typeof v === "number")
            .map(([label, v]) => ({ label, probability: v as number }))
            .sort((a, b) => b.probability - a.probability);
        }
        break;
      case PRED.CORRECT_SCORE:
        if (d.scores && typeof d.scores === "object") {
          out.correctScores = Object.entries(d.scores)
            .filter(([, v]) => typeof v === "number")
            .map(([score, v]) => ({
              score: score.replace(":", "-"),
              probability: v as number,
            }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 12);
        }
        break;
      case PRED.CORNERS_OU_8:
        if (num(d.yes) !== undefined)
          corners.push({ label: "Over 8.5", probability: d.yes });
        break;
      case PRED.CORNERS_OU_9:
        if (num(d.yes) !== undefined)
          corners.push({ label: "Over 9.5", probability: d.yes });
        break;
      case PRED.CORNERS_OU_10:
        if (num(d.yes) !== undefined)
          corners.push({ label: "Over 10.5", probability: d.yes });
        break;
      case PRED.CORNERS_OU_11:
        if (num(d.yes) !== undefined)
          corners.push({ label: "Over 11.5", probability: d.yes });
        break;
      default:
        break;
    }
  }

  if (Object.keys(overUnder).length) out.overUnder = overUnder;
  if (Object.keys(homeOU).length) out.homeOverUnder = homeOU;
  if (Object.keys(awayOU).length) out.awayOverUnder = awayOU;
  if (corners.length)
    out.corners = corners.sort(
      (a, b) =>
        parseFloat(a.label.split(" ")[1]) - parseFloat(b.label.split(" ")[1]),
    );

  return Object.keys(out).length ? out : null;
};

/**
 * Parse pre-match odds rows into devigged fair probabilities + best available
 * odds across all bookmakers (line shopping).
 */
const parseOdds = (odds: any[]): BookmakerProbabilities | null => {
  if (!Array.isArray(odds) || odds.length === 0) return null;

  const bookmakerIds = new Set<number>();
  // For 1X2 we collect per-bookmaker triplets to devig each book then average.
  const ftByBook: Record<
    number,
    { home?: number; draw?: number; away?: number }
  > = {};
  const best = {
    home: 0,
    draw: 0,
    away: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0,
  };
  let ouOver = 0,
    ouUnder = 0,
    bttsYes = 0,
    bttsNo = 0;

  const normLabel = (s: string) => (s || "").toLowerCase().trim();

  for (const o of odds) {
    const marketId = o.market_id;
    const bookId = o.bookmaker_id;
    const label = normLabel(o.label);
    const value = parseFloat(o.value);
    if (!Number.isFinite(value) || value <= 1) continue;
    // Skip suspended/closed lines â€” they go stale and produce phantom "value".
    if (o.stopped === true || o.suspended === true) continue;
    bookmakerIds.add(bookId);

    if (marketId === MARKET.FULLTIME_RESULT) {
      ftByBook[bookId] = ftByBook[bookId] || {};
      if (label === "home" || label === "1") ftByBook[bookId].home = value;
      else if (label === "draw" || label === "x") ftByBook[bookId].draw = value;
      else if (label === "away" || label === "2") ftByBook[bookId].away = value;
      if (label === "home" || label === "1")
        best.home = Math.max(best.home, value);
      if (label === "draw" || label === "x")
        best.draw = Math.max(best.draw, value);
      if (label === "away" || label === "2")
        best.away = Math.max(best.away, value);
    } else if (marketId === MARKET.OVER_UNDER) {
      // The line lives in `total` (e.g. "2.5"); `value` is the decimal odd.
      const line = String(o.total ?? "").trim();
      if (line === "2.5") {
        if (label.includes("over")) {
          best.over25 = Math.max(best.over25, value);
          ouOver = ouOver || value;
        } else if (label.includes("under")) {
          best.under25 = Math.max(best.under25, value);
          ouUnder = ouUnder || value;
        }
      }
    } else if (marketId === MARKET.BTTS) {
      if (label.includes("yes")) {
        best.bttsYes = Math.max(best.bttsYes, value);
        bttsYes = bttsYes || value;
      } else if (label.includes("no")) {
        best.bttsNo = Math.max(best.bttsNo, value);
        bttsNo = bttsNo || value;
      }
    }
  }

  // Devig 1X2 per bookmaker, then average the fair probabilities.
  const fairTriplets: OneXTwo[] = [];
  let sampleOverround: number | null = null;
  for (const bookId of Object.keys(ftByBook)) {
    const t = ftByBook[Number(bookId)];
    if (t.home && t.draw && t.away) {
      const fair = devigShin([t.home, t.draw, t.away]);
      fairTriplets.push({ home: fair[0], draw: fair[1], away: fair[2] });
      if (sampleOverround === null) {
        sampleOverround = 1 / t.home + 1 / t.draw + 1 / t.away;
      }
    }
  }

  let fulltimeResult: OneXTwo | undefined;
  if (fairTriplets.length) {
    fulltimeResult = {
      home: fairTriplets.reduce((s, f) => s + f.home, 0) / fairTriplets.length,
      draw: fairTriplets.reduce((s, f) => s + f.draw, 0) / fairTriplets.length,
      away: fairTriplets.reduce((s, f) => s + f.away, 0) / fairTriplets.length,
    };
  }

  let overUnder25: { over: number; under: number } | undefined;
  if (ouOver && ouUnder) {
    const fair = devigProportional([ouOver, ouUnder]);
    overUnder25 = { over: fair[0], under: fair[1] };
  }
  let btts: { yes: number; no: number } | undefined;
  if (bttsYes && bttsNo) {
    const fair = devigProportional([bttsYes, bttsNo]);
    btts = { yes: fair[0], no: fair[1] };
  }

  if (!fulltimeResult && !overUnder25 && !btts) return null;

  return {
    fulltimeResult,
    overUnder25,
    btts,
    bestOdds: {
      home: best.home || undefined,
      draw: best.draw || undefined,
      away: best.away || undefined,
      over25: best.over25 || undefined,
      under25: best.under25 || undefined,
      bttsYes: best.bttsYes || undefined,
      bttsNo: best.bttsNo || undefined,
    },
    overround: sampleOverround,
    bookmakerCount: bookmakerIds.size,
  };
};

/**
 * Fetch all real insights for a fixture in a single rich-include request.
 *
 * Note on xG: the active plan does not expose clean per-team Expected Goals
 * (type 5304) on fixtures, so we deliberately do NOT fabricate an xG figure
 * here. The predictor falls back to its model-derived Î» as the goal estimate,
 * clearly labeled as such in the UI.
 */
export const fetchMatchInsights = async (
  fixtureId: number,
  homeId: number,
  awayId: number,
): Promise<MatchInsights> => {
  try {
    const include = "predictions.type;odds";
    const [data, goalRates] = await Promise.all([
      smGet(`/fixtures/${fixtureId}`, {
        params: { include },
        ttl: TTL.predictions,
      }),
      fetchFixtureGoalRates(homeId, awayId).catch(() => null),
    ]);

    const predictions = parsePredictions(data?.predictions || []);
    const bookmaker = parseOdds(data?.odds || []);

    // Build a Dixon-Coles goals model from REAL season scoring rates.
    const goals = buildGoalsModel(
      goalRates?.home ?? null,
      goalRates?.away ?? null,
    );

    return {
      fixtureId,
      predictions,
      bookmaker,
      xg: goals ? { home: goals.lambdaHome, away: goals.lambdaAway } : null,
      goals,
      hasRealData: Boolean(predictions || bookmaker || goals),
    };
  } catch (err: any) {
    console.warn(
      `[smInsights] fixture ${fixtureId} insights failed:`,
      err?.message,
    );
    return {
      fixtureId,
      predictions: null,
      bookmaker: null,
      xg: null,
      goals: null,
      hasRealData: false,
    };
  }
};

/**
 * Compute value bets by comparing model probabilities against best available
 * (line-shopped) bookmaker odds.
 */
export const computeValueBets = (
  modelProbs: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
  },
  best: BookmakerProbabilities["bestOdds"],
  minEdge = 0.03,
): ValueBet[] => {
  const out: ValueBet[] = [];
  const consider = (
    market: string,
    selection: string,
    prob100: number,
    odds?: number,
  ) => {
    if (!odds || odds <= 1) return;
    const p = prob100 / 100;
    const edge = valueEdge(p, odds);
    // Accept only realistic edges. A huge "edge" almost always means a stale or
    // mispriced (suspended) line rather than genuine value, so we cap it out.
    if (edge >= minEdge && edge <= 0.35) {
      out.push({
        market,
        selection,
        modelProb: prob100,
        fairOdds: p > 0 ? 1 / p : 0,
        bestOdds: odds,
        edge,
      });
    }
  };
  consider("1X2", "Home", modelProbs.home, best.home);
  consider("1X2", "Draw", modelProbs.draw, best.draw);
  consider("1X2", "Away", modelProbs.away, best.away);
  consider("O/U 2.5", "Over 2.5", modelProbs.over25, best.over25);
  consider("O/U 2.5", "Under 2.5", modelProbs.under25, best.under25);
  consider("BTTS", "Yes", modelProbs.bttsYes, best.bttsYes);
  consider("BTTS", "No", modelProbs.bttsNo, best.bttsNo);
  return out.sort((a, b) => b.edge - a.edge);
};

export interface DiscoveryValuePick {
  fixtureId: number;
  homeName: string;
  awayName: string;
  leagueName: string;
  market: string;
  selection: string;
  modelProb: number; // provider/devigged probability 0-100
  bestOdds: number;
  edge: number; // 0-1
}

/**
 * Batched discovery: fetch a date's fixtures across the given leagues WITH
 * provider predictions + odds inline, then surface the strongest real value
 * bets (provider/devigged probability vs best line-shopped odds).
 *
 * One request per call (paginated), so it is cheap even across many leagues.
 */
export const fetchValuePicksForDate = async (
  date: string,
  internalLeagueIds: number[],
  minEdge = 0.05,
  limit = 6,
): Promise<DiscoveryValuePick[]> => {
  const smLeagueIds = internalLeagueIds
    .map((id) => LEAGUE_TO_SPORTMONKS[id])
    .filter((id): id is number => typeof id === "number");
  if (smLeagueIds.length === 0) return [];

  // Scan a forward window so value bets appear even when today is empty.
  const cleanDate = date.split("T")[0];
  const start = new Date(cleanDate + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 3);
  const toIso = end.toISOString().split("T")[0];

  const rows = await smGetAllByLeagues(
    `/fixtures/between/${cleanDate}/${toIso}`,
    smLeagueIds,
    {
      params: {
        include: "participants;league;predictions.type;odds",
      },
      ttl: TTL.odds,
      maxPages: 8,
    },
  );
  const picks: DiscoveryValuePick[] = [];
  for (const f of rows) {
    const participants = f.participants || [];
    const home = participants.find((p: any) => p.meta?.location === "home");
    const away = participants.find((p: any) => p.meta?.location === "away");
    if (!home || !away) continue;

    const predictions = parsePredictions(f.predictions || []);
    const bookmaker = parseOdds(f.odds || []);
    if (!bookmaker?.bestOdds) continue;

    // Prefer provider 1X2 probabilities; fall back to devigged market probs.
    const ft = predictions?.fulltimeResult
      ? predictions.fulltimeResult
      : bookmaker.fulltimeResult
        ? {
            home: bookmaker.fulltimeResult.home * 100,
            draw: bookmaker.fulltimeResult.draw * 100,
            away: bookmaker.fulltimeResult.away * 100,
          }
        : null;
    if (!ft) continue;

    const overP =
      predictions?.overUnder?.["2.5"]?.over ??
      (bookmaker.overUnder25 ? bookmaker.overUnder25.over * 100 : 0);
    const underP =
      predictions?.overUnder?.["2.5"]?.under ??
      (bookmaker.overUnder25 ? bookmaker.overUnder25.under * 100 : 0);
    const bttsYes =
      predictions?.btts?.yes ?? (bookmaker.btts ? bookmaker.btts.yes * 100 : 0);

    const vbs = computeValueBets(
      {
        home: ft.home,
        draw: ft.draw,
        away: ft.away,
        over25: overP,
        under25: underP,
        bttsYes,
        bttsNo: bttsYes ? 100 - bttsYes : 0,
      },
      bookmaker.bestOdds,
      minEdge,
    );

    for (const v of vbs) {
      let selection = v.selection;
      if (v.market === "1X2")
        selection =
          v.selection === "Home"
            ? home.name
            : v.selection === "Away"
              ? away.name
              : "Draw";
      else if (v.market === "BTTS")
        selection = v.selection === "Yes" ? "Both Teams to Score" : "No BTTS";
      picks.push({
        fixtureId: f.id,
        homeName: home.name,
        awayName: away.name,
        leagueName: f.league?.name || "League",
        market: v.market,
        selection,
        modelProb: v.modelProb,
        bestOdds: v.bestOdds,
        edge: v.edge,
      });
    }
  }

  return picks.sort((a, b) => b.edge - a.edge).slice(0, limit);
};

export interface RawFixtureInsights {
  fixture: Fixture;
  insights: MatchInsights;
}

/**
 * Attach the Dixon-Coles season-goals model to a batch of fixtures so the
 * cards/Results screen produce the IDENTICAL Over/Under + BTTS pick the match
 * page does. Team goal rates are fetched once per team (cached 30 min, deduped)
 * and reused across every fixture that team appears in. Mutates each row's
 * `insights.goals` (and `xg`) in place.
 */
const attachGoalsModels = async (
  rows: RawFixtureInsights[],
  maxRows = rows.length,
): Promise<void> => {
  const targetRows = rows.slice(0, maxRows);
  if (targetRows.length === 0) return;
  const teamIds: number[] = [];
  targetRows.forEach((r) => {
    teamIds.push(r.fixture.teams.home.id, r.fixture.teams.away.id);
  });
  const rates = await fetchTeamRatesMap(teamIds).catch(
    () => new Map<number, TeamGoalRates | null>(),
  );
  for (const r of targetRows) {
    const goals = buildGoalsModel(
      rates.get(r.fixture.teams.home.id) ?? null,
      rates.get(r.fixture.teams.away.id) ?? null,
    );
    r.insights.goals = goals;
    if (goals)
      r.insights.xg = { home: goals.lambdaHome, away: goals.lambdaAway };
    r.insights.hasRealData = Boolean(
      r.insights.predictions || r.insights.bookmaker || goals,
    );
  }
};

/**
 * Batched real insights for an entire date across the given leagues.
 *
 * ONE paginated request pulls every fixture for the date WITH provider
 * predictions + bookmaker odds inline, so the list/cards can show genuine
 * (not random) probabilities without N separate calls.
 *
 * When `date` has no fixtures, it looks ahead up to `lookaheadDays` and uses
 * the next day that actually has matches (keeps the app populated off-season).
 */
export const fetchTodayInsights = async (
  date: string,
  internalLeagueIds: number[],
  lookaheadDays = 7,
): Promise<RawFixtureInsights[]> => {
  const smLeagueIds = internalLeagueIds
    .map((id) => LEAGUE_TO_SPORTMONKS[id])
    .filter((id): id is number => typeof id === "number");
  if (smLeagueIds.length === 0) return [];

  const fetchForRange = async (from: string, to: string) =>
    smGetAllByLeagues(`/fixtures/between/${from}/${to}`, smLeagueIds, {
      params: {
        include: "participants;league;state;scores;predictions.type;odds",
      },
      ttl: TTL.fixturesToday,
      maxPages: 5,
    });

  const cleanDate = date.split("T")[0];
  // Start the query ONE day before the requested date (in UTC) so late-night
  // local kickoffs that fall in the previous UTC date bucket are still fetched.
  const startBound = new Date(cleanDate + "T00:00:00Z");
  startBound.setUTCDate(startBound.getUTCDate() - 1);
  const fromIso = startBound.toISOString().split("T")[0];
  const end = new Date(cleanDate + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + lookaheadDays);
  const toIso = end.toISOString().split("T")[0];

  // Pull the whole window once.
  const rows = await fetchForRange(fromIso, toIso);

  // Primary path: everything in the rolling live+upcoming window (timezone-proof).
  const now = Date.now();
  const windowed = rows.filter((f) =>
    inMatchWindow(f.starting_at_timestamp ?? 0, now),
  );

  let dayRows: any[];
  if (windowed.length > 0) {
    dayRows = windowed;
  } else {
    // Off-season / empty window → fall back to the earliest UPCOMING day that
    // actually has fixtures, so the app is never blank.
    const future = rows
      .filter(
        (f) =>
          (f.starting_at_timestamp ?? 0) * 1000 >= now - MATCH_WINDOW_FUTURE_MS,
      )
      .sort(
        (a, b) =>
          (a.starting_at_timestamp ?? 0) - (b.starting_at_timestamp ?? 0),
      );
    const byDay = new Map<string, any[]>();
    future.forEach((f) => {
      const ts = (f.starting_at_timestamp ?? 0) * 1000;
      const day = ts > 0 ? new Date(ts).toISOString().split("T")[0] : cleanDate;
      const arr = byDay.get(day) ?? [];
      arr.push(f);
      byDay.set(day, arr);
    });
    const firstDay = [...byDay.keys()].sort()[0];
    dayRows = firstDay ? (byDay.get(firstDay) ?? []) : [];
  }

  const out: RawFixtureInsights[] = [];
  for (const f of dayRows) {
    const fixture = mapSportmonksFixture(f);
    const predictions = parsePredictions(f.predictions || []);
    const bookmaker = parseOdds(f.odds || []);
    out.push({
      fixture,
      insights: {
        fixtureId: f.id,
        predictions,
        bookmaker,
        xg: null,
        goals: null,
        hasRealData: Boolean(predictions || bookmaker),
      },
    });
  }
  const sorted = out.sort(
    (a, b) => a.fixture.fixture.timestamp - b.fixture.fixture.timestamp,
  );
  await attachGoalsModels(sorted, 60);
  return sorted;
};

/**
 * Recent FINISHED fixtures (last `days`) across the given leagues, each with the
 * provider predictions + bookmaker odds that existed for it â€” so the Results
 * screen can grade the exact prediction the app would have shown.
 */
export const fetchRecentResults = async (
  toDate: string,
  internalLeagueIds: number[],
  days = 4,
): Promise<RawFixtureInsights[]> => {
  const smLeagueIds = internalLeagueIds
    .map((id) => LEAGUE_TO_SPORTMONKS[id])
    .filter((id): id is number => typeof id === "number");
  if (smLeagueIds.length === 0) return [];

  const clean = toDate.split("T")[0];
  const end = new Date(clean + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const fromIso = start.toISOString().split("T")[0];

  const rows = await smGetAllByLeagues(
    `/fixtures/between/${fromIso}/${clean}`,
    smLeagueIds,
    {
      params: {
        include: "participants;league;state;scores;predictions.type;odds",
      },
      ttl: TTL.fixturesToday,
      maxPages: 5,
    },
  );

  const out: RawFixtureInsights[] = [];
  for (const f of rows) {
    const fixture = mapSportmonksFixture(f);
    // Only finished matches with a real score.
    const s = fixture.fixture.status.short;
    if (!["FT", "AET", "PEN", "AWD", "WO"].includes(s)) continue;
    if (fixture.goals.home === null || fixture.goals.away === null) continue;

    const predictions = parsePredictions(f.predictions || []);
    const bookmaker = parseOdds(f.odds || []);
    out.push({
      fixture,
      insights: {
        fixtureId: f.id,
        predictions,
        bookmaker,
        xg: null,
        goals: null,
        hasRealData: Boolean(predictions || bookmaker),
      },
    });
  }
  // Newest first. Only enrich the first page of rows with team-rate goal models;
  // provider predictions + odds still grade every row, while cold loads avoid
  // dozens/hundreds of extra team-stat requests.
  const sorted = out.sort(
    (a, b) => b.fixture.fixture.timestamp - a.fixture.fixture.timestamp,
  );
  await attachGoalsModels(sorted, 48);
  return sorted;
};

/**
 * Finished fixtures on ONE specific date (for the Results calendar picker),
 * each with the predictions/odds it had, so they can be graded.
 */
export const fetchResultsOnDate = async (
  date: string,
  internalLeagueIds: number[],
): Promise<RawFixtureInsights[]> => {
  const smLeagueIds = internalLeagueIds
    .map((id) => LEAGUE_TO_SPORTMONKS[id])
    .filter((id): id is number => typeof id === "number");
  if (smLeagueIds.length === 0) return [];

  const clean = date.split("T")[0];
  const rows = await smGetAllByLeagues(`/fixtures/date/${clean}`, smLeagueIds, {
    params: {
      include: "participants;league;state;scores;predictions.type;odds",
    },
    ttl: TTL.standings,
    maxPages: 5,
  });

  const out: RawFixtureInsights[] = [];
  for (const f of rows) {
    const fixture = mapSportmonksFixture(f);
    const s = fixture.fixture.status.short;
    if (!["FT", "AET", "PEN", "AWD", "WO"].includes(s)) continue;
    if (fixture.goals.home === null || fixture.goals.away === null) continue;
    const predictions = parsePredictions(f.predictions || []);
    const bookmaker = parseOdds(f.odds || []);
    out.push({
      fixture,
      insights: {
        fixtureId: f.id,
        predictions,
        bookmaker,
        xg: null,
        goals: null,
        hasRealData: Boolean(predictions || bookmaker),
      },
    });
  }
  const sorted = out.sort(
    (a, b) => b.fixture.fixture.timestamp - a.fixture.fixture.timestamp,
  );
  await attachGoalsModels(sorted, 48);
  return sorted;
};
