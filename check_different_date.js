const https = require('https');

const API_KEY = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';
const cleanDate = '2026-05-21';

const url = `https://api.sportmonks.com/v3/football/fixtures/date/${cleanDate}?include=participants;league;venue;state;scores`;

const options = {
  headers: {
    'Authorization': API_KEY
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const fixtures = parsed.data || [];
      console.log(`Found ${fixtures.length} fixtures for ${cleanDate}.`);
      fixtures.slice(0, 5).forEach((f) => {
        console.log(`ID: ${f.id} | Name: ${f.name} | starting_at: ${f.starting_at}`);
      });
    } catch (e) {
      console.error(e);
    }
  });
});
