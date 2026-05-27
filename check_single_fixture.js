const https = require('https');

const API_KEY = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';
const FIXTURE_ID = '19683254';

const url = `https://api.sportmonks.com/v3/football/fixtures/${FIXTURE_ID}?include=participants;league;season`;

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
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log('Fixture Data:', JSON.stringify(parsed.data, null, 2));
    } catch (e) {
      console.error(e);
    }
  });
});
