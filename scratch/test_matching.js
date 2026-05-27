const axios = require('axios');

const TOKEN = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';

function cleanName(name) {
  return name.toLowerCase()
    .replace(/\b(fc|cf|afc|ud|sc|fk|ac|rc|ca|as|ssc|celta|de|real|club|athletic|atlético|atletico|city|united|town|hotspur|rovers|wanderers|albion|forest|palace|villa|ham|ajax|feyenoord|psv|sporting|benfica|porto|braga|rio|ave|estoril|boavista|famalicao|portimonense|chaves|vizela|arouca|gil|vicente|farense|moreirense|estrada|bayer|bayern|borussia|schalke|werder|stuttgart|mainz|wolfsburg|frankfurt|freiburg|hoffenheim|augsburg|leipzig|koln|cologne|bochum|darmstadt|heidenheim|psg|paris|marseille|monaco|lyon|lille|lens|rennes|nice|reims|strasbourg|toulouse|montpellier|lorient|nantes|le|havre|brest|clermont|metz)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function matchTeams(home1, away1, home2, away2) {
  const h1 = cleanName(home1);
  const a1 = cleanName(away1);
  const h2 = cleanName(home2);
  const a2 = cleanName(away2);

  // Exact or contains match on cleaned names
  const homeMatch = h1.includes(h2) || h2.includes(h1) || h1 === h2;
  const awayMatch = a1.includes(a2) || a2.includes(a1) || a1 === a2;

  if (homeMatch && awayMatch) return true;

  // Fallback: check if original names have intersection
  const wordsH1 = home1.toLowerCase().split(/\s+/);
  const wordsH2 = home2.toLowerCase().split(/\s+/);
  const wordsA1 = away1.toLowerCase().split(/\s+/);
  const wordsA2 = away2.toLowerCase().split(/\s+/);

  const homeIntersect = wordsH1.filter(w => w.length > 2 && wordsH2.includes(w)).length > 0;
  const awayIntersect = wordsA1.filter(w => w.length > 2 && wordsA2.includes(w)).length > 0;

  return homeIntersect && awayIntersect;
}

async function testMatch() {
  try {
    const apiFootballFixture = {
      date: '2026-05-24',
      home: 'Man City',
      away: 'Aston Villa'
    };

    console.log(`Searching for Sportmonks fixture matching: "${apiFootballFixture.home} vs ${apiFootballFixture.away}" on ${apiFootballFixture.date}`);

    const res = await axios.get(`https://api.sportmonks.com/v3/football/fixtures/date/${apiFootballFixture.date}?include=participants&filters=fixtureLeagues:8`, {
      headers: {
        'Authorization': TOKEN
      }
    });

    const fixtures = res.data.data;
    console.log(`Fetched ${fixtures.length} fixtures from Sportmonks.`);
    console.log('Fixture Names:');
    fixtures.forEach(f => console.log(`- ${f.name} (starting_at: ${f.starting_at})`));

    let matched = null;
    for (const f of fixtures) {
      const homeTeam = f.participants.find(p => p.meta.location === 'home');
      const awayTeam = f.participants.find(p => p.meta.location === 'away');
      if (!homeTeam || !awayTeam) continue;

      if (matchTeams(apiFootballFixture.home, apiFootballFixture.away, homeTeam.name, awayTeam.name)) {
        matched = f;
        break;
      }
    }

    if (matched) {
      console.log('Match Found!');
      console.log('Sportmonks Fixture ID:', matched.id);
      console.log('Sportmonks Fixture Name:', matched.name);
      console.log('Home:', matched.participants.find(p => p.meta.location === 'home').name);
      console.log('Away:', matched.participants.find(p => p.meta.location === 'away').name);
    } else {
      console.log('No match found.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testMatch();
