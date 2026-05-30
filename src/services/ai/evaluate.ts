/**
 * Grades a prediction against the actual final result of a finished fixture.
 *
 * Used by the Results/History screen to outline each match green (the model's
 * top pick landed) or red (it missed), and to compute a running hit-rate so the
 * accuracy of the model is transparent — not a black box.
 */
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';

export type Grade = 'correct' | 'incorrect' | 'pending';

export interface GradedPrediction {
  grade: Grade;
  /** The market that was evaluated, e.g. "1X2", "Over 2.5", "BTTS". */
  market: string;
  /** Human pick text, e.g. "Arsenal to Win". */
  pick: string;
  /** Actual outcome label for that market, e.g. "Home win 2-1". */
  actual: string;
  /** Model probability assigned to the pick (0-100). */
  probability: number;
}

const isFinished = (f: Fixture): boolean =>
  ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(f.fixture.status.short) &&
  f.goals.home !== null &&
  f.goals.away !== null;

/**
 * Determine whether the prediction's top pick was correct for a finished match.
 * Evaluates the SAME market the model led with (1X2, Over/Under 2.5, or BTTS),
 * so the grade reflects exactly what the app showed the user.
 */
export const gradePrediction = (
  fixture: Fixture,
  prediction: PredictionResult,
): GradedPrediction => {
  const market = prediction.topPick.market;
  const pick = prediction.topPick.selection;
  const probability = prediction.topPick.probability;

  if (!isFinished(fixture)) {
    return { grade: 'pending', market, pick, actual: '—', probability };
  }

  const h = fixture.goals.home as number;
  const a = fixture.goals.away as number;
  const total = h + a;
  const homeName = fixture.teams.home.name;
  const awayName = fixture.teams.away.name;

  const resultLabel =
    h > a ? `${homeName} won ${h}-${a}` : a > h ? `${awayName} won ${a}-${h}` : `Draw ${h}-${a}`;

  let correct = false;
  let actual = resultLabel;
  let marketLabel = '1X2';

  switch (market) {
    case 'WIN': {
      marketLabel = '1X2';
      if (pick.startsWith(homeName)) correct = h > a;
      else correct = a > h;
      break;
    }
    case 'DRAW': {
      marketLabel = '1X2';
      correct = h === a;
      break;
    }
    case 'OVER_2_5': {
      marketLabel = 'Over 2.5';
      correct = total > 2;
      actual = `${total} goals`;
      break;
    }
    case 'UNDER_2_5': {
      marketLabel = 'Under 2.5';
      correct = total <= 2;
      actual = `${total} goals`;
      break;
    }
    case 'BTTS': {
      marketLabel = 'BTTS';
      correct = h >= 1 && a >= 1;
      actual = h >= 1 && a >= 1 ? `Both scored (${h}-${a})` : `Not both (${h}-${a})`;
      break;
    }
  }

  return { grade: correct ? 'correct' : 'incorrect', market: marketLabel, pick, actual, probability };
};

export interface AccuracySummary {
  total: number;
  correct: number;
  hitRate: number; // 0-100
  /** Brier score (lower is better): mean squared error of the pick probability. */
  brier: number;
}

/**
 * Aggregate accuracy across a set of graded predictions.
 * Brier uses the binary outcome of the led market vs its stated probability.
 */
export const summarizeAccuracy = (
  graded: Array<{ grade: Grade; probability: number }>,
): AccuracySummary => {
  const decided = graded.filter((g) => g.grade !== 'pending');
  const total = decided.length;
  const correct = decided.filter((g) => g.grade === 'correct').length;
  const brier =
    total > 0
      ? decided.reduce((s, g) => {
          const p = g.probability / 100;
          const outcome = g.grade === 'correct' ? 1 : 0;
          return s + (p - outcome) ** 2;
        }, 0) / total
      : 0;
  return {
    total,
    correct,
    hitRate: total > 0 ? (correct / total) * 100 : 0,
    brier,
  };
};
