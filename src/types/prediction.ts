export type ConfidenceTier = "ELITE" | "HIGH" | "MEDIUM" | "LOW";

export interface ValueBetInfo {
  market: string;
  selection: string;
  modelProb: number;
  fairOdds: number;
  bestOdds: number;
  edge: number; // ROI as a fraction
}

export interface PredictionResult {
  fixtureId: number;
  homeWinPct: number; // 0-100
  drawPct: number;
  awayWinPct: number;
  predictedScore: { home: number; away: number };
  bttsPct: number; // both-teams-to-score
  over25Pct: number;
  under25Pct: number;
  confidence: ConfidenceTier;
  topPick: {
    market:
      | "WIN"
      | "DRAW"
      | "BTTS"
      | "OVER_0_5"
      | "UNDER_0_5"
      | "OVER_1_5"
      | "UNDER_1_5"
      | "OVER_2_5"
      | "UNDER_2_5"
      | "OVER_3_5"
      | "UNDER_3_5"
      | "OVER_4_5"
      | "UNDER_4_5"
      | "DC_1X"
      | "DC_X2"
      | "DC_12";
    selection: string; // e.g. "Arsenal to Win"
    probability: number; // 0-100
    odds: number;
  };
  reasoning: string[];
  metrics: {
    homeElo: number;
    awayElo: number;
    homeForm: number; // 0-1
    awayForm: number;
    homeXg: number;
    awayXg: number;
    homeAdvantage: number;
  };
  computedAt: number;

  // Sportmonks Pro Predictions (Optional/Extended markets)
  correctScores?: Array<{ score: string; probability: number }>;
  doubleChance?: { homeDraw: number; awayDraw: number; homeAway: number };
  halfTimeResult?: { home: number; draw: number; away: number };
  teamToScoreFirst?: { home: number; away: number; draw: number };
  cornersOverUnder?: Array<{ label: string; probability: number }>;
  overUnderGoals?: Array<{ label: string; probability: number }>;
  source?: "BORO_AI" | "SPORTMONKS_PRO" | "HYBRID";

  // ── Real-data extensions ──
  /** Per-line over/under probabilities, keyed by line ("1.5","2.5","3.5"...). */
  overUnderLines?: Record<string, { over: number; under: number }>;
  /** Expected goals per team (real xG when available, else model λ). */
  expectedGoals?: { home: number; away: number; total: number };
  /** Devigged fair 1X2 probabilities implied by bookmaker odds. */
  marketProbabilities?: { home: number; draw: number; away: number };
  /** Best available decimal odds across bookmakers (line-shopped). */
  bestOdds?: {
    home?: number;
    draw?: number;
    away?: number;
    over25?: number;
    under25?: number;
    bttsYes?: number;
    bttsNo?: number;
  };
  /** Positive expected-value bets detected vs the market. */
  valueBets?: ValueBetInfo[];
  /** Bookmaker market efficiency (overround, lower = sharper). */
  marketOverround?: number | null;
  /** How many independent signals backed this prediction (model/pred/odds). */
  dataSignals?: number;
}

export interface TeamFormSnapshot {
  teamId: number;
  matchesAnalyzed: number;
  weightedFormScore: number; // 0-1
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  winStreak: number;
  homeRecord: { played: number; won: number; drawn: number; lost: number };
  awayRecord: { played: number; won: number; drawn: number; lost: number };
  results: Array<"W" | "D" | "L">;
}
