const axios = require('axios');

const footballToken = 'HwuCaKadTkiTGrN5U8ome43PumCW6OGfaOoGMiNnRR4jL2XsxciRU0cy3Evn';
const cricketToken = 'NpTidbHGXPZR4QFiRxTQAnZlkB5yMpb3pSYgi3JvOHsGir30PMohpmeHZkpJ';

const today = new Date().toISOString().slice(0, 10); // 2026-06-11

async function main() {
  console.log(`=== Diagnostic for ${today} ===\n`);

  // 1. Football: fetch ALL fixtures for today (no league filter)
  console.log('--- FOOTBALL: All fixtures today (no league filter) ---');
  try {
    let page = 1;
    let total = 0;
    const leagueSet = new Set();
    while (true) {
      const url = `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${footballToken}&include=league&per_page=50&page=${page}`;
      const res = await axios.get(url);
      const data = res.data.data || [];
      total += data.length;
      data.forEach(f => {
        const ln = f.league ? f.league.name : 'unknown';
        const lid = f.league ? f.league.id : f.league_id;
        leagueSet.add(`[${lid}] ${ln}`);
      });
      if (!res.data.pagination || !res.data.pagination.has_more) break;
      page++;
      if (page > 5) { console.log('  (stopped at 5 pages)'); break; }
    }
    console.log(`  Total fixtures today: ${total}`);
    console.log(`  Unique leagues with fixtures today:`);
    [...leagueSet].sort().forEach(l => console.log(`    ${l}`));
  } catch (err) {
    console.error('  Football error:', err.message);
    if (err.response) console.error('  Response:', JSON.stringify(err.response.data).slice(0, 500));
  }

  // 2. Football: /my/leagues (what subscription says)
  console.log('\n--- FOOTBALL: /my/leagues (subscription) ---');
  try {
    const url = `https://api.sportmonks.com/v3/my/leagues?api_token=${footballToken}`;
    const res = await axios.get(url);
    const data = res.data.data || [];
    console.log(`  Subscribed leagues: ${data.length}`);
    data.forEach(l => console.log(`    [${l.id}] ${l.name} (sport: ${l.sport?.name || l.sport_id})`));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // 3. Cricket: fetch fixtures today
  console.log('\n--- CRICKET: All fixtures today ---');
  try {
    const url = `https://cricket.sportmonks.com/api/v2.0/fixtures?filter[starts_between]=${today},${today}&include=localteam,visitorteam,league&api_token=${cricketToken}`;
    const res = await axios.get(url);
    const data = res.data.data || [];
    console.log(`  Total cricket fixtures today: ${data.length}`);
    const leagueSet = new Set();
    data.forEach(f => {
      const ln = f.league ? f.league.name : 'unknown';
      const lid = f.league ? f.league.id : f.league_id;
      leagueSet.add(`[${lid}] ${ln}`);
      console.log(`    ${f.localteam?.name || '?'} vs ${f.visitorteam?.name || '?'} (${ln}) - ${f.status}`);
    });
    if (leagueSet.size > 0) {
      console.log(`  Unique cricket leagues with fixtures today:`);
      [...leagueSet].sort().forEach(l => console.log(`    ${l}`));
    }
  } catch (err) {
    console.error('  Cricket error:', err.message);
    if (err.response) console.error('  Response:', JSON.stringify(err.response.data).slice(0, 500));
  }

  // 4. Cricket: check a few days range for more data
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  console.log(`\n--- CRICKET: Fixtures ${today} to ${nextWeek} ---`);
  try {
    const url = `https://cricket.sportmonks.com/api/v2.0/fixtures?filter[starts_between]=${today},${nextWeek}&include=league&api_token=${cricketToken}`;
    const res = await axios.get(url);
    const data = res.data.data || [];
    console.log(`  Cricket fixtures this week: ${data.length}`);
    const leagueSet = new Set();
    data.forEach(f => {
      const ln = f.league ? f.league.name : 'unknown';
      const lid = f.league ? f.league.id : f.league_id;
      leagueSet.add(`[${lid}] ${ln}`);
    });
    [...leagueSet].sort().forEach(l => console.log(`    ${l}`));
  } catch (err) {
    console.error('  Cricket week error:', err.message);
    if (err.response) console.error('  Response:', JSON.stringify(err.response.data).slice(0, 500));
  }

  // 5. Football: check more dates
  console.log(`\n--- FOOTBALL: Fixtures ${tomorrow} ---`);
  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/date/${tomorrow}?api_token=${footballToken}&per_page=50&page=1`;
    const res = await axios.get(url);
    const data = res.data.data || [];
    console.log(`  Total fixtures tomorrow: ${data.length}`);
    const leagueSet = new Set();
    data.forEach(f => leagueSet.add(`[${f.league_id}]`));
    console.log(`  Unique league IDs: ${[...leagueSet].join(', ')}`);
  } catch (err) {
    console.error('  Error:', err.message);
  }
}

main();
