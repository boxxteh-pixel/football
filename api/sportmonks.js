/**
 * Vercel Serverless Function – Sportmonks CORS Proxy
 * 
 * Forwards all requests from /api/sportmonks/* to https://api.sportmonks.com/v3/football/*
 * Injects the API token server-side so the browser never sees CORS issues.
 * 
 * Environment variable required on Vercel:
 *   SPORTMONKS_API_TOKEN  (your Sportmonks token)
 */

export default async function handler(req, res) {
  // Allow CORS from any origin (it's our own proxy)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Expose rate-limit headers to the browser so the app can show real usage.
  res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract the path after /api/sportmonks/ using req.url
    const reqUrlObj = new URL(req.url || '', 'https://localhost');
    const subPath = reqUrlObj.pathname.replace(/^\/api\/sportmonks\/?/, '');

    // Rebuild query string
    const url = new URL(`https://api.sportmonks.com/v3/football/${subPath}`);
    reqUrlObj.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Use the token from env, fallback to hardcoded (same as config.ts)
    const token =
      process.env.SPORTMONKS_API_TOKEN ||
      process.env.EXPO_PUBLIC_SPORTMONKS_KEY ||
      'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';

    console.log(`[Sportmonks Proxy] → ${url.toString()}`);

    const apiRes = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
    });

    const contentType = apiRes.headers.get('content-type') || 'application/json';
    const body = await apiRes.text();

    // Forward SportMonks rate-limit headers to the client.
    ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach((hKey) => {
      const v = apiRes.headers.get(hKey);
      if (v != null) res.setHeader(hKey, v);
    });

    res.setHeader('Content-Type', contentType);
    // Live & in-play data must NOT be edge-cached (was s-maxage=120 → stale live
    // scores). Only cache slow-moving reference data briefly.
    const isLivePath = /livescores|inplay|\/fixtures\//.test(subPath);
    if (isLivePath) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    } else {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    }
    return res.status(apiRes.status).send(body);
  } catch (err) {
    console.error('[Sportmonks Proxy] Error:', err);
    return res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}
