import express from 'express';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const router = express.Router();

// Use a proxy located in India. Options:
// - A cheap India-region VPS you run a proxy on yourself (e.g. DigitalOcean Bangalore + tinyproxy/squid)
// - A residential/datacenter proxy provider with India IPs (Bright Data, Smartproxy, Oxylabs, etc.)
const INDIA_PROXY_URL = process.env.INDIA_PROXY_URL; // e.g. 'http://user:pass@proxy-host:port'

const proxyAgent = INDIA_PROXY_URL ? new HttpsProxyAgent(INDIA_PROXY_URL) : undefined;

router.get('/jiosaavn', async (req, res) => {
  try {
    const lang = req.query.lang || 'hindi';
    const response = await axios.get('https://www.jiosaavn.com/api.php', {
      params: {
        __call: 'webapi.getLaunchData',
        api_version: 4,
        _format: 'json',
        _marker: 0,
        ctx: 'web6dot0',
      },
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

    res.json(response.data);
  } catch (error) {
    console.error('JioSaavn error:', error.response?.status, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
    });
  }
});

export default router;