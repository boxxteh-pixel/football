const axios = require('axios');

async function test() {
  try {
    console.log('Searching public-search...');
    const searchRes = await axios.get('https://gamma-api.polymarket.com/public-search', {
      params: {
        q: 'trump'
      }
    });
    console.log('searchRes.data keys:', Object.keys(searchRes.data));
    console.log('searchRes.data type:', typeof searchRes.data);
    if (Array.isArray(searchRes.data)) {
      console.log('It is an array of length:', searchRes.data.length);
    } else {
      console.log('Sample data keys contents:', JSON.stringify(searchRes.data).substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
