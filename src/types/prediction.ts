export type ConfidenceTier = 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

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
    market: 'WIN' | 'DRAW' | 'BTTS' | 'OVER_2_5' | 'UNDER_2_5';
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
  results: Array<'W' | 'D' | 'L'>;
}
