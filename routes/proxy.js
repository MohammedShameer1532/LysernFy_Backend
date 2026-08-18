import express from 'express';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const router = express.Router();
const proxyAgent = process.env.INDIA_PROXY_URL ? new HttpsProxyAgent(process.env.INDIA_PROXY_URL) : undefined;

const cache = new Map(); // lang -> { data, fetchedAt }
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

async function fetchFromJioSaavn(lang) {
  const response = await axios.get('https://www.jiosaavn.com/api.php', {
    params: { __call: 'webapi.getLaunchData', api_version: 4, _format: 'json', _marker: 0, ctx: 'web6dot0' },
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,en-IN;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      Referer: 'https://www.jiosaavn.com/',
      Origin: 'https://www.jiosaavn.com',
      Cookie: `_pl=web6dot0-; DL=english; network=phone; SG=f; L=${encodeURIComponent(lang)}`,
    },
    httpsAgent: proxyAgent,
    timeout: 15000,
  });
  return response.data;
}

router.get('/jiosaavn', async (req, res) => {
  const lang = req.query.lang || 'hindi';

  try {
    const cached = cache.get(lang);
    const isStale = !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS;

    if (isStale) {
      const data = await fetchFromJioSaavn(lang);
      cache.set(lang, { data, fetchedAt: Date.now() });
      return res.json(data);
    }

    return res.json(cached.data);
  } catch (error) {
    // If the live fetch fails, fall back to stale cache rather than erroring
    const cached = cache.get(lang);
    if (cached) {
      console.warn('JioSaavn live fetch failed, serving stale cache');
      return res.json(cached.data);
    }

    console.error('JioSaavn error:', error.response?.status, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
    });
  }
});

export default router;