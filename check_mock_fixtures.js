// Simple mock testing


const DEFAULT_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
];

const LEAGUE_TEAMS = {
  39: [{ id: 33, name: 'Manchester United' }, { id: 50, name: 'Manchester City' }, { id: 46, name: 'Leicester' }, { id: 47, name: 'Tottenham' }, { id: 42, name: 'Arsenal' }, { id: 49, name: 'Chelsea' }],
  140: [{ id: 529, name: 'Barcelona' }, { id: 541, name: 'Real Madrid' }, { id: 530, name: 'Atletico Madrid' }, { id: 536, name: 'Sevilla' }, { id: 532, name: 'Valencia' }, { id: 538, name: 'Villarreal' }],
  135: [{ id: 496, name: 'Juventus' }, { id: 489, name: 'AC Milan' }, { id: 492, name: 'Napoli' }, { id: 505, name: 'Inter Milan' }, { id: 497, name: 'AS Roma' }, { id: 487, name: 'Lazio' }],
};

function format(date, fmt) {
  // Simple YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const todayIsoDate = () => format(new Date(), 'yyyy-MM-dd');

function createRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507) | 0;
    h = Math.imul(h ^ h >>> 13, 3266489909) | 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const generatedFixturesCache = new Map();

function getMockFixturesBase(dateStr) {
  const cleanDate = dateStr ? dateStr.split('T')[0] : todayIsoDate();
  if (generatedFixturesCache.has(cleanDate)) {
    return generatedFixturesCache.get(cleanDate);
  }

  const rand = createRand(cleanDate);
  const fixturesList = [];
  const nowMs = Date.now();
  const [year, month, day] = cleanDate.split('-').map(Number);

  DEFAULT_LEAGUES.forEach((league) => {
    const teams = LEAGUE_TEAMS[league.id] || LEAGUE_TEAMS[39];
    // Generate 3 fixtures per league
    for (let idx = 0; idx < 3; idx++) {
      const homeTeam = teams[(idx * 2) % teams.length];
      const awayTeam = teams[(idx * 2 + 1) % teams.length];

      // Distribute kickoff times: 15:00, 18:30, 20:45
      const hours = idx === 0 ? 15 : idx === 1 ? 18 : 20;
      const minutes = idx === 1 ? 30 : idx === 2 ? 45 : 0;
      
      const kickoffDate = new Date(year, month - 1, day, hours, minutes, 0);
      const kickoffMs = kickoffDate.getTime();
      const matchDateStr = kickoffDate.toISOString();

      // Calculate state relative to current real time
      let status = {
        long: 'Not Started',
        short: 'NS',
        elapsed: null,
      };
      let homeGoals = null;
      let awayGoals = null;

      const timeDiffMs = nowMs - kickoffMs;

      if (timeDiffMs > 110 * 60 * 1000) {
        // Finished
        status = { long: 'Match Finished', short: 'FT', elapsed: 90 };
        homeGoals = Math.floor(rand() * 4);
        awayGoals = Math.floor(rand() * 3);
      } else if (timeDiffMs > 0) {
        // Live
        const elapsed = Math.floor(timeDiffMs / (60 * 1000));
        if (elapsed > 45 && elapsed <= 60) {
          status = { long: 'Halftime', short: 'HT', elapsed: 45 };
        } else {
          status = {
            long: elapsed > 60 ? 'Second Half' : '1H', // mock
            short: elapsed > 60 ? '2H' : '1H',
            elapsed: Math.min(elapsed > 60 ? elapsed - 15 : elapsed, 90),
          };
        }
        homeGoals = Math.floor(rand() * 3);
        awayGoals = Math.floor(rand() * 2);
      }

      const halftimeHome = homeGoals !== null ? Math.floor(homeGoals * 0.4) : null;
      const halftimeAway = awayGoals !== null ? Math.floor(awayGoals * 0.4) : null;

      const fixtureId = league.id * 10000 + idx + (cleanDate.replace(/-/g, '').slice(4) * 1);

      fixturesList.push({
        fixture: {
          id: fixtureId,
          timezone: 'Europe/Rome',
          date: matchDateStr,
          timestamp: kickoffMs / 1000,
          status,
        },
        league: {
          id: league.id,
          name: league.name,
          country: league.country,
          season: 2024,
        },
        teams: {
          home: homeTeam,
          away: awayTeam,
        },
        goals: { home: homeGoals, away: awayGoals },
      });
    }
  });

  return fixturesList;
}

const mock = getMockFixturesBase();
console.log(`Mock returned ${mock.length} fixtures.`);
mock.forEach((f) => {
  console.log(`[Mock] ID: ${f.fixture.id} | ${f.teams.home.name} vs ${f.teams.away.name} | Date: ${f.fixture.date} | Timestamp: ${f.fixture.timestamp}`);
});
