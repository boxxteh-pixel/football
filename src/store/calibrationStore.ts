/**
 * Self-improving probability CALIBRATION.
 *
 * A model can be "sharp" but mis-calibrated: e.g. picks it rates 70% only win
 * 60% of the time. Calibration learns the mapping from predicted probability →
 * observed frequency and corrects future probabilities toward reality, which is
 * what minimises log-loss / Brier score (the metric shown on the Results tab).
 *
 * We use reliability BINS (deciles). For each finished pick we record which bin
 * its probability fell in and whether it actually won. The calibrated value for
 * a new probability is the smoothed empirical win-rate of its bin (blended with
 * the raw probability via additive (Laplace) smoothing so small samples don't
 * overcorrect). Persisted locally; improves as more matches settle.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUM_BINS = 10; // deciles: 0-10%, 10-20%, ... 90-100%
const PRIOR_STRENGTH = 12; // pseudo-observations anchoring each bin to its own midpoint

interface Bin {
  n: number; // settled picks in this bin
  wins: number; // how many won
}

interface CalibrationState {
  bins: Bin[];
  recordedIds: Record<string, true>; // fixtureId:market keys already counted
  hydrated: boolean;
  hydrate: () => Promise<void>;
  record: (key: string, probabilityPct: number, won: boolean) => Promise<void>;
  /** Map a raw probability (0-100) to its calibrated estimate (0-100). */
  calibrate: (probabilityPct: number) => number;
  reset: () => Promise<void>;
}

const KEY = 'boro_calibration_v1';
const emptyBins = (): Bin[] => Array.from({ length: NUM_BINS }, () => ({ n: 0, wins: 0 }));

const binIndex = (p: number): number => {
  const clamped = Math.max(0, Math.min(99.999, p));
  return Math.floor(clamped / (100 / NUM_BINS));
};

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  bins: emptyBins(),
  recordedIds: {},
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.bins) && parsed.bins.length === NUM_BINS) {
          set({ bins: parsed.bins, recordedIds: parsed.recordedIds ?? {}, hydrated: true });
          return;
        }
      }
      set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  record: async (key, probabilityPct, won) => {
    // Each fixture+market counted at most once.
    if (get().recordedIds[key]) return;
    const bins = get().bins.map((b) => ({ ...b }));
    const i = binIndex(probabilityPct);
    bins[i].n += 1;
    if (won) bins[i].wins += 1;
    const recordedIds = { ...get().recordedIds, [key]: true as const };
    set({ bins, recordedIds });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ bins, recordedIds }));
    } catch {
      // ignore
    }
  },
  calibrate: (probabilityPct) => {
    const bins = get().bins;
    const i = binIndex(probabilityPct);
    const b = bins[i];
    const midpoint = (i + 0.5) * (100 / NUM_BINS); // bin's own prior center
    // Additive smoothing: blend observed win-rate with the bin midpoint prior.
    const priorWins = (PRIOR_STRENGTH * midpoint) / 100;
    const calibrated = ((b.wins + priorWins) / (b.n + PRIOR_STRENGTH)) * 100;
    // Don't let calibration swing more than ±12 points from the raw value to
    // stay stable while still nudging toward observed reality.
    const delta = Math.max(-12, Math.min(12, calibrated - probabilityPct));
    return Math.max(1, Math.min(99, probabilityPct + delta));
  },
  reset: async () => {
    set({ bins: emptyBins(), recordedIds: {} });
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
}));

/** Total settled samples across all bins (for surfacing calibration confidence). */
export const calibrationSampleCount = (bins: Array<{ n: number }>): number =>
  bins.reduce((s, b) => s + b.n, 0);
