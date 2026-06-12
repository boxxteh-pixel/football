const axios = require('axios');

async function run() {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/tags');
    console.log('Total tags:', response.data.length);
    const sorted = response.data.map(t => ({ id: t.id, label: t.label, slug: t.slug }));
    console.log(JSON.stringify(sorted, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
