import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/jiosaavn', async (req, res) => {
  try {
    const lang = req.query.lang || 'english';

    console.log('Requested language:', lang);

    const response = await axios.get(
      'https://www.jiosaavn.com/api.php?__call=webapi.getLaunchData&api_version=4&_format=json&_marker=0&ctx=web6dot0',
      {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
          Referer: 'https://www.jiosaavn.com/',
          Cookie: `L=${encodeURIComponent(lang)}`,
        },
      },
    );

    console.log('JioSaavn response received');

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