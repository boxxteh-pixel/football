/**
 * Personal pick tracker ("bet slip"): the user saves predictions they like and
 * the app tracks real performance over time — settled win/loss, hit rate, ROI
 * at a notional 1-unit stake. Persisted locally via AsyncStorage.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SlipStatus = 'pending' | 'won' | 'lost' | 'void';

export interface SavedPick {
  id: string; // `${fixtureId}:${market}`
  fixtureId: number;
  homeName: string;
  awayName: string;
  leagueName: string;
  kickoff: string; // ISO
  market: 'WIN' | 'DRAW' | 'BTTS' | 'OVER_2_5' | 'UNDER_2_5';
  selection: string; // human label
  probability: number; // 0-100 at time of saving
  odds: number; // best available decimal odds at save time
  status: SlipStatus;
  result?: string; // final score / outcome once settled
  savedAt: number;
}

interface BetSlipState {
  picks: SavedPick[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (pick: Omit<SavedPick, 'status' | 'savedAt'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  settle: (id: string, status: SlipStatus, result: string) => Promise<void>;
  has: (id: string) => boolean;
  clearSettled: () => Promise<void>;
}

const KEY = 'boro_bet_slip_v1';

const persist = async (picks: SavedPick[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    // ignore
  }
};

export const useBetSlipStore = create<BetSlipState>((set, get) => ({
  picks: [],
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ picks: raw ? JSON.parse(raw) : [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  add: async (pick) => {
    if (get().picks.some((p) => p.id === pick.id)) return;
    const next = [{ ...pick, status: 'pending' as SlipStatus, savedAt: Date.now() }, ...get().picks];
    set({ picks: next });
    await persist(next);
  },
  remove: async (id) => {
    const next = get().picks.filter((p) => p.id !== id);
    set({ picks: next });
    await persist(next);
  },
  settle: async (id, status, result) => {
    const next = get().picks.map((p) => (p.id === id ? { ...p, status, result } : p));
    set({ picks: next });
    await persist(next);
  },
  has: (id) => get().picks.some((p) => p.id === id),
  clearSettled: async () => {
    const next = get().picks.filter((p) => p.status === 'pending');
    set({ picks: next });
    await persist(next);
  },
}));

export interface SlipSummary {
  pending: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number; // 0-100 over settled
  staked: number; // 1u per settled pick
  returned: number; // sum of odds for won picks
  profit: number; // returned - staked
  roi: number; // profit / staked * 100
}

export const summarizeSlip = (picks: SavedPick[]): SlipSummary => {
  const settled = picks.filter((p) => p.status === 'won' || p.status === 'lost');
  const won = settled.filter((p) => p.status === 'won');
  const lost = settled.filter((p) => p.status === 'lost');
  const staked = settled.length; // 1 unit each
  const returned = won.reduce((s, p) => s + (p.odds > 1 ? p.odds : 0), 0);
  const profit = returned - staked;
  return {
    pending: picks.filter((p) => p.status === 'pending').length,
    settled: settled.length,
    won: won.length,
    lost: lost.length,
    hitRate: settled.length > 0 ? (won.length / settled.length) * 100 : 0,
    staked,
    returned,
    profit,
    roi: staked > 0 ? (profit / staked) * 100 : 0,
  };
};
