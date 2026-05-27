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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract the path after /api/sportmonks/
    const { path } = req.query;
    const subPath = Array.isArray(path) ? path.join('/') : path || '';

    // Rebuild query string, excluding the [...path] param
    const url = new URL(`https://api.sportmonks.com/v3/football/${subPath}`);
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path') {
        url.searchParams.set(key, String(value));
      }
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

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(apiRes.status).send(body);
  } catch (err) {
    console.error('[Sportmonks Proxy] Error:', err);
    return res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}
