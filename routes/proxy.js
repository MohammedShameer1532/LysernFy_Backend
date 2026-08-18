import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/jiosaavn', async (req, res) => {
  try {
    const lang = req.query.lang || 'hindi';
    const response = await axios.get(
      'https://www.jiosaavn.com/api.php',
      {
        params: {
          __call: 'webapi.getLaunchData',
          api_version: 4,
          _format: 'json',
          _marker: 0,
          ctx: 'web6dot0',
        },

        headers: {
          Accept: 'application/json, text/plain, */*',

          'Accept-Language':
            'en-US,en;q=0.9,en-IN;q=0.8',

          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',

          Referer:
            'https://www.jiosaavn.com/',

          Origin:
            'https://www.jiosaavn.com',

          Cookie:
            `_pl=web6dot0-; ` +
            `DL=english; ` +
            `network=phone; ` +
            `SG=f; ` +
            `L=${encodeURIComponent(lang)}`,
        },

        timeout: 15000,
      },
    );

    res.json(response.data);

  } catch (error) {

    console.error(
      'JioSaavn error:',
      error.response?.status,
      error.response?.data || error.message,
    );

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
    });
  }
});

export default router;