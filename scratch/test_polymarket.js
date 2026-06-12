const axios = require('axios');

async function test() {
  try {
    console.log('Fetching events from Polymarket Gamma API...');
    const response = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        active: 'true',
        closed: 'false',
        limit: 5
      }
    });
    console.log('Events response count:', response.data.length);
    if (response.data.length > 0) {
      console.log('Sample Event Structure:');
      console.log(JSON.stringify(response.data[0], null, 2));
    }
  } catch (error) {
    console.error('Error fetching events:', error.message);
  }
}

test();
