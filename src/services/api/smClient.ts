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
  remaining: number | null;
  resetsInSeconds: number | null;
  updatedAt: number;
}

export const rateLimit: RateLimitInfo = {
  remaining: null,
  resetsInSeconds: null,
  updatedAt: 0,
};

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
  live: 15_000, // live scores change second-to-second; keep very short
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

const recordRateLimit = (body: any) => {
  const rl = body?.rate_limit;
  if (rl) {
    rateLimit.remaining = typeof rl.remaining === 'number' ? rl.remaining : rateLimit.remaining;
    rateLimit.resetsInSeconds =
      typeof rl.resets_in_seconds === 'number' ? rl.resets_in_seconds : rateLimit.resetsInSeconds;
    rateLimit.updatedAt = Date.now();
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
    recordRateLimit(res.data);
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
export const smGet = async <T = any>(
  path: string,
  options: { params?: Record<string, any>; ttl?: number } = {},
): Promise<T> => {
  const { params, ttl = TTL.fixtureDetail } = options;
  const key = buildKey(path, params);

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = rawGet(path, params)
    .then((body) => {
      const data = (body?.data ?? null) as T;
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
export const smGetAll = async <T = any>(
  path: string,
  options: { params?: Record<string, any>; ttl?: number; maxPages?: number } = {},
): Promise<T[]> => {
  const { params = {}, ttl = TTL.fixtureDetail, maxPages = 10 } = options;
  const cacheKey = buildKey(`${path}::all`, params);

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T[];
  }

  const collected: T[] = [];
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
