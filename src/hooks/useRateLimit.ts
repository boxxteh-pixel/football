import { useEffect, useState } from 'react';
import { getRateLimit, smGet, TTL } from '@/services/api/smClient';
import { hasApiKey } from '@/constants/config';

export interface RateLimitView {
  limit: number | null;
  remaining: number | null;
  used: number | null;
  usedPct: number | null;
  remainingPct: number | null; // 0-100 of calls still available
  resetsInSeconds: number | null;
  updatedAt: number;
  /** Compact remaining label, e.g. "52.9k", "1.2k", "320". */
  compact: string;
}

/** Format a number compactly: 52901 → "52.9k". */
export const compactNumber = (n: number | null): string => {
  if (n == null) return '—';
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
};

/**
 * Surfaces the real SportMonks API rate limit (calls/hour).
 *
 * Reading the snapshot is FREE (in-memory), so we poll it frequently (3s) to
 * stay live without any extra API cost — the live tracker/scores calls keep the
 * snapshot fresh. A light ping only fires when the value is missing/stale, and
 * never more than once a minute, so it can't burn through credits.
 */
export const useRateLimit = (pollMs = 3000): RateLimitView => {
  const [view, setView] = useState<RateLimitView>(() => toView(getRateLimit()));

  useEffect(() => {
    let active = true;
    let lastPing = 0;

    const refresh = () => {
      if (!active) return;
      const snap = getRateLimit();
      setView(toView(snap));
      // Only ping if we have no value yet AND haven't pinged in the last 60s.
      const now = Date.now();
      if (hasApiKey() && (snap.limit == null || now - snap.updatedAt > 120000) && now - lastPing > 60000) {
        lastPing = now;
        smGet('/livescores/inplay', { ttl: TTL.live }).catch(() => {});
      }
    };

    refresh();
    const id = setInterval(refresh, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return view;
};

const toView = (rl: ReturnType<typeof getRateLimit>): RateLimitView => {
  const used = rl.limit != null && rl.remaining != null ? rl.limit - rl.remaining : null;
  const usedPct = rl.limit != null && rl.limit > 0 && used != null ? (used / rl.limit) * 100 : null;
  const remainingPct = usedPct != null ? Math.max(0, 100 - usedPct) : null;
  return {
    limit: rl.limit,
    remaining: rl.remaining,
    used,
    usedPct,
    remainingPct,
    resetsInSeconds: rl.resetsInSeconds,
    updatedAt: rl.updatedAt,
    compact: compactNumber(rl.remaining),
  };
};
