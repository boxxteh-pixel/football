import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord } from '@/types/match';
import type { StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';
import { todayIsoDate } from '@/utils/date';

// Real API-Football IDs
export const MOCK_TEAMS = {
  // EPL
  42: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
  49: { id: 49, name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png' },
  40: { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' },
  50: { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png' },
  33: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png' },
  47: { id: 47, name: 'Tottenham', logo: 'https://media.api-sports.io/football/teams/47.png' },
  // La Liga
  541: { id: 541, name: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
  529: { id: 529, name: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
  530: { id: 530, name: 'Atletico Madrid', logo: 'https://media.api-sports.io/football/teams/530.png' },
  548: { id: 548, name: 'Real Sociedad', logo: 'https://media.api-sports.io/football/teams/548.png' },
  // Serie A
  496: { id: 496, name: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png' },
  489: { id: 489, name: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png' },
  505: { id: 505, name: 'Inter Milan', logo: 'https://media.api-sports.io/football/teams/505.png' },
  497: { id: 497, name: 'AS Roma', logo: 'https://media.api-sports.io/football/teams/497.png' },
  // UCL & others
  157: { id: 157, name: 'Bayern Munich', logo: 'https://media.api-sports.io/football/teams/157.png' },
  85: { id: 85, name: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
} as const;

export const MOCK_LEAGUES = {
  39: { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png', season: 2024 },
  140: { id: 140, name: 'La Liga', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png', season: 2024 },
  135: { id: 135, name: 'Serie A', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png', season: 2024 },
  2: { id: 2, name: 'UEFA Champions League', country: 'Europe', logo: 'https://media.api-sports.io/football/leagues/2.png', season: 2024 },
} as const;

// Create static fixtures list
const getMockFixturesBase = (): Fixture[] => [
  {
    fixture: {
      id: 100001,
      timezone: 'Europe/London',
      date: `${todayIsoDate()}T20:00:00+01:00`,
      timestamp: Date.now() / 1000 - 3600, // Started 1 hour ago
      status: { long: 'Second Half', short: '2H', elapsed: 65 },
      venue: { id: 1, name: 'Anfield', city: 'Liverpool' },
    },
    league: { ...MOCK_LEAGUES[39], round: 'Matchday 32' },
    teams: {
      home: { ...MOCK_TEAMS[40], winner: true },
      away: { ...MOCK_TEAMS[33], winner: false },
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  },
  {
    fixture: {
      id: 100002,
      timezone: 'Europe/London',
      date: `${todayIsoDate()}T21:00:00+01:00`,
      timestamp: Date.now() / 1000 + 7200, // Starts in 2 hours
      status: { long: 'Not Started', short: 'NS', elapsed: null },
      venue: { id: 2, name: 'Santiago Bernabéu', city: 'Madrid' },
    },
    league: { ...MOCK_LEAGUES[140], round: 'Matchday 32' },
    teams: {
      home: { ...MOCK_TEAMS[541], winner: null },
      away: { ...MOCK_TEAMS[529], winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  },
  {
    fixture: {
      id: 100003,
      timezone: 'Europe/London',
      date: `${todayIsoDate()}T18:00:00+01:00`,
      timestamp: Date.now() / 1000 - 10800, // Finished 3 hours ago
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
      venue: { id: 3, name: 'San Siro', city: 'Milan' },
    },
    league: { ...MOCK_LEAGUES[135], round: 'Matchday 32' },
    teams: {
      home: { ...MOCK_TEAMS[489], winner: false },
      away: { ...MOCK_TEAMS[505], winner: true },
    },
    goals: { home: 0, away: 2 },
    score: {
      halftime: { home: 0, away: 1 },
      fulltime: { home: 0, away: 2 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  },
  {
    fixture: {
      id: 100004,
      timezone: 'Europe/London',
      date: `${todayIsoDate()}T21:00:00+01:00`,
      timestamp: Date.now() / 1000 + 3600, // Starts in 1 hour
      status: { long: 'Not Started', short: 'NS', elapsed: null },
      venue: { id: 4, name: 'Emirates Stadium', city: 'London' },
    },
    league: { ...MOCK_LEAGUES[39], round: 'Matchday 32' },
    teams: {
      home: { ...MOCK_TEAMS[42], winner: null },
      away: { ...MOCK_TEAMS[49], winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  },
  {
    fixture: {
      id: 100005,
      timezone: 'Europe/London',
      date: `${todayIsoDate()}T21:00:00+01:00`,
      timestamp: Date.now() / 1000 + 10800, // Starts in 3 hours
      status: { long: 'Not Started', short: 'NS', elapsed: null },
      venue: { id: 5, name: 'Allianz Arena', city: 'Munich' },
    },
    league: { ...MOCK_LEAGUES[2], round: 'Quarter-finals' },
    teams: {
      home: { ...MOCK_TEAMS[157], winner: null },
      away: { ...MOCK_TEAMS[85], winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  },
];

export const getMockFixtures = (date?: string, leagueId?: number): Fixture[] => {
  const all = getMockFixturesBase();
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
  return getMockFixturesBase().find((f) => f.fixture.id === id) ?? null;
};

export const getMockFixtureEvents = (fixtureId: number): FixtureEvent[] => {
  const fix = getMockFixtureById(fixtureId);
  if (!fix) return [];
  return [
    {
      time: { elapsed: 24 },
      team: fix.teams.home,
      player: { id: 1, name: 'Mohamed Salah' },
      type: 'Goal',
      detail: 'Normal Goal',
    },
    {
      time: { elapsed: 41 },
      team: fix.teams.away,
      player: { id: 2, name: 'Bruno Fernandes' },
      type: 'Card',
      detail: 'Yellow Card',
    },
    {
      time: { elapsed: 52 },
      team: fix.teams.away,
      player: { id: 3, name: 'Marcus Rashford' },
      assist: { id: 4, name: 'Bruno Fernandes' },
      type: 'Goal',
      detail: 'Normal Goal',
    },
    {
      time: { elapsed: 61 },
      team: fix.teams.home,
      player: { id: 5, name: 'Luis Díaz' },
      assist: { id: 6, name: 'Alexis Mac Allister' },
      type: 'Goal',
      detail: 'Normal Goal',
    },
  ];
};

export const getMockFixtureStats = (fixtureId: number): FixtureStatistic[] => {
  const fix = getMockFixtureById(fixtureId);
  if (!fix) return [];
  return [
    {
      team: fix.teams.home,
      statistics: [
        { type: 'Ball Possession', value: '58%' },
        { type: 'Total Shots', value: 16 },
        { type: 'Shots on Goal', value: 7 },
        { type: 'Fouls', value: 9 },
        { type: 'Corner Kicks', value: 6 },
        { type: 'Expected Goals', value: '1.92' },
      ],
    },
    {
      team: fix.teams.away,
      statistics: [
        { type: 'Ball Possession', value: '42%' },
        { type: 'Total Shots', value: 8 },
        { type: 'Shots on Goal', value: 3 },
        { type: 'Fouls', value: 12 },
        { type: 'Corner Kicks', value: 2 },
        { type: 'Expected Goals', value: '0.84' },
      ],
    },
  ];
};

export const getMockStandings = (leagueId: number): StandingRow[] => {
  const teams = Object.values(MOCK_TEAMS).slice(0, 10);
  return teams.map((team, idx) => {
    const rank = idx + 1;
    const played = 31;
    const win = 24 - idx * 2;
    const draw = 4 + (idx % 2);
    const lose = played - win - draw;
    const points = win * 3 + draw;
    const gFor = 78 - idx * 5;
    const gAgainst = 22 + idx * 3;
    const goalsDiff = gFor - gAgainst;
    const form = 'WWDWL'.slice(idx % 2) + 'W';
    return {
      rank,
      team: { id: team.id, name: team.name, logo: team.logo },
      points,
      goalsDiff,
      form,
      all: { played, win, draw, lose, goals: { for: gFor, against: gAgainst } },
      home: { played: 15, win: Math.floor(win / 2), draw: Math.floor(draw / 2), lose: Math.floor(lose / 2), goals: { for: Math.floor(gFor / 2), against: Math.floor(gAgainst / 2) } },
      away: { played: 16, win: Math.ceil(win / 2), draw: Math.ceil(draw / 2), lose: Math.ceil(lose / 2), goals: { for: Math.ceil(gFor / 2), against: Math.ceil(gAgainst / 2) } },
    };
  });
};

export const getMockTeamLastFixtures = (teamId: number, last = 10): Fixture[] => {
  const team = MOCK_TEAMS[teamId as keyof typeof MOCK_TEAMS] || { id: teamId, name: 'Team X', logo: '' };
  const opp = MOCK_TEAMS[49]; // Chelsea as generic opponent
  return Array.from({ length: last }).map((_, i) => ({
    fixture: {
      id: 200000 + i,
      timezone: 'Europe/London',
      date: `2024-05-1${i}T19:45:00+01:00`,
      timestamp: Date.now() / 1000 - (i + 1) * 86400,
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: { ...MOCK_LEAGUES[39], round: 'Matchday ' + (30 - i) },
    teams: {
      home: { ...team, winner: i % 3 !== 2 },
      away: { ...opp, winner: i % 3 === 2 },
    },
    goals: { home: i % 3 === 2 ? 0 : 2, away: i % 3 === 2 ? 1 : 0 },
    score: {
      halftime: { home: 0, away: 0 },
      fulltime: { home: i % 3 === 2 ? 0 : 2, away: i % 3 === 2 ? 1 : 0 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  }));
};

export const getMockHeadToHead = (team1: number, team2: number, last = 5): H2HRecord[] => {
  const t1 = MOCK_TEAMS[team1 as keyof typeof MOCK_TEAMS] || { id: team1, name: 'Team 1', logo: '' };
  const t2 = MOCK_TEAMS[team2 as keyof typeof MOCK_TEAMS] || { id: team2, name: 'Team 2', logo: '' };
  return Array.from({ length: last }).map((_, i) => ({
    fixture: {
      id: 300000 + i,
      timezone: 'Europe/London',
      date: `2024-03-1${i}T20:00:00+01:00`,
      timestamp: Date.now() / 1000 - (i + 10) * 86400,
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: { ...MOCK_LEAGUES[39], round: 'Regular Season' },
    teams: {
      home: { ...t1, winner: i % 2 === 0 },
      away: { ...t2, winner: i % 2 !== 0 },
    },
    goals: { home: i % 2 === 0 ? 2 : 1, away: i % 2 === 0 ? 1 : 2 },
  }));
};

export const getMockTeamStats = (teamId: number, leagueId: number): TeamStatistics => {
  const team = MOCK_TEAMS[teamId as keyof typeof MOCK_TEAMS] || { id: teamId, name: 'Team', logo: '' };
  return {
    league: { id: leagueId, name: 'League', season: 2024 },
    team: { id: teamId, name: team.name, logo: team.logo },
    form: 'WWDWW',
    fixtures: {
      played: { home: 15, away: 16, total: 31 },
      wins: { home: 12, away: 10, total: 22 },
      draws: { home: 2, away: 4, total: 6 },
      loses: { home: 1, away: 2, total: 3 },
    },
    goals: {
      for: {
        total: { home: 38, away: 28, total: 66 },
        average: { home: '2.5', away: '1.8', total: '2.1' },
      },
      against: {
        total: { home: 10, away: 14, total: 24 },
        average: { home: '0.7', away: '0.9', total: '0.8' },
      },
    },
  };
};
