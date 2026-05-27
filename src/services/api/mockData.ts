import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord, FixtureStatus } from '@/types/match';
import type { StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';
import { todayIsoDate } from '@/utils/date';
import { DEFAULT_LEAGUES } from '@/constants/leagues';

// Simple deterministic pseudo-random generator
function createRand(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
}

// 12 Leagues teams database
export const LEAGUE_TEAMS: Record<number, Array<{ id: number; name: string; logo: string }>> = {
  39: [ // Premier League
    { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' },
    { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png' },
    { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
    { id: 49, name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png' },
    { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
    { id: 47, name: 'Tottenham', logo: 'https://media.api-sports.io/football/teams/47.png' },
    { id: 46, name: 'Aston Villa', logo: 'https://media.api-sports.io/football/teams/46.png' },
    { id: 34, name: 'Newcastle', logo: 'https://media.api-sports.io/football/teams/34.png' }
  ],
  140: [ // La Liga
    { id: 541, name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
    { id: 529, name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
    { id: 530, name: 'Atletico Madrid', logo: 'https://media.api-sports.io/football/teams/530.png' },
    { id: 548, name: 'Real Sociedad', logo: 'https://media.api-sports.io/football/teams/548.png' },
    { id: 543, name: 'Real Betis', logo: 'https://media.api-sports.io/football/teams/543.png' },
    { id: 533, name: 'Villarreal', logo: 'https://media.api-sports.io/football/teams/533.png' },
    { id: 536, name: 'Sevilla', logo: 'https://media.api-sports.io/football/teams/536.png' },
    { id: 531, name: 'Athletic Bilbao', logo: 'https://media.api-sports.io/football/teams/531.png' }
  ],
  135: [ // Serie A
    { id: 496, name: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png' },
    { id: 489, name: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png' },
    { id: 505, name: 'Inter Milan', logo: 'https://media.api-sports.io/football/teams/505.png' },
    { id: 497, name: 'AS Roma', logo: 'https://media.api-sports.io/football/teams/497.png' },
    { id: 492, name: 'Napoli', logo: 'https://media.api-sports.io/football/teams/492.png' },
    { id: 487, name: 'Lazio', logo: 'https://media.api-sports.io/football/teams/487.png' },
    { id: 502, name: 'Fiorentina', logo: 'https://media.api-sports.io/football/teams/502.png' },
    { id: 499, name: 'Atalanta', logo: 'https://media.api-sports.io/football/teams/499.png' }
  ],
  136: [ // Serie B
    { id: 520, name: 'Palermo', logo: 'https://media.api-sports.io/football/teams/520.png' },
    { id: 518, name: 'Catanzaro', logo: 'https://media.api-sports.io/football/teams/518.png' },
    { id: 515, name: 'Cremonese', logo: 'https://media.api-sports.io/football/teams/515.png' },
    { id: 512, name: 'Venezia', logo: 'https://media.api-sports.io/football/teams/512.png' },
    { id: 516, name: 'Como', logo: 'https://media.api-sports.io/football/teams/516.png' },
    { id: 506, name: 'Sampdoria', logo: 'https://media.api-sports.io/football/teams/506.png' },
    { id: 503, name: 'Bari', logo: 'https://media.api-sports.io/football/teams/503.png' },
    { id: 510, name: 'Parma', logo: 'https://media.api-sports.io/football/teams/510.png' }
  ],
  78: [ // Bundesliga
    { id: 157, name: 'Bayern Munich', logo: 'https://media.api-sports.io/football/teams/157.png' },
    { id: 165, name: 'Borussia Dortmund', logo: 'https://media.api-sports.io/football/teams/165.png' },
    { id: 168, name: 'Bayer Leverkusen', logo: 'https://media.api-sports.io/football/teams/168.png' },
    { id: 173, name: 'RB Leipzig', logo: 'https://media.api-sports.io/football/teams/173.png' },
    { id: 169, name: 'Eintracht Frankfurt', logo: 'https://media.api-sports.io/football/teams/169.png' },
    { id: 172, name: 'Stuttgart', logo: 'https://media.api-sports.io/football/teams/172.png' },
    { id: 160, name: 'Freiburg', logo: 'https://media.api-sports.io/football/teams/160.png' },
    { id: 163, name: 'Mönchengladbach', logo: 'https://media.api-sports.io/football/teams/163.png' }
  ],
  61: [ // Ligue 1
    { id: 85, name: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
    { id: 81, name: 'Marseille', logo: 'https://media.api-sports.io/football/teams/81.png' },
    { id: 91, name: 'Monaco', logo: 'https://media.api-sports.io/football/teams/91.png' },
    { id: 80, name: 'Lyon', logo: 'https://media.api-sports.io/football/teams/80.png' },
    { id: 79, name: 'Lille', logo: 'https://media.api-sports.io/football/teams/79.png' },
    { id: 94, name: 'Lens', logo: 'https://media.api-sports.io/football/teams/94.png' },
    { id: 84, name: 'Nice', logo: 'https://media.api-sports.io/football/teams/84.png' },
    { id: 93, name: 'Rennes', logo: 'https://media.api-sports.io/football/teams/93.png' }
  ],
  88: [ // Eredivisie
    { id: 194, name: 'Ajax', logo: 'https://media.api-sports.io/football/teams/194.png' },
    { id: 197, name: 'PSV Eindhoven', logo: 'https://media.api-sports.io/football/teams/197.png' },
    { id: 201, name: 'Feyenoord', logo: 'https://media.api-sports.io/football/teams/201.png' },
    { id: 202, name: 'AZ Alkmaar', logo: 'https://media.api-sports.io/football/teams/202.png' },
    { id: 208, name: 'FC Utrecht', logo: 'https://media.api-sports.io/football/teams/208.png' },
    { id: 205, name: 'Twente', logo: 'https://media.api-sports.io/football/teams/205.png' },
    { id: 203, name: 'Vitesse', logo: 'https://media.api-sports.io/football/teams/203.png' },
    { id: 204, name: 'Heerenveen', logo: 'https://media.api-sports.io/football/teams/204.png' }
  ],
  94: [ // Primeira Liga
    { id: 211, name: 'Benfica', logo: 'https://media.api-sports.io/football/teams/211.png' },
    { id: 228, name: 'Sporting CP', logo: 'https://media.api-sports.io/football/teams/228.png' },
    { id: 212, name: 'FC Porto', logo: 'https://media.api-sports.io/football/teams/212.png' },
    { id: 217, name: 'Braga', logo: 'https://media.api-sports.io/football/teams/217.png' },
    { id: 224, name: 'Vitoria Guimaraes', logo: 'https://media.api-sports.io/football/teams/224.png' },
    { id: 219, name: 'Boavista', logo: 'https://media.api-sports.io/football/teams/219.png' },
    { id: 231, name: 'Famalicao', logo: 'https://media.api-sports.io/football/teams/231.png' },
    { id: 227, name: 'Gil Vicente', logo: 'https://media.api-sports.io/football/teams/227.png' }
  ],
  307: [ // Saudi Pro League
    { id: 290, name: 'Al Hilal', logo: 'https://media.api-sports.io/football/teams/290.png' },
    { id: 291, name: 'Al Nassr', logo: 'https://media.api-sports.io/football/teams/291.png' },
    { id: 292, name: 'Al Ittihad', logo: 'https://media.api-sports.io/football/teams/292.png' },
    { id: 293, name: 'Al Ahli SC', logo: 'https://media.api-sports.io/football/teams/293.png' },
    { id: 294, name: 'Al Shabab', logo: 'https://media.api-sports.io/football/teams/294.png' },
    { id: 295, name: 'Al Khaleej', logo: 'https://media.api-sports.io/football/teams/295.png' },
    { id: 296, name: 'Al Ettifaq', logo: 'https://media.api-sports.io/football/teams/296.png' },
    { id: 297, name: 'Al Taawoun', logo: 'https://media.api-sports.io/football/teams/297.png' }
  ],
  2: [ // UCL
    { id: 541, name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
    { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png' },
    { id: 157, name: 'Bayern Munich', logo: 'https://media.api-sports.io/football/teams/157.png' },
    { id: 85, name: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
    { id: 505, name: 'Inter Milan', logo: 'https://media.api-sports.io/football/teams/505.png' },
    { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
    { id: 529, name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
    { id: 530, name: 'Atletico Madrid', logo: 'https://media.api-sports.io/football/teams/530.png' }
  ],
  3: [ // UEL
    { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' },
    { id: 168, name: 'Leverkusen', logo: 'https://media.api-sports.io/football/teams/168.png' },
    { id: 48, name: 'West Ham', logo: 'https://media.api-sports.io/football/teams/48.png' },
    { id: 497, name: 'AS Roma', logo: 'https://media.api-sports.io/football/teams/497.png' },
    { id: 499, name: 'Atalanta', logo: 'https://media.api-sports.io/football/teams/499.png' },
    { id: 160, name: 'Freiburg', logo: 'https://media.api-sports.io/football/teams/160.png' },
    { id: 81, name: 'Marseille', logo: 'https://media.api-sports.io/football/teams/81.png' },
    { id: 211, name: 'Benfica', logo: 'https://media.api-sports.io/football/teams/211.png' }
  ],
  253: [ // MLS
    { id: 9991, name: 'Inter Miami', logo: 'https://media.api-sports.io/football/teams/9991.png' },
    { id: 9992, name: 'LA Galaxy', logo: 'https://media.api-sports.io/football/teams/9992.png' },
    { id: 9993, name: 'LAFC', logo: 'https://media.api-sports.io/football/teams/9993.png' },
    { id: 9994, name: 'Columbus Crew', logo: 'https://media.api-sports.io/football/teams/9994.png' },
    { id: 9995, name: 'FC Cincinnati', logo: 'https://media.api-sports.io/football/teams/9995.png' },
    { id: 9996, name: 'Seattle Sounders', logo: 'https://media.api-sports.io/football/teams/9996.png' },
    { id: 9997, name: 'NY Red Bulls', logo: 'https://media.api-sports.io/football/teams/9997.png' },
    { id: 9998, name: 'Orlando City', logo: 'https://media.api-sports.io/football/teams/9998.png' }
  ]
};

// Flatten database of teams for quick access
export const MOCK_TEAMS: Record<number, { id: number; name: string; logo: string }> = {};
Object.values(LEAGUE_TEAMS).forEach((teams) => {
  teams.forEach((t) => {
    MOCK_TEAMS[t.id] = t;
  });
});

export const MOCK_LEAGUES = Object.fromEntries(
  DEFAULT_LEAGUES.map((l) => [
    l.id,
    {
      id: l.id,
      name: l.name,
      country: l.country,
      logo: `https://media.api-sports.io/football/leagues/${l.id}.png`,
      season: 2024,
    }
  ])
);

// Simple global cache to persist mock matches for the current session
const generatedFixturesCache = new Map<string, Fixture[]>();

export const getMockFixturesBase = (dateStr?: string): Fixture[] => {
  const cleanDate = dateStr ? dateStr.split('T')[0] : todayIsoDate();
  if (generatedFixturesCache.has(cleanDate)) {
    return generatedFixturesCache.get(cleanDate)!;
  }

  const rand = createRand(cleanDate);
  const fixturesList: Fixture[] = [];
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
      let status: { long: string; short: FixtureStatus; elapsed: number | null } = {
        long: 'Not Started',
        short: 'NS',
        elapsed: null,
      };
      let homeGoals: number | null = null;
      let awayGoals: number | null = null;

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
            long: elapsed > 60 ? 'Second Half' : 'First Half',
            short: elapsed > 60 ? '2H' : '1H',
            elapsed: Math.min(elapsed > 60 ? elapsed - 15 : elapsed, 90),
          };
        }
        homeGoals = Math.floor(rand() * 3);
        awayGoals = Math.floor(rand() * 2);
      }

      const halftimeHome = homeGoals !== null ? Math.floor(homeGoals * 0.4) : null;
      const halftimeAway = awayGoals !== null ? Math.floor(awayGoals * 0.4) : null;

      const fixtureId = league.id * 10000 + idx + (cleanDate.replace(/-/g, '').slice(4) as any * 1);

      fixturesList.push({
        fixture: {
          id: fixtureId,
          timezone: 'Europe/Rome',
          date: matchDateStr,
          timestamp: kickoffMs / 1000,
          status,
          venue: { id: fixtureId, name: `Stadium of ${homeTeam.name}`, city: homeTeam.name },
        },
        league: {
          id: league.id,
          name: league.name,
          country: league.country,
          logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
          season: 2024,
          round: 'Matchday 14',
        },
        teams: {
          home: { ...homeTeam, winner: homeGoals !== null && awayGoals !== null ? homeGoals > awayGoals : null },
          away: { ...awayTeam, winner: homeGoals !== null && awayGoals !== null ? awayGoals > homeGoals : null },
        },
        goals: { home: homeGoals, away: awayGoals },
        score: {
          halftime: { home: halftimeHome, away: halftimeAway },
          fulltime: { home: homeGoals, away: awayGoals },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      });
    }
  });

  generatedFixturesCache.set(cleanDate, fixturesList);
  return fixturesList;
};

export const getMockFixtures = (date?: string, leagueId?: number): Fixture[] => {
  const all = getMockFixturesBase(date);
  if (leagueId) {
    return all.filter((f) => f.league.id === leagueId);
  }
  return all;
};

export const getMockLiveFixtures = (leagueIds?: number[]): Fixture[] => {
  const all = getMockFixturesBase();
  const live = all.filter((f) => ['1H', 'HT', '2H', 'ET', 'LIVE'].includes(f.fixture.status.short));
  if (leagueIds && leagueIds.length > 0) {
    return live.filter((f) => leagueIds.includes(f.league.id));
  }
  return live;
};

export const getMockFixtureById = (id: number): Fixture | null => {
  // Extract date if cached, otherwise check today and surrounding dates
  const datesToCheck = [
    todayIsoDate(),
    new Date(Date.now() - 86400000).toISOString().split('T')[0],
    new Date(Date.now() + 86400000).toISOString().split('T')[0],
  ];

  for (const d of datesToCheck) {
    const found = getMockFixturesBase(d).find((f) => f.fixture.id === id);
    if (found) return found;
  }
  return null;
};

export const getMockFixtureEvents = (fixtureId: number): FixtureEvent[] => {
  const fix = getMockFixtureById(fixtureId);
  if (!fix || fix.goals.home === null || fix.goals.away === null) return [];

  const events: FixtureEvent[] = [];
  const homeGoals = fix.goals.home;
  const awayGoals = fix.goals.away;

  for (let i = 0; i < homeGoals; i++) {
    events.push({
      time: { elapsed: 15 + i * 20 },
      team: fix.teams.home,
      player: { id: 10 + i, name: `Home Scorer ${i + 1}` },
      type: 'Goal',
      detail: 'Normal Goal',
    });
  }

  for (let i = 0; i < awayGoals; i++) {
    events.push({
      time: { elapsed: 22 + i * 25 },
      team: fix.teams.away,
      player: { id: 20 + i, name: `Away Scorer ${i + 1}` },
      type: 'Goal',
      detail: 'Normal Goal',
    });
  }

  events.sort((a, b) => a.time.elapsed - b.time.elapsed);
  return events;
};

export const getMockFixtureStats = (fixtureId: number): FixtureStatistic[] => {
  const fix = getMockFixtureById(fixtureId);
  if (!fix) return [];
  return [
    {
      team: fix.teams.home,
      statistics: [
        { type: 'Ball Possession', value: '54%' },
        { type: 'Total Shots', value: 12 },
        { type: 'Shots on Goal', value: 5 },
        { type: 'Fouls', value: 8 },
        { type: 'Corner Kicks', value: 5 },
        { type: 'Expected Goals', value: '1.45' },
      ],
    },
    {
      team: fix.teams.away,
      statistics: [
        { type: 'Ball Possession', value: '46%' },
        { type: 'Total Shots', value: 9 },
        { type: 'Shots on Goal', value: 3 },
        { type: 'Fouls', value: 11 },
        { type: 'Corner Kicks', value: 3 },
        { type: 'Expected Goals', value: '0.98' },
      ],
    },
  ];
};

export const getMockStandings = (leagueId: number): StandingRow[] => {
  const teams = LEAGUE_TEAMS[leagueId] || LEAGUE_TEAMS[39];
  return teams.map((team, idx) => {
    const rank = idx + 1;
    const played = 28;
    const win = 20 - idx * 2;
    const draw = 4 + (idx % 2);
    const lose = played - win - draw;
    const points = win * 3 + draw;
    const gFor = 64 - idx * 4;
    const gAgainst = 18 + idx * 3;
    const goalsDiff = gFor - gAgainst;
    const form = 'WWDWW';
    return {
      rank,
      team: { id: team.id, name: team.name, logo: team.logo },
      points,
      goalsDiff,
      form,
      all: { played, win, draw, lose, goals: { for: gFor, against: gAgainst } },
      home: { played: 14, win: Math.floor(win / 2), draw: Math.floor(draw / 2), lose: Math.floor(lose / 2), goals: { for: Math.floor(gFor / 2), against: Math.floor(gAgainst / 2) } },
      away: { played: 14, win: Math.ceil(win / 2), draw: Math.ceil(draw / 2), lose: Math.ceil(lose / 2), goals: { for: Math.ceil(gFor / 2), against: Math.ceil(gAgainst / 2) } },
    };
  });
};

export const getMockTeamLastFixtures = (teamId: number, last = 10): Fixture[] => {
  const team = MOCK_TEAMS[teamId] || { id: teamId, name: 'Team X', logo: '' };
  const opp = MOCK_TEAMS[49]; // Chelsea as fallback opponent
  return Array.from({ length: last }).map((_, i) => {
    const home = i % 2 === 0;
    const historicDate = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
    historicDate.setHours(20, 0, 0, 0);
    return {
      fixture: {
        id: 200000 + i + teamId * 100,
        timezone: 'Europe/Rome',
        date: historicDate.toISOString(),
        timestamp: Math.floor(historicDate.getTime() / 1000),
        status: { long: 'Match Finished', short: 'FT' as FixtureStatus, elapsed: 90 },
      },
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        logo: 'https://media.api-sports.io/football/leagues/39.png',
        season: 2024,
        round: 'Matchday ' + (30 - i),
      },
      teams: {
        home: { ...(home ? team : opp), winner: home ? true : false },
        away: { ...(home ? opp : team), winner: home ? false : true },
      },
      goals: { home: home ? 2 : 1, away: home ? 1 : 2 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: home ? 2 : 1, away: home ? 1 : 2 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    };
  });
};

export const getMockHeadToHead = (team1: number, team2: number, last = 5): H2HRecord[] => {
  const t1 = MOCK_TEAMS[team1] || { id: team1, name: 'Team 1', logo: '' };
  const t2 = MOCK_TEAMS[team2] || { id: team2, name: 'Team 2', logo: '' };
  return Array.from({ length: last }).map((_, i) => {
    const historicDate = new Date(Date.now() - (i + 10) * 24 * 60 * 60 * 1000);
    historicDate.setHours(20, 0, 0, 0);
    return {
      fixture: {
        id: 300000 + i,
        timezone: 'Europe/Rome',
        date: historicDate.toISOString(),
        timestamp: Math.floor(historicDate.getTime() / 1000),
        status: { long: 'Match Finished', short: 'FT' as FixtureStatus, elapsed: 90 },
      },
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        logo: 'https://media.api-sports.io/football/leagues/39.png',
        season: 2024,
        round: 'Regular Season',
      },
      teams: {
        home: { ...t1, winner: i % 2 === 0 },
        away: { ...t2, winner: i % 2 !== 0 },
      },
      goals: { home: i % 2 === 0 ? 2 : 1, away: i % 2 === 0 ? 1 : 2 },
    };
  });
};

export const getMockTeamStats = (teamId: number, leagueId: number): TeamStatistics => {
  const team = MOCK_TEAMS[teamId] || { id: teamId, name: 'Team', logo: '' };
  return {
    league: { id: leagueId, name: 'League', season: 2024 },
    team: { id: teamId, name: team.name, logo: team.logo },
    form: 'WWDWW',
    fixtures: {
      played: { home: 14, away: 14, total: 28 },
      wins: { home: 11, away: 9, total: 20 },
      draws: { home: 2, away: 2, total: 4 },
      loses: { home: 1, away: 3, total: 4 },
    },
    goals: {
      for: {
        total: { home: 32, away: 24, total: 56 },
        average: { home: '2.3', away: '1.7', total: '2.0' },
      },
      against: {
        total: { home: 9, away: 12, total: 21 },
        average: { home: '0.6', away: '0.9', total: '0.8' },
      },
    },
  };
};
