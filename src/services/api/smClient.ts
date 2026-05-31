/**
 * Professional SportMonks v3 HTTP client.
 *
 * Responsibilities:
 *  - Single axios instance with the right base URL for native vs. web
 *    (web in production goes through the /api/sportmonks Vercel proxy to avoid
 *    exposing the token and to sidestep CORS).
 *  - Token attached server-side via the proxy; on native/local the env token
 *    is used directly.
 *  - In-memory TTL cache + in-flight request de-duplication so the same data
 *    is never fetched twice concurrently (big win for the dashboard).
 *  - Automatic pagination helper that respects SportMonks `pagination.has_more`.
 *  - Retry with exponential backoff on 429 (rate limit) and 5xx.
 *  - Rate-limit visibility (remaining requests) surfaced for diagnostics.
 *
 * Docs: https://docs.sportmonks.com/v3/welcome/best-practices
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { config } from '@/constants/config';

const isWeb = Platform.OS === 'web';
const isLocalWeb =
  isWeb &&
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// On deployed web we proxy through our own serverless function (token hidden).
// On native and local-web dev we hit SportMonks directly with the env token.
const useProxy = isWeb && !isLocalWeb;
const BASE_URL = useProxy ? '/api/sportmonks' : config.sportmonks.baseUrl;

interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetsInSeconds: number | null;
  updatedAt: number;
}

export const rateLimit: RateLimitInfo = {
  limit: null,
  remaining: null,
  resetsInSeconds: null,
  updatedAt: 0,
};

/** Snapshot getter for UI (Settings rate-limit widget). */
export const getRateLimit = (): RateLimitInfo => ({ ...rateLimit });

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: useProxy
    ? { Accept: 'application/json' }
    : { Authorization: config.sportmonks.key, Accept: 'application/json' },
});

// ──────────────────────────── caching ────────────────────────────

interface CacheEntry {
  expires: number;
  data: any;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

/** Default TTLs (ms) by data volatility. */
export const TTL = {
  live: 5_000, // live scores/tracker change second-to-second; keep very short
  fixturesToday: 5 * 60_000,
  fixtureDetail: 60_000,
  predictions: 30 * 60_000,
  odds: 5 * 60_000,
  standings: 30 * 60_000,
  teamForm: 30 * 60_000,
  reference: 24 * 60 * 60_000, // leagues, markets, bookmakers, types
} as const;

const buildKey = (path: string, params?: Record<string, any>): string => {
  if (!params) return path;
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${path}?${sorted}`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const recordRateLimit = (body: any, headers?: any) => {
  // Prefer the JSON body's rate_limit (has resets_in_seconds), but also read the
  // X-RateLimit-* response headers (limit + remaining) which the proxy forwards.
  const rl = body?.rate_limit;
  if (rl) {
    if (typeof rl.remaining === 'number') rateLimit.remaining = rl.remaining;
    if (typeof rl.resets_in_seconds === 'number') rateLimit.resetsInSeconds = rl.resets_in_seconds;
    rateLimit.updatedAt = Date.now();
  }
  if (headers) {
    const limitH = headers['x-ratelimit-limit'] ?? headers['X-RateLimit-Limit'];
    const remainingH = headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'];
    const resetH = headers['x-ratelimit-reset'] ?? headers['X-RateLimit-Reset'];
    if (limitH != null && Number.isFinite(Number(limitH))) rateLimit.limit = Number(limitH);
    if (remainingH != null && Number.isFinite(Number(remainingH))) rateLimit.remaining = Number(remainingH);
    if (resetH != null && Number.isFinite(Number(resetH))) rateLimit.resetsInSeconds = Number(resetH);
    if (limitH != null || remainingH != null) rateLimit.updatedAt = Date.now();
  }
};

/**
 * Low-level GET with retry/backoff. Returns the full response body.
 */
const rawGet = async (
  path: string,
  params?: Record<string, any>,
  attempt = 0,
): Promise<any> => {
  const cfg: AxiosRequestConfig = { params };
  try {
    const res = await instance.get(path, cfg);
    recordRateLimit(res.data, res.headers);
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const retriable = status === 429 || (status >= 500 && status < 600) || err.code === 'ECONNABORTED';
    if (retriable && attempt < 3) {
      const backoff = Math.min(8000, 500 * Math.pow(2, attempt)) + Math.random() * 250;
      await sleep(backoff);
      return rawGet(path, params, attempt + 1);
    }
    throw err;
  }
};

/**
 * Cached, de-duplicated GET. Returns `response.data` (the array/object payload).
 */
export const smGet = async (
  path: string,
  options: { params?: Record<string, any>; ttl?: number } = {},
): Promise<any> => {
  const { params, ttl = TTL.fixtureDetail } = options;
  const key = buildKey(path, params);

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = rawGet(path, params)
    .then((body) => {
      const data = body?.data ?? null;
      cache.set(key, { expires: Date.now() + ttl, data });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
};

/**
 * Paginated GET — follows `pagination.has_more` and concatenates `data`.
 * Caps pages to avoid runaway loops. Caches the assembled result.
 */
export const smGetAll = async (
  path: string,
  options: { params?: Record<string, any>; ttl?: number; maxPages?: number } = {},
): Promise<any[]> => {
  const { params = {}, ttl = TTL.fixtureDetail, maxPages = 10 } = options;
  const cacheKey = buildKey(`${path}::all`, params);

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as any[];
  }

  const collected: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= maxPages) {
    const body = await rawGet(path, { ...params, per_page: params.per_page ?? 50, page });
    const data = body?.data;
    if (Array.isArray(data) && data.length > 0) collected.push(...data);
    hasMore = Boolean(body?.pagination?.has_more);
    page++;
  }

  cache.set(cacheKey, { expires: Date.now() + ttl, data: collected });
  return collected;
};

/**
 * SportMonks caps the `fixtureLeagues` filter at 50 league IDs per request.
 * This helper splits the league list into ≤`chunkSize` batches, runs the
 * paginated `smGetAll` for each batch, and concatenates the results — so the
 * app can track more than 50 leagues without hitting a 400 "Error parsing
 * filters" response. Each chunk is cached independently.
 */
export const LEAGUE_FILTER_MAX = 50;

export const smGetAllByLeagues = async (
  path: string,
  leagueIds: number[],
  options: {
    params?: Record<string, any>;
    ttl?: number;
    maxPages?: number;
    chunkSize?: number;
  } = {},
): Promise<any[]> => {
  const { params = {}, ttl, maxPages, chunkSize = LEAGUE_FILTER_MAX } = options;
  if (leagueIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < leagueIds.length; i += chunkSize) {
    chunks.push(leagueIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      smGetAll(path, {
        params: { ...params, filters: `fixtureLeagues:${chunk.join(',')}` },
        ttl,
        maxPages,
      }).catch(() => [] as any[]),
    ),
  );

  // Merge + de-dupe by fixture id (a fixture only belongs to one league, but be safe).
  const byId = new Map<number, any>();
  for (const arr of results) {
    for (const row of arr) {
      const id = row?.id;
      if (id != null) byId.set(id, row);
      else byId.set(Symbol() as any, row);
    }
  }
  return [...byId.values()];
};

/** Invalidate cache entries whose key contains `fragment` (or all). */
export const invalidateCache = (fragment?: string): void => {
  if (!fragment) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(fragment)) cache.delete(key);
  }
};
