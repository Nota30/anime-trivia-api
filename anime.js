const axios = require('axios');
const express = require('express');
const app = express();

const ANILIST_API_BASE = 'https://anilist.co/api/v2/anime/';
const ANILIST_API_KEY = 'mOBwohz9EoZWUy04S9BL9k7UuESDiPP8N8FqGhml';

async function fetchRandomAnime() {
  const randomId = Math.floor(Math.random() * 1000) + 1;
  const apiUrl = `${ANILIST_API_BASE}${randomId}`;

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${ANILIST_API_KEY}`,
    },
  };

  try {
    const response = await axios.get(apiUrl, axiosConfig);
    return response.data;
  } catch (error) {
    console.error('Axios error:', error);
    return null;
  }
}

app.get('/random_anime', async (req, res) => {
  const animeData = await fetchRandomAnime();
  if (animeData) {
    res.json(animeData);
  } else {
    res.status(500).json({ error: 'Failed to fetch anime data' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});