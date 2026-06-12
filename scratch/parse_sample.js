const axios = require('axios');

async function test() {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        active: 'true',
        closed: 'false',
        limit: 1
      }
    });
    if (response.data.length > 0) {
      const event = response.data[0];
      console.log('Event keys:', Object.keys(event));
      console.log('Event title:', event.title);
      console.log('Event description:', event.description ? event.description.substring(0, 100) : 'none');
      console.log('Event image:', event.image);
      console.log('Event icon:', event.icon);
      
      if (event.markets && event.markets.length > 0) {
        const market = event.markets[0];
        console.log('\nMarket keys:', Object.keys(market));
        console.log('Market question:', market.question);
        console.log('Market outcomes type:', typeof market.outcomes, market.outcomes);
        console.log('Market outcomePrices type:', typeof market.outcomePrices, market.outcomePrices);
        console.log('Market clobTokenIds type:', typeof market.clobTokenIds, market.clobTokenIds);
        console.log('Market volumeNum:', market.volumeNum, typeof market.volumeNum);
        console.log('Market liquidityNum:', market.liquidityNum, typeof market.liquidityNum);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
