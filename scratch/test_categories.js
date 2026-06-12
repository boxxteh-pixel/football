const axios = require('axios');

async function run() {
  try {
    const res = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        active: 'true',
        closed: 'false',
        limit: 15,
        featured: 'true'
      }
    });
    console.log('Got', res.data.length, 'featured events');
    res.data.forEach(e => {
      console.log(`- [${e.id}] ${e.title} (Volume: ${e.volume}, Markets: ${e.markets?.length}, Tags: ${e.tags?.map(t => t.label).join(', ')})`);
    });
  } catch (err) {
    console.error(err.message);
  }
}
run();
