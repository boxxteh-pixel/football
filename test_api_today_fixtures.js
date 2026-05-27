const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const API_KEY = process.env.EXPO_PUBLIC_SPORTMONKS_KEY || 'vIPRgqtcB3MivtuDSJ9Xv82CjkPfF8nUXFiF6AfV9Z7egDDCx8FMGcRbTPZm';
const cleanDate = '2026-05-20';

const LEAGUE_MAP = {
  39: 8,     // Premier League (EPL)
  140: 564,  // La Liga
  135: 384,  // Serie A
  136: 387,  // Serie B
  78: 82,    // Bundesliga
  61: 301,   // Ligue 1
  88: 72,    // Eredivisie
  94: 462,   // Liga Portugal / Primeira Liga
  307: 944,  // Saudi Professional League (Saudi Pro)
  2: 2,      // UEFA Champions League
  3: 5,      // UEFA Europa League
  253: 779,  // Major League Soccer (MLS)
};

const INVERSE_LEAGUE_MAP = Object.fromEntries(
  Object.entries(LEAGUE_MAP).map(([apiId, smId]) => [smId, Number(apiId)])
);

const sportmonksClient = axios.create({
  baseURL: 'https://api.sportmonks.com/v3/football',
  headers: {
    'Authorization': API_KEY,
  },
  timeout: 15000,
});

function mapTeam(p) {
  return {
    id: p.id,
    name: p.name,
    logo: p.image_path || '',
  };
}

function mapSportmonksFixture(sm) {
  const participants = sm.participants || [];
  const home = participants.find((p) => p.meta?.location === 'home') || participants[0] || {};
  const away = participants.find((p) => p.meta?.location === 'away') || participants[1] || {};

  const scores = sm.scores || [];
  let homeScore = null;
  let awayScore = null;

  scores.forEach((s) => {
    if (s.participant_id === home.id) {
      if (s.description === 'CURRENT' || s.type_id === 1528) homeScore = s.score?.goals;
    } else if (s.participant_id === away.id) {
      if (s.description === 'CURRENT' || s.type_id === 1528) awayScore = s.score?.goals;
    }
  });

  const smStatus = sm.state?.short_name || sm.state?.state || 'NS';
  let apiFootballStatus = 'NS';
  if (smStatus === 'LIVE' || smStatus === 'INPLAY' || smStatus === '1H' || smStatus === '2H') {
    apiFootballStatus = 'LIVE';
  } else if (smStatus === 'HT') {
    apiFootballStatus = 'HT';
  } else if (smStatus === 'FT' || smStatus === 'ENDED') {
    apiFootballStatus = 'FT';
  }

  const homeWinner = home.meta?.winner ?? (homeScore !== null && awayScore !== null ? homeScore > awayScore : null);
  const awayWinner = away.meta?.winner ?? (homeScore !== null && awayScore !== null ? awayScore > homeScore : null);

  return {
    fixture: {
      id: sm.id,
      timezone: 'Europe/London',
      date: sm.starting_at_timestamp
        ? new Date(sm.starting_at_timestamp * 1000).toISOString()
        : new Date().toISOString(),
      timestamp: sm.starting_at_timestamp || Math.floor(Date.now() / 1000),
      status: {
        long: sm.state?.name || 'Not Started',
        short: apiFootballStatus,
        elapsed: sm.minute || null,
      },
    },
    league: {
      id: INVERSE_LEAGUE_MAP[sm.league?.id || sm.league_id || 0] || sm.league?.id || sm.league_id || 0,
      name: sm.league?.name || 'League',
      season: sm.season_id || 2024,
    },
    teams: {
      home: {
        ...mapTeam(home),
        winner: homeWinner,
      },
      away: {
        ...mapTeam(away),
        winner: awayWinner,
      },
    },
    goals: {
      home: homeScore,
      away: awayScore,
    },
  };
}

async function run() {
  console.log('Querying Sportmonks for date:', cleanDate);
  const url = `/fixtures/date/${cleanDate}?include=participants;league;venue;state;scores`;
  const response = await sportmonksClient.get(url);
  const data = response.data?.data || [];
  const smFixtures = data.map(mapSportmonksFixture);
  console.log(`Sportmonks returned ${smFixtures.length} fixtures.`);

  // Load mock data logic
  // Let's see: we want to simulate the fallback/merge logic
  console.log('Done!');
}

run();
