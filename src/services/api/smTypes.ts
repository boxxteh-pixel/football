/**
 * SportMonks v3 type-ID and identifier maps.
 *
 * SportMonks encodes statistics, predictions and odds markets as numeric
 * type/market IDs (and prediction `developer_name` strings). Centralizing them
 * here keeps the parsers readable and makes it obvious which real data points
 * the model consumes.
 *
 * IDs verified against the live API for the active plan.
 */

/** Statistic type IDs used on fixture `statistics` and `xGFixture`. */
export const STAT_TYPE = {
  SHOTS_TOTAL: 42,
  SHOTS_ON_TARGET: 86,
  SHOTS_OFF_TARGET: 41,
  SHOTS_INSIDE_BOX: 49,
  SHOTS_OUTSIDE_BOX: 50,
  SHOTS_BLOCKED: 58,
  CORNERS: 34,
  BALL_POSSESSION: 45,
  FOULS: 56,
  OFFSIDES: 51,
  YELLOW_CARDS: 84,
  RED_CARDS: 83,
  SAVES: 57,
  PASSES_TOTAL: 80,
  PASSES_ACCURATE: 81,
  PASSES_PERCENTAGE: 82,
  ATTACKS: 43,
  DANGEROUS_ATTACKS: 44,
  GOALS: 52,
  EXPECTED_GOALS: 5304, // xG (fixture statistics)
  XG_FIXTURE: 9676, // alt xG location depending on endpoint
} as const;

/**
 * Prediction `developer_name` keys returned by /predictions.
 * These are the model-grade probability markets SportMonks exposes.
 */
export const PRED = {
  FULLTIME_RESULT: 'FULLTIME_RESULT_PROBABILITY',
  FIRST_HALF_WINNER: 'FIRST_HALF_WINNER_PROBABILITY',
  BTTS: 'BTTS_PROBABILITY',
  OVER_UNDER_05: 'OVER_UNDER_0_5_PROBABILITY',
  OVER_UNDER_15: 'OVER_UNDER_1_5_PROBABILITY',
  OVER_UNDER_25: 'OVER_UNDER_2_5_PROBABILITY',
  OVER_UNDER_35: 'OVER_UNDER_3_5_PROBABILITY',
  OVER_UNDER_45: 'OVER_UNDER_4_5_PROBABILITY',
  HOME_OVER_UNDER_05: 'HOME_OVER_UNDER_0_5_PROBABILITY',
  HOME_OVER_UNDER_15: 'HOME_OVER_UNDER_1_5_PROBABILITY',
  HOME_OVER_UNDER_25: 'HOME_OVER_UNDER_2_5_PROBABILITY',
  HOME_OVER_UNDER_35: 'HOME_OVER_UNDER_3_5_PROBABILITY',
  AWAY_OVER_UNDER_05: 'AWAY_OVER_UNDER_0_5_PROBABILITY',
  AWAY_OVER_UNDER_15: 'AWAY_OVER_UNDER_1_5_PROBABILITY',
  AWAY_OVER_UNDER_25: 'AWAY_OVER_UNDER_2_5_PROBABILITY',
  AWAY_OVER_UNDER_35: 'AWAY_OVER_UNDER_3_5_PROBABILITY',
  CORRECT_SCORE: 'CORRECT_SCORE_PROBABILITY',
  DOUBLE_CHANCE: 'DOUBLE_CHANCE_PROBABILITY',
  HTFT: 'HTFT_PROBABILITY',
  TEAM_TO_SCORE_FIRST: 'TEAM_TO_SCORE_FIRST_PROBABILITY',
  VALUEBET: 'VALUEBET',
  CORNERS_OU_8: 'CORNERS_OVER_UNDER_8_PROBABILITY',
  CORNERS_OU_9: 'CORNERS_OVER_UNDER_9_PROBABILITY',
  CORNERS_OU_10: 'CORNERS_OVER_UNDER_10_PROBABILITY',
  CORNERS_OU_11: 'CORNERS_OVER_UNDER_11_PROBABILITY',
} as const;

/** Odds market IDs (from /odds/markets). */
export const MARKET = {
  FULLTIME_RESULT: 1, // 1X2
  OVER_UNDER: 80, // Goals Over/Under (line in `total`)
  BTTS: 14, // Both Teams To Score
  DOUBLE_CHANCE: 2,
  CORRECT_SCORE: 100,
  HTFT: 11,
  TEAM_TO_SCORE_FIRST: 87,
} as const;

/** SportMonks fixture state short names → our internal status. */
export const STATE_TO_STATUS: Record<string, string> = {
  NS: 'NS',
  INPLAY_1ST_HALF: 'LIVE',
  '1ST_HALF': 'LIVE',
  HT: 'HT',
  INPLAY_2ND_HALF: 'LIVE',
  '2ND_HALF': 'LIVE',
  LIVE: 'LIVE',
  INPLAY: 'LIVE',
  BREAK: 'BT',
  INPLAY_ET: 'ET',
  EXTRA_TIME: 'ET',
  PEN_BREAK: 'P',
  INPLAY_PENALTIES: 'P',
  FT: 'FT',
  AET: 'AET',
  FT_PEN: 'PEN',
  ENDED: 'FT',
  POSTPONED: 'PST',
  CANCELLED: 'CANC',
  SUSPENDED: 'SUSP',
  ABANDONED: 'ABD',
  DELAYED: 'SUSP',
  AWARDED: 'AWD',
  WALKOVER: 'WO',
};
