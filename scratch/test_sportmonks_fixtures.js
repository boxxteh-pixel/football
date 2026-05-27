const axios = require('axios');

const TOKEN = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';

async function test() {
  try {
    console.log('Querying Sportmonks Fixtures for a date...');
    // Let's query fixtures on 2026-05-24 (from the Manchester City vs Aston Villa example)
    const date = '2026-05-24';
    const res = await axios.get(`https://api.sportmonks.com/v3/football/fixtures/date/${date}?include=participants;league;venue;state;scores;predictions.type`, {
      headers: {
        'Authorization': TOKEN
      }
    });

    console.log('Successfully fetched fixtures. Total:', res.data.data.length);
    if (res.data.data.length > 0) {
      const fixture = res.data.data[0];
      console.log('Fixture Name:', fixture.name);
      console.log('League:', fixture.league ? fixture.league.name : 'N/A');
      console.log('Predictions count:', fixture.predictions ? fixture.predictions.length : 0);
      if (fixture.predictions && fixture.predictions.length > 0) {
        console.log('First prediction details:');
        console.log(JSON.stringify(fixture.predictions[0], null, 2));
      }
    }
  } catch (err) {
    console.error('Error fetching fixtures:', err.response ? err.response.data : err.message);
  }
}

test();
