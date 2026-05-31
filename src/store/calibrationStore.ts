/**
 * Self-improving probability CALIBRATION (per-market, hierarchical).
 *
 * A model can be "sharp" but mis-calibrated: e.g. picks it rates 70% only win
 * 60% of the time. Calibration learns the mapping from predicted probability →
 * observed frequency and corrects future probabilities toward reality, which is
 * what minimises log-loss / Brier score (the metric shown on the Results tab).
 *
 * Different markets have different calibration profiles — a 70% Over 2.5 pick
 * behaves nothing like a 70% home-win pick. So we keep SEPARATE reliability
 * bins per market group ('1X2', 'GOALS', 'BTTS') plus a global pool. A market's
 * calibrated value is a HIERARCHICAL estimate: the market-group bin smoothed
 * toward the global-pool bin, which is itself smoothed toward the bin midpoint.
 * This specialises per market when data is rich, yet borrows strength from the
 * pool (and the prior) when a group is sparse — so it never over-corrects on a
 * handful of samples. Persisted locally; improves as more matches settle.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUM_BINS = 10; // deciles: 0-10%, 10-20%, ... 90-100%
const PRIOR_GLOBAL = 12; // pseudo-obs anchoring the global pool to each bin midpoint
const PRIOR_GROUP = 10; // pseudo-obs anchoring a market group to the global pool
const MAX_SWING = 12; // cap calibration adjustment at ±12 points (stability)

export type MarketGroup = '1X2' | 'GOALS' | 'BTTS' | 'ALL';

/** Map a raw top-pick market to its calibration group. */
export const marketGroup = (market: string): MarketGroup => {
  if (market === 'OVER_2_5' || market === 'UNDER_2_5') return 'GOALS';
  if (market === 'BTTS') return 'BTTS';
  return '1X2'; // WIN | DRAW
};

interface Bin {
  n: number; // settled picks in this bin
  wins: number; // how many won
}

type Groups = Record<MarketGroup, Bin[]>;

interface CalibrationState {
  groups: Groups;
  recordedIds: Record<string, true>; // fixtureId:market keys already counted
  hydrated: boolean;
  hydrate: () => Promise<void>;
  record: (key: string, probabilityPct: number, won: boolean, market?: string) => Promise<void>;
  /** Map a raw probability (0-100) to its calibrated estimate (0-100). */
  calibrate: (probabilityPct: number, market?: string) => number;
  reset: () => Promise<void>;
}

const KEY = 'boro_calibration_v2';
const emptyBins = (): Bin[] => Array.from({ length: NUM_BINS }, () => ({ n: 0, wins: 0 }));
const emptyGroups = (): Groups => ({
  '1X2': emptyBins(),
  GOALS: emptyBins(),
  BTTS: emptyBins(),
  ALL: emptyBins(),
});

const binIndex = (p: number): number => {
  const clamped = Math.max(0, Math.min(99.999, p));
  return Math.floor(clamped / (100 / NUM_BINS));
};

const cloneGroups = (g: Groups): Groups => ({
  '1X2': g['1X2'].map((b) => ({ ...b })),
  GOALS: g.GOALS.map((b) => ({ ...b })),
  BTTS: g.BTTS.map((b) => ({ ...b })),
  ALL: g.ALL.map((b) => ({ ...b })),
});

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  groups: emptyGroups(),
  recordedIds: {},
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const g = parsed?.groups;
        if (g && Array.isArray(g['1X2']) && g['1X2'].length === NUM_BINS) {
          set({
            groups: {
              '1X2': g['1X2'],
              GOALS: g.GOALS ?? emptyBins(),
              BTTS: g.BTTS ?? emptyBins(),
              ALL: g.ALL ?? emptyBins(),
            },
            recordedIds: parsed.recordedIds ?? {},
            hydrated: true,
          });
          return;
        }
      }
      set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  record: async (key, probabilityPct, won, market) => {
    // Each fixture+market counted at most once.
    if (get().recordedIds[key]) return;
    const groups = cloneGroups(get().groups);
    const i = binIndex(probabilityPct);
    const grp = marketGroup(market ?? '');
    groups[grp][i].n += 1;
    if (won) groups[grp][i].wins += 1;
    // Always feed the global pool too (shared strength for sparse groups).
    groups.ALL[i].n += 1;
    if (won) groups.ALL[i].wins += 1;
    const recordedIds = { ...get().recordedIds, [key]: true as const };
    set({ groups, recordedIds });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ groups, recordedIds }));
    } catch {
      // ignore
    }
  },
  calibrate: (probabilityPct, market) => {
    const groups = get().groups;
    const i = binIndex(probabilityPct);
    const midpoint = (i + 0.5) * (100 / NUM_BINS); // bin's own prior center

    // Level 1: global pool, smoothed toward the bin midpoint.
    const all = groups.ALL[i];
    const globalRate =
      ((all.wins + (PRIOR_GLOBAL * midpoint) / 100) / (all.n + PRIOR_GLOBAL)) * 100;

    // Level 2: market group, smoothed toward the global-pool rate.
    const grp = marketGroup(market ?? '');
    const g = grp === 'ALL' ? all : groups[grp][i];
    const calibrated =
      ((g.wins + (PRIOR_GROUP * globalRate) / 100) / (g.n + PRIOR_GROUP)) * 100;

    // Stay stable: don't swing more than ±MAX_SWING from the raw value.
    const delta = Math.max(-MAX_SWING, Math.min(MAX_SWING, calibrated - probabilityPct));
    return Math.max(1, Math.min(99, probabilityPct + delta));
  },
  reset: async () => {
    set({ groups: emptyGroups(), recordedIds: {} });
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
}));

/** Total settled samples across all market-group bins (calibration confidence). */
export const calibrationSampleCount = (groups: Groups): number =>
  groups.ALL.reduce((s, b) => s + b.n, 0);
