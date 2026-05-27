const https = require('https');

const API_KEY = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';
const date = '2026-05-20';

const url = `https://api.sportmonks.com/v3/football/fixtures/date/${date}?include=participants;league;venue;state;scores`;

const options = {
  headers: {
    'Authorization': API_KEY
  }
};

console.log(`Sending request to Sportmonks Pro API for date ${date}...`);
https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log('Successfully parsed JSON response.');
      const fixtures = parsed.data || [];
      console.log(`Found ${fixtures.length} fixtures on this date:`);
      fixtures.forEach((f, idx) => {
        const leagueName = f.league?.name || 'Unknown League';
        const start = f.starting_at || 'No Start Time';
        console.log(`[${idx + 1}] ID: ${f.id} | ${f.name} | League: ${leagueName} (ID: ${f.league_id}) | Start: ${start}`);
      });
    } catch (e) {
      console.error('Failed to parse response JSON:', e.message);
      console.log('Raw output snippet:', data.substring(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('HTTPS request error:', err.message);
});
