const axios = require('axios');

async function run() {
  try {
    const res = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        active: 'false',
        closed: 'true',
        limit: 5
      }
    });
    console.log('Got', res.data.length, 'closed events');
    if (res.data.length > 0) {
      const first = res.data[0];
      console.log('First Closed Event:', first.title);
      console.log('Markets inside:', first.markets?.map(m => ({ question: m.question, resolvedBy: m.resolvedBy, outcomePrices: m.outcomePrices })));
    }
  } catch (err) {
    console.error(err.message);
  }
}
run();
