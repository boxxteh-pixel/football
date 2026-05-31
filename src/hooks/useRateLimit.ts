import { useEffect, useState } from 'react';
import { getRateLimit, smGet, TTL } from '@/services/api/smClient';
import { hasApiKey } from '@/constants/config';

export interface RateLimitView {
  limit: number | null;
  remaining: number | null;
  used: number | null;
  usedPct: number | null;
  resetsInSeconds: number | null;
  updatedAt: number;
}

/**
 * Surfaces the real SportMonks API rate limit (calls/hour) for the Settings
 * screen. Reads the snapshot captured on every request, and does a light ping
 * on mount so there's always a fresh value to show.
 */
export const useRateLimit = (pollMs = 30000): RateLimitView => {
  const [view, setView] = useState<RateLimitView>(() => toView(getRateLimit()));

  useEffect(() => {
    let active = true;
    const refresh = () => active && setView(toView(getRateLimit()));

    // Light ping to populate headers if we don't have a recent value.
    const snap = getRateLimit();
    if (hasApiKey() && (snap.limit == null || Date.now() - snap.updatedAt > 60000)) {
      smGet('/livescores/inplay', { ttl: TTL.live }).catch(() => {}).finally(refresh);
    } else {
      refresh();
    }

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
  return {
    limit: rl.limit,
    remaining: rl.remaining,
    used,
    usedPct,
    resetsInSeconds: rl.resetsInSeconds,
    updatedAt: rl.updatedAt,
  };
};
