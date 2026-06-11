const axios = require('axios');

const footballToken = 'HwuCaKadTkiTGrN5U8ome43PumCW6OGfaOoGMiNnRR4jL2XsxciRU0cy3Evn';
const cricketToken = 'NpTidbHGXPZR4QFiRxTQAnZlkB5yMpb3pSYgi3JvOHsGir30PMohpmeHZkpJ';

async function fetchFootballLeagues() {
  try {
    const url = `https://api.sportmonks.com/v3/my/leagues?api_token=${footballToken}`;
    console.log('Fetching football leagues...');
    const response = await axios.get(url);
    console.log('Football leagues count:', response.data.data ? response.data.data.length : 0);
    if (response.data.data) {
      response.data.data.forEach(league => {
        console.log(`- Football League [${league.id}]: ${league.name} (${league.sub_type})`);
      });
    }
    return response.data.data || [];
  } catch (err) {
    console.error('Error fetching football leagues:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
    return [];
  }
}

async function fetchCricketLeagues() {
  try {
    const url = `https://cricket.sportmonks.com/api/v2.0/leagues?api_token=${cricketToken}`;
    console.log('Fetching cricket leagues...');
    const response = await axios.get(url);
    console.log('Cricket leagues count:', response.data.data ? response.data.data.length : 0);
    if (response.data.data) {
      response.data.data.forEach(league => {
        console.log(`- Cricket League [${league.id}]: ${league.name}`);
      });
    }
    return response.data.data || [];
  } catch (err) {
    console.error('Error fetching cricket leagues:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
    return [];
  }
}

async function main() {
  const football = await fetchFootballLeagues();
  const cricket = await fetchCricketLeagues();
}

main();
