const axios = require('axios');

const TOKEN = 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';

const TARGETS = [
  'premier league',
  'la liga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'eredivisie',
  'liga portugal',
  'primeira liga',
  'champions league',
  'europa league',
  'major league soccer'
];

async function test() {
  try {
    console.log('Querying Sportmonks Leagues...');
    let page = 1;
    let hasMore = true;
    const found = [];

    while (hasMore && page <= 25) {
      const res = await axios.get(`https://api.sportmonks.com/v3/football/leagues?page=${page}`, {
        headers: {
          'Authorization': TOKEN
        }
      });
      const leagues = res.data.data;
      if (!leagues || leagues.length === 0) break;

      leagues.forEach(l => {
        const nameLower = l.name.toLowerCase();
        const matches = TARGETS.some(t => nameLower.includes(t));
        if (matches) {
          found.push({ id: l.id, name: l.name, code: l.short_code });
        }
      });

      hasMore = res.data.pagination && res.data.pagination.has_more;
      page++;
    }

    console.log('Found leagues:');
    console.log(JSON.stringify(found, null, 2));
  } catch (err) {
    console.error('Error fetching leagues:', err.message);
  }
}

test();

