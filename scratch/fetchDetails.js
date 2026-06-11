const axios = require('axios');
const fs = require('fs');

const footballToken = 'HwuCaKadTkiTGrN5U8ome43PumCW6OGfaOoGMiNnRR4jL2XsxciRU0cy3Evn';
const cricketToken = 'NpTidbHGXPZR4QFiRxTQAnZlkB5yMpb3pSYgi3JvOHsGir30PMohpmeHZkpJ';

async function main() {
  try {
    // 1. Fetch football leagues (handling pagination)
    console.log('Fetching football...');
    let page = 1;
    let allFootballLeagues = [];
    while (true) {
      const fbUrl = `https://api.sportmonks.com/v3/football/leagues?api_token=${footballToken}&page=${page}`;
      const fbRes = await axios.get(fbUrl);
      const data = fbRes.data.data || [];
      if (data.length === 0) break;
      allFootballLeagues.push(...data);
      if (!fbRes.data.pagination || !fbRes.data.pagination.has_more) break;
      page++;
    }
    fs.writeFileSync('scratch/football_leagues.json', JSON.stringify(allFootballLeagues, null, 2));
    console.log(`Saved ${allFootballLeagues.length} football leagues to scratch/football_leagues.json`);

    // 2. Fetch cricket leagues
    const crUrl = `https://cricket.sportmonks.com/api/v2.0/leagues?api_token=${cricketToken}`;
    console.log('Fetching cricket...');
    const crRes = await axios.get(crUrl);
    fs.writeFileSync('scratch/cricket_leagues.json', JSON.stringify(crRes.data.data, null, 2));
    console.log('Saved cricket leagues to scratch/cricket_leagues.json');

  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

main();
