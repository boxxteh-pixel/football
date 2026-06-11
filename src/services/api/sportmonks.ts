import axios from 'axios';
import { Platform } from 'react-native';
import { config, getSportmonksKey, getSportmonksBaseUrl, isCricketMode } from '@/constants/config';
import { LEAGUE_TO_SPORTMONKS, SPORTMONKS_TO_LEAGUE } from '@/constants/leagues';
import { smGet, TTL } from './smClient';
import { STATE_TO_STATUS } from './smTypes';

// Maps internal (API-Football style) league IDs to Sportmonks league IDs.
// Single source of truth lives in '@/constants/leagues'.
export const LEAGUE_MAP: Record<number, number> = LEAGUE_TO_SPORTMONKS;

export const INVERSE_LEAGUE_MAP: Record<number, number> = SPORTMONKS_TO_LEAGUE;

/**
 * SportMonks caps the `fixtureLeagues` filter at 50 IDs per request. Split a
 * league-ID list into ≤50 chunks so we never trigger a 400 "Error parsing
 * filters" once the app tracks more than 50 leagues.
 */
const LEAGUE_FILTER_MAX = 50;
const chunkLeagueIds = (ids: number[], size = LEAGUE_FILTER_MAX): number[][] => {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
};

export interface SportmonksPredictionParsed {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  bttsPct: number;
  over25Pct: number;
  under25Pct: number;
  correctScores: Array<{ score: string; probability: number }>;
  doubleChance?: { homeDraw: number; awayDraw: number; homeAway: number };
  halfTimeResult?: { home: number; draw: number; away: number };
  teamToScoreFirst?: { home: number; away: number; draw: number };
  cornersOverUnder?: Array<{ label: string; probability: number }>;
  overUnderGoals?: Array<{ label: string; probability: number }>;
  predictionsCount: number;
}

/**
 * Normalizes team names to make them comparable under fuzzy matching.
 */
function cleanName(name: string): string {
  return name.toLowerCase()
    .replace(/\b(fc|cf|afc|ud|sc|fk|ac|rc|ca|as|ssc|celta|de|real|club|athletic|atlético|atletico|city|united|town|hotspur|rovers|wanderers|albion|forest|palace|villa|ham|ajax|feyenoord|psv|sporting|benfica|porto|braga|rio|ave|estoril|boavista|famalicao|portimonense|chaves|vizela|arouca|gil|vicente|farense|moreirense|estrada|bayer|bayern|borussia|schalke|werder|stuttgart|mainz|wolfsburg|frankfurt|freiburg|hoffenheim|augsburg|leipzig|koln|cologne|bochum|darmstadt|heidenheim|psg|paris|marseille|monaco|lyon|lille|lens|rennes|nice|reims|strasbourg|toulouse|montpellier|lorient|nantes|le|havre|brest|clermont|metz)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Fuzzy matches team names from API-Football vs Sportmonks.
 */
function matchTeams(home1: string, away1: string, home2: string, away2: string): boolean {
  const h1 = cleanName(home1);
  const a1 = cleanName(away1);
  const h2 = cleanName(home2);
  const a2 = cleanName(away2);

  const homeMatch = h1.includes(h2) || h2.includes(h1) || h1 === h2;
  const awayMatch = a1.includes(a2) || a2.includes(a1) || a1 === a2;

  if (homeMatch && awayMatch) return true;

  // Word-level intersection fallback
  const wordsH1 = home1.toLowerCase().split(/\s+/);
  const wordsH2 = home2.toLowerCase().split(/\s+/);
  const wordsA1 = away1.toLowerCase().split(/\s+/);
  const wordsA2 = away2.toLowerCase().split(/\s+/);

  const homeIntersect = wordsH1.filter(w => w.length > 2 && wordsH2.includes(w)).length > 0;
  const awayIntersect = wordsA1.filter(w => w.length > 2 && wordsA2.includes(w)).length > 0;

  return homeIntersect && awayIntersect;
}

/**
 * Fetches and parses fixture predictions from Sportmonks for a given date and teams.
 */
export const fetchSportmonksPredictions = async (
  date: string,
  homeTeamName: string,
  awayTeamName: string,
  apiFootballLeagueId?: number
): Promise<SportmonksPredictionParsed | null> => {
  try {
    const activeKey = getSportmonksKey();
    if (!activeKey) {
      console.log('[Sportmonks] Missing token in environment, skipping.');
      return null;
    }

    const cleanDate = date.split('T')[0];
    const sportmonksLeagueId = apiFootballLeagueId ? LEAGUE_MAP[apiFootballLeagueId] : undefined;

    const isLocalWeb = Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.port === '8081' || window.location.port === '8082');
    const baseUrl = (Platform.OS === 'web' && !isLocalWeb) ? '/api/sportmonks' : getSportmonksBaseUrl();
    let url = `${baseUrl}/fixtures/date/${cleanDate}?include=participants;predictions.type`;
    if (sportmonksLeagueId) {
      url += `&filters=leagues:${sportmonksLeagueId}`;
    }

    console.log(`[Sportmonks] Fetching fixtures for date ${cleanDate}...`);
    const response = await axios.get(url, {
      headers: {
        'Authorization': activeKey,
      },
      timeout: 10000,
    });

    const fixtures = response.data?.data;
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      console.log('[Sportmonks] No fixtures found on this date.');
      return null;
    }

    // Fuzzy match fixture
    let matchedFixture = null;
    for (const f of fixtures) {
      const participants = f.participants || [];
      const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
      const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
      if (!homeTeam || !awayTeam) continue;

      if (matchTeams(homeTeamName, awayTeamName, homeTeam.name, awayTeam.name)) {
        matchedFixture = f;
        break;
      }
    }

    if (!matchedFixture) {
      console.log(`[Sportmonks] No fuzzy match found for ${homeTeamName} vs ${awayTeamName} on ${cleanDate}`);
      // Fallback: If we had a league filter, try once more without it to catch rescheduled matches
      if (sportmonksLeagueId) {
        return fetchSportmonksPredictions(date, homeTeamName, awayTeamName, undefined);
      }
      return null;
    }

    console.log(`[Sportmonks] Matched fixture: ${matchedFixture.name} (ID: ${matchedFixture.id})`);
    const rawPredictions = matchedFixture.predictions || [];
    if (rawPredictions.length === 0) {
      console.log('[Sportmonks] No predictions found on matched fixture.');
      return null;
    }

    // Initialize prediction variables with standard defaults
    let homeWinPct = 33.3;
    let drawPct = 33.3;
    let awayWinPct = 33.3;
    let bttsPct = 50;
    let over25Pct = 50;
    let under25Pct = 50;
    const correctScores: Array<{ score: string; probability: number }> = [];
    let doubleChance: SportmonksPredictionParsed['doubleChance'] = undefined;
    let halfTimeResult: SportmonksPredictionParsed['halfTimeResult'] = undefined;
    let teamToScoreFirst: SportmonksPredictionParsed['teamToScoreFirst'] = undefined;
    const cornersOverUnder: Array<{ label: string; probability: number }> = [];
    const overUnderGoals: Array<{ label: string; probability: number }> = [];

    rawPredictions.forEach((pred: any) => {
      const typeId = pred.type_id;
      const data = pred.predictions;
      if (!data) return;

      switch (typeId) {
        case 237: // Fulltime Result
          if (typeof data.home === 'number') homeWinPct = data.home;
          if (typeof data.draw === 'number') drawPct = data.draw;
          if (typeof data.away === 'number') awayWinPct = data.away;
          break;
        case 231: // Both Teams To Score
          if (typeof data.yes === 'number') bttsPct = data.yes;
          break;
        case 235: // Over/Under 2.5
          if (typeof data.yes === 'number') {
            over25Pct = data.yes;
            under25Pct = data.no ?? (100 - data.yes);
          }
          break;
        case 240: // Correct Score
          if (data.scores && typeof data.scores === 'object') {
            Object.entries(data.scores).forEach(([score, val]) => {
              if (typeof val === 'number') {
                correctScores.push({ score, probability: val });
              }
            });
            // Sort correct scores descending by probability
            correctScores.sort((a, b) => b.probability - a.probability);
          }
          break;
        case 239: // Double Chance
          if (typeof data.draw_home === 'number') {
            doubleChance = {
              homeDraw: data.draw_home,
              awayDraw: data.draw_away || 0,
              homeAway: data.home_away || 0,
            };
          }
          break;
        case 233: // First Half Winner
          if (typeof data.home === 'number') {
            halfTimeResult = {
              home: data.home,
              draw: data.draw || 0,
              away: data.away || 0,
            };
          }
          break;
        case 238: // Team To Score First
          if (typeof data.home === 'number') {
            teamToScoreFirst = {
              home: data.home,
              away: data.away || 0,
              draw: data.draw || 0,
            };
          }
          break;
        // Goal Over/Unders
        case 234: // 1.5
          if (typeof data.yes === 'number') overUnderGoals.push({ label: 'Over 1.5', probability: data.yes });
          break;
        case 236: // 3.5
          if (typeof data.yes === 'number') overUnderGoals.push({ label: 'Over 3.5', probability: data.yes });
          break;
        case 1679: // 4.5
          if (typeof data.yes === 'number') overUnderGoals.push({ label: 'Over 4.5', probability: data.yes });
          break;
        // Corner Over/Unders
        case 1690: // 4
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 4.5', probability: data.yes });
          break;
        case 1683: // 5
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 5.5', probability: data.yes });
          break;
        case 1685: // 6
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 6.5', probability: data.yes });
          break;
        case 1686: // 7
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 7.5', probability: data.yes });
          break;
        case 1689: // 8
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 8.5', probability: data.yes });
          break;
        case 1687: // 9
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 9.5', probability: data.yes });
          break;
        case 1688: // 10
          if (typeof data.yes === 'number') cornersOverUnder.push({ label: 'Over 10.5', probability: data.yes });
          break;
      }
    });

    // Make sure we sort overUnderGoals and cornersOverUnder
    overUnderGoals.sort((a, b) => {
      const aVal = parseFloat(a.label.split(' ')[1]);
      const bVal = parseFloat(b.label.split(' ')[1]);
      return aVal - bVal;
    });

    cornersOverUnder.sort((a, b) => {
      const aVal = parseFloat(a.label.split(' ')[1]);
      const bVal = parseFloat(b.label.split(' ')[1]);
      return aVal - bVal;
    });

    return {
      homeWinPct,
      drawPct,
      awayWinPct,
      bttsPct,
      over25Pct,
      under25Pct,
      correctScores: correctScores.slice(0, 10), // keep top 10 correct scores
      doubleChance,
      halfTimeResult,
      teamToScoreFirst,
      cornersOverUnder,
      overUnderGoals,
      predictionsCount: rawPredictions.length,
    };
  } catch (err: any) {
    console.error('[Sportmonks] Error fetching predictions:', err.message);
    return null;
  }
};

// ==========================================
// SPORTMONKS TO API-FOOTBALL DATA ADAPTERS
// ==========================================

import type { Fixture, FixtureEvent, FixtureStatistic, H2HRecord, FixtureStatus } from '@/types/match';
import type { StandingRow } from '@/types/league';
import type { TeamStatistics } from '@/types/team';

const isLocalWebClient = Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.port === '8081' || window.location.port === '8082');

const sportmonksClient = axios.create({
  timeout: 15000,
});

sportmonksClient.interceptors.request.use((req) => {
  const cricket = isCricketMode();
  const activeBaseUrl = (Platform.OS === 'web' && !isLocalWebClient && !cricket) ? '/api/sportmonks' : getSportmonksBaseUrl();
  req.baseURL = activeBaseUrl;
  
  if (!req.headers) req.headers = {} as any;
  if (cricket) {
    // Cricket API v2 uses api_token query parameter
    if (!req.params) req.params = {};
    req.params.api_token = getSportmonksKey();
  } else if (!(Platform.OS === 'web' && !isLocalWebClient)) {
    req.headers.Authorization = getSportmonksKey();
  }
  return req;
});

// ==========================================
// CRICKET V2 FIXTURE MAPPER
// ==========================================

/**
 * Maps a SportMonks Cricket API v2 fixture response object to our universal
 * Fixture type. Cricket uses localteam/visitorteam, runs for scoring, and
 * different status strings compared to the football v3 API.
 */
function mapCricketFixture(cf: any): Fixture {
  const localTeam = cf.localteam || {};
  const visitorTeam = cf.visitorteam || {};

  // Runs array contains innings. Sum per team for total score.
  const runs: any[] = cf.runs || [];
  let homeRuns: number | null = null;
  let awayRuns: number | null = null;
  runs.forEach((r: any) => {
    if (r.team_id === localTeam.id) {
      homeRuns = (homeRuns ?? 0) + (r.score ?? 0);
    } else if (r.team_id === visitorTeam.id) {
      awayRuns = (awayRuns ?? 0) + (r.score ?? 0);
    }
  });

  // Map cricket statuses
  const rawStatus: string = (cf.status || 'NS').toUpperCase();
  let mappedStatus: FixtureStatus = 'NS';
  if (rawStatus === 'FINISHED' || rawStatus === 'FT') mappedStatus = 'FT';
  else if (rawStatus === 'LIVE' || rawStatus.includes('INPLAY') || rawStatus === '1ST INNINGS' || rawStatus === '2ND INNINGS') mappedStatus = 'LIVE';
  else if (rawStatus === 'NS' || rawStatus === 'NOT STARTED') mappedStatus = 'NS';
  else if (rawStatus === 'CANCELLED' || rawStatus === 'CANC') mappedStatus = 'CANC';
  else if (rawStatus === 'POSTPONED' || rawStatus === 'PST') mappedStatus = 'PST';
  else if (rawStatus === 'ABANDONED' || rawStatus === 'ABD') mappedStatus = 'ABD';
  else if (rawStatus === 'DELAYED' || rawStatus === 'INT' || rawStatus === 'INTERRUPTED') mappedStatus = 'INT';

  const startingAt = cf.starting_at ? new Date(cf.starting_at).toISOString() : new Date().toISOString();
  const timestamp = cf.starting_at ? Math.floor(new Date(cf.starting_at).getTime() / 1000) : Math.floor(Date.now() / 1000);

  const homeWinner = homeRuns !== null && awayRuns !== null ? homeRuns > awayRuns : null;
  const awayWinner = homeRuns !== null && awayRuns !== null ? awayRuns > homeRuns : null;

  return {
    fixture: {
      id: cf.id,
      referee: null,
      timezone: 'UTC',
      date: startingAt,
      timestamp,
      periods: { first: null, second: null },
      venue: {
        id: cf.venue_id || null,
        name: cf.venue?.name || null,
        city: cf.venue?.city || null,
      },
      status: {
        long: cf.status || 'Not Started',
        short: mappedStatus,
        elapsed: null,
      },
    },
    league: {
      id: cf.league_id || 0,
      name: cf.league?.name || 'Cricket',
      country: cf.league?.country?.name || 'International',
      logo: cf.league?.image_path || '',
      season: cf.season_id || 0,
      round: cf.round || '',
    },
    teams: {
      home: { id: localTeam.id || 0, name: localTeam.name || 'Team A', logo: localTeam.image_path || '', winner: homeWinner },
      away: { id: visitorTeam.id || 0, name: visitorTeam.name || 'Team B', logo: visitorTeam.image_path || '', winner: awayWinner },
    },
    goals: { home: homeRuns, away: awayRuns },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: homeRuns, away: awayRuns },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

/** Select the correct mapper based on current sport mode. */
const mapFixtureAuto = (raw: any): Fixture => {
  return isCricketMode() ? mapCricketFixture(raw) : mapSportmonksFixture(raw);
};

function mapTeam(p: any) {
  return {
    id: p?.id || 0,
    name: p?.name || 'Unknown Team',
    logo: p?.image_path || '',
  };
}

export function mapSportmonksFixture(sm: any): Fixture {
  const participants = sm.participants || [];
  const home = participants.find((p: any) => p.meta?.location === 'home') || participants[0] || {};
  const away = participants.find((p: any) => p.meta?.location === 'away') || participants[1] || {};

  const scores = sm.scores || [];
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  let homeHT: number | null = null;
  let awayHT: number | null = null;

  scores.forEach((s: any) => {
    if (s.participant_id === home.id) {
      if (s.description === 'CURRENT' || s.type_id === 1528) homeScore = s.score?.goals;
      else if (s.description === '1ST_HALF' || s.type_id === 1523) homeHT = s.score?.goals;
    } else if (s.participant_id === away.id) {
      if (s.description === 'CURRENT' || s.type_id === 1528) awayScore = s.score?.goals;
      else if (s.description === '1ST_HALF' || s.type_id === 1523) awayHT = s.score?.goals;
    }
  });

  if (homeScore === null) {
    const ftScore = scores.find((s: any) => s.participant_id === home.id && (s.description === 'FT' || s.type_id === 1522));
    if (ftScore) homeScore = ftScore.score?.goals;
  }
  if (awayScore === null) {
    const ftScore = scores.find((s: any) => s.participant_id === away.id && (s.description === 'FT' || s.type_id === 1522));
    if (ftScore) awayScore = ftScore.score?.goals;
  }

  // SportMonks exposes the canonical state in `state.state` (e.g.
  // INPLAY_1ST_HALF, INPLAY_2ND_HALF, HT, BREAK, INPLAY_ET, INPLAY_PENALTIES,
  // FT, ENDED, NS...). Map it through STATE_TO_STATUS so live matches are
  // correctly detected. Fall back to short_name, then NS.
  const rawState: string = sm.state?.state || sm.state?.short_name || sm.state?.developer_name || 'NS';
  const mapped = STATE_TO_STATUS[String(rawState).toUpperCase()];
  let apiFootballStatus: FixtureStatus = (mapped as FixtureStatus) || 'NS';
  // Safety net: if SportMonks reports a live minute but the state wasn't mapped,
  // treat it as LIVE so in-progress matches never disappear from the feed.
  // Live elapsed minute lives in the ticking period (periods[].minutes), with
  // top-level `minute` as a fallback.
  const tickingPeriod = Array.isArray(sm.periods)
    ? sm.periods.find((p: any) => p.ticking) || sm.periods[sm.periods.length - 1]
    : null;
  const liveMinute: number | null =
    (typeof tickingPeriod?.minutes === 'number' ? tickingPeriod.minutes : null) ??
    (typeof sm.minute === 'number' ? sm.minute : null);
  if (apiFootballStatus === 'NS' && typeof liveMinute === 'number' && liveMinute > 0) {
    apiFootballStatus = 'LIVE';
  }

  const homeWinner = home.meta?.winner ?? (homeScore !== null && awayScore !== null ? homeScore > awayScore : null);
  const awayWinner = away.meta?.winner ?? (homeScore !== null && awayScore !== null ? awayScore > homeScore : null);

  return {
    fixture: {
      id: sm.id,
      referee: sm.referee || null,
      timezone: 'Europe/London',
      date: sm.starting_at_timestamp
        ? new Date(sm.starting_at_timestamp * 1000).toISOString()
        : (sm.starting_at ? new Date(sm.starting_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString()),
      timestamp: sm.starting_at_timestamp || (sm.starting_at ? Math.floor(new Date(sm.starting_at.replace(' ', 'T') + 'Z').getTime() / 1000) : Math.floor(Date.now() / 1000)),
      periods: {
        first: sm.starting_at_timestamp || null,
        second: sm.starting_at_timestamp ? sm.starting_at_timestamp + 45 * 60 : null,
      },
      venue: {
        id: sm.venue?.id || null,
        name: sm.venue?.name || null,
        city: sm.venue?.city_name || null,
      },
      status: {
        long: sm.state?.name || 'Not Started',
        short: apiFootballStatus,
        elapsed: liveMinute,
      },
    },
    league: {
      id: INVERSE_LEAGUE_MAP[sm.league?.id || sm.league_id || 0] || sm.league?.id || sm.league_id || 0,
      name: sm.league?.name || 'League',
      country: sm.league?.country?.name || 'Country',
      logo: sm.league?.image_path || '',
      flag: null,
      season: sm.season_id || config.app.defaultSeason,
      round: sm.round_id ? String(sm.round_id) : 'Regular Season',
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
    score: {
      halftime: { home: homeHT, away: awayHT },
      fulltime: { home: homeScore, away: awayScore },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

export function mapSportmonksEvent(e: any): FixtureEvent {
  let apiFootballType: FixtureEvent['type'] = 'Goal';
  const code = e.type?.code || '';
  if (code.includes('goal')) apiFootballType = 'Goal';
  else if (code.includes('card')) apiFootballType = 'Card';
  else if (code.includes('sub')) apiFootballType = 'subst';
  else if (code.includes('var')) apiFootballType = 'Var';

  return {
    time: {
      elapsed: e.minute || 0,
      extra: e.extra_minute || null,
    },
    team: {
      id: e.participant_id,
      name: e.participant?.name || '',
      logo: e.participant?.image_path || '',
    },
    player: {
      id: e.player_id || null,
      name: e.player?.name || 'Player',
    },
    assist: e.related_player ? {
      id: e.related_player_id || null,
      name: e.related_player?.name || null,
    } : undefined,
    type: apiFootballType,
    detail: e.type?.name || '',
    comments: e.addition || null,
  };
}

export function mapSportmonksStats(smFixture: any): FixtureStatistic[] {
  const participants = smFixture.participants || [];
  const home = participants.find((p: any) => p.meta?.location === 'home') || {};
  const away = participants.find((p: any) => p.meta?.location === 'away') || {};

  const stats = smFixture.statistics || [];
  const homeStats: any[] = [];
  const awayStats: any[] = [];

  stats.forEach((s: any) => {
    const isHome = s.participant_id === home.id;
    const statItem = {
      type: s.type?.name || s.type?.code || '',
      value: s.value?.all ?? s.value?.count ?? s.value ?? 0,
    };
    if (isHome) {
      homeStats.push(statItem);
    } else {
      awayStats.push(statItem);
    }
  });

  const normalizeStats = (items: any[]) => {
    const nameMap: Record<string, string> = {
      'shots-on-target': 'Shots on Goal',
      'shots-off-target': 'Shots off Goal',
      'total-shots': 'Total Shots',
      'blocked-shots': 'Blocked Shots',
      'shots-inside-box': 'Shots insidebox',
      'shots-outside-box': 'Shots outsidebox',
      'fouls': 'Fouls',
      'corners': 'Corner Kicks',
      'offsides': 'Offsides',
      'possession': 'Ball Possession',
      'yellowcards': 'Yellow Cards',
      'redcards': 'Red Cards',
      'saves': 'Goalkeeper Saves',
      'passes': 'Total passes',
      'accurate-passes': 'Passes accurate',
      'pass-percentage': 'Passes %',
    };
    return items.map(item => ({
      type: nameMap[item.type.toLowerCase().replace(/\s+/g, '-')] || item.type,
      value: item.value,
    }));
  };

  return [
    {
      team: { id: home.id || 0, name: home.name || 'Home', logo: home.image_path || '' },
      statistics: normalizeStats(homeStats),
    },
    {
      team: { id: away.id || 0, name: away.name || 'Away', logo: away.image_path || '' },
      statistics: normalizeStats(awayStats),
    },
  ];
}

export function mapSportmonksStandingRow(s: any): StandingRow {
  const details = s.details || [];
  const getDetail = (code: string): number => {
    const d = details.find((x: any) => x.type?.code === code);
    return d?.value || 0;
  };

  const matchesPlayed = getDetail('overall-matches-played');
  const won = getDetail('overall-won');
  const drawn = getDetail('overall-draw');
  const lost = getDetail('overall-lost');
  const goalsFor = getDetail('overall-goals-for');
  const goalsAgainst = getDetail('overall-goals-against');

  return {
    rank: s.position || 0,
    team: {
      id: s.participant_id,
      name: s.participant?.name || 'Team',
      logo: s.participant?.image_path || '',
    },
    points: s.points || 0,
    goalsDiff: (goalsFor - goalsAgainst) || 0,
    group: s.stage?.name || 'Regular Season',
    form: s.recent_form || '',
    status: s.result || 'same',
    description: s.result || null,
    all: {
      played: matchesPlayed,
      win: won,
      draw: drawn,
      lose: lost,
      goals: { for: goalsFor, against: goalsAgainst },
    },
    home: {
      played: getDetail('home-matches-played'),
      win: getDetail('home-won'),
      draw: getDetail('home-draw'),
      lose: getDetail('home-lost'),
      goals: { for: getDetail('home-goals-for'), against: getDetail('home-goals-against') },
    },
    away: {
      played: getDetail('away-matches-played'),
      win: getDetail('away-won'),
      draw: getDetail('away-draw'),
      lose: getDetail('away-lost'),
      goals: { for: getDetail('away-goals-for'), against: getDetail('away-goals-against') },
    },
    update: new Date().toISOString(),
  };
}

export function computeTeamStatsFromFixtures(teamId: number, fixtures: Fixture[]): TeamStatistics {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let loses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let formStr = '';

  fixtures.forEach((f) => {
    const isHome = f.teams.home.id === teamId;
    const gf = isHome ? f.goals.home : f.goals.away;
    const ga = isHome ? f.goals.away : f.goals.home;

    if (gf === null || ga === null) return;

    played++;
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets++;
    if (gf === 0) failedToScore++;

    if (gf > ga) {
      wins++;
      formStr += 'W';
    } else if (gf === ga) {
      draws++;
      formStr += 'D';
    } else {
      loses++;
      formStr += 'L';
    }
  });

  return {
    league: { id: 0, name: 'League', season: 2024 },
    team: { id: teamId, name: 'Team', logo: '' },
    form: formStr.slice(0, 5),
    fixtures: {
      played: { home: Math.round(played / 2), away: Math.round(played / 2), total: played },
      wins: { home: Math.round(wins / 2), away: Math.round(wins / 2), total: wins },
      draws: { home: Math.round(draws / 2), away: Math.round(draws / 2), total: draws },
      loses: { home: Math.round(loses / 2), away: Math.round(loses / 2), total: loses },
    },
    goals: {
      for: {
        total: { home: Math.round(goalsFor / 2), away: Math.round(goalsFor / 2), total: goalsFor },
        average: { home: String(goalsFor / 2), away: String(goalsFor / 2), total: String(goalsFor / played || 0) },
      },
      against: {
        total: { home: Math.round(goalsAgainst / 2), away: Math.round(goalsAgainst / 2), total: goalsAgainst },
        average: { home: String(goalsAgainst / 2), away: String(goalsAgainst / 2), total: String(goalsAgainst / played || 0) },
      },
    },
    clean_sheet: { home: Math.round(cleanSheets / 2), away: Math.round(cleanSheets / 2), total: cleanSheets },
    failed_to_score: { home: Math.round(failedToScore / 2), away: Math.round(failedToScore / 2), total: failedToScore },
  };
}

export const fetchSportmonksFixturesByDate = async (
  date: string,
  apiFootballLeagueId?: number
): Promise<Fixture[]> => {
  try {
    const cleanDate = date.split('T')[0];

    if (isCricketMode()) {
      // Cricket API v2: /fixtures?filter[starts_between]=DATE,DATE&include=...
      let url = `/fixtures?filter[starts_between]=${cleanDate},${cleanDate}&include=localteam,visitorteam,league,venue,runs`;
      console.log(`[Sportmonks Cricket] Fetching fixtures for date ${cleanDate}...`);
      const response = await sportmonksClient.get(url);
      const data = response.data?.data;
      if (!Array.isArray(data)) return [];
      return data.map(mapCricketFixture);
    }

    const smLeagueId = apiFootballLeagueId ? LEAGUE_MAP[apiFootballLeagueId] : undefined;
    let url = `/fixtures/date/${cleanDate}?include=participants;league;venue;state;scores`;
    if (smLeagueId) {
      url += `&filters=leagues:${smLeagueId}`;
    }

    console.log(`[Sportmonks Adapter] Fetching fixtures for date ${cleanDate}...`);
    const response = await sportmonksClient.get(url);
    const data = response.data?.data;
    if (!Array.isArray(data)) return [];

    return data.map(mapSportmonksFixture);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixturesByDate:', err.message);
    return [];
  }
};

/**
 * Fetches fixtures for a date across MANY leagues in a single batched request.
 * Sportmonks supports a comma-separated `fixtureLeagues` filter, so instead of
 * one HTTP call per league (which explodes rate-limit usage as leagues grow),
 * we send all league IDs at once and follow pagination.
 */
export const fetchSportmonksFixturesByDateMulti = async (
  date: string,
  apiFootballLeagueIds: number[]
): Promise<Fixture[]> => {
  try {
    const cleanDate = date.split('T')[0];

    // Cricket mode: fetch all fixtures for the date (no league filtering)
    if (isCricketMode()) {
      return fetchSportmonksFixturesByDate(cleanDate);
    }

    const smLeagueIds = apiFootballLeagueIds
      .map((id) => LEAGUE_MAP[id])
      .filter((id): id is number => typeof id === 'number');

    if (smLeagueIds.length === 0) return [];

    const collected: any[] = [];
    const MAX_PAGES = 8; // safety guard (8 * 50 = 400 fixtures/day is plenty)

    // SportMonks caps leagues at 50 IDs → fetch in chunks and merge.
    for (const chunk of chunkLeagueIds(smLeagueIds)) {
      const filterIds = chunk.join(',');
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= MAX_PAGES) {
        const url = `/fixtures/date/${cleanDate}?include=participants;league;venue;state;scores&filters=leagues:${filterIds}&per_page=50&page=${page}`;
        const response = await sportmonksClient.get(url);
        const data = response.data?.data;
        if (Array.isArray(data) && data.length > 0) collected.push(...data);
        hasMore = Boolean(response.data?.pagination?.has_more);
        page++;
      }
    }

    console.log(`[Sportmonks Adapter] Multi-league date ${cleanDate}: ${collected.length} fixtures across ${smLeagueIds.length} leagues.`);
    return collected.map(mapSportmonksFixture);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixturesByDateMulti:', err.message);
    return [];
  }
};

/**
 * Fetch fixtures across a DATE RANGE for many leagues in one paginated call.
 * Used to look ahead to the next match day when "today" is empty.
 */
export const fetchSportmonksFixturesBetween = async (
  fromDate: string,
  toDate: string,
  apiFootballLeagueIds: number[],
): Promise<Fixture[]> => {
  try {
    const from = fromDate.split('T')[0];
    const to = toDate.split('T')[0];

    // Cricket mode: use filter[starts_between] on /fixtures
    if (isCricketMode()) {
      const collected: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 10) {
        const url = `/fixtures?filter[starts_between]=${from},${to}&include=localteam,visitorteam,league,venue,runs&page=${page}`;
        const response = await sportmonksClient.get(url);
        const data = response.data?.data;
        if (Array.isArray(data) && data.length > 0) collected.push(...data);
        hasMore = Boolean(response.data?.meta?.pagination?.links?.next);
        page++;
      }
      return collected.map(mapCricketFixture);
    }

    const smLeagueIds = apiFootballLeagueIds
      .map((id) => LEAGUE_MAP[id])
      .filter((id): id is number => typeof id === 'number');
    if (smLeagueIds.length === 0) return [];

    const collected: any[] = [];
    const MAX_PAGES = 10;
    // SportMonks caps leagues at 50 IDs → fetch in chunks and merge.
    for (const chunk of chunkLeagueIds(smLeagueIds)) {
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= MAX_PAGES) {
        const url = `/fixtures/between/${from}/${to}?include=participants;league;venue;state;scores&filters=leagues:${chunk.join(',')}&per_page=50&page=${page}`;
        const response = await sportmonksClient.get(url);
        const data = response.data?.data;
        if (Array.isArray(data) && data.length > 0) collected.push(...data);
        hasMore = Boolean(response.data?.pagination?.has_more);
        page++;
      }
    }
    return collected.map(mapSportmonksFixture);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixturesBetween:', err.message);
    return [];
  }
};

/**
 * Fetch ALL fixtures across a date range WITHOUT any league filter.
 * Used as a fallback when no tracked leagues have matches (e.g. off-season).
 * Returns whatever the subscription covers — broadens discovery.
 */
export const fetchSportmonksFixturesBetweenAll = async (
  fromDate: string,
  toDate: string,
): Promise<Fixture[]> => {
  try {
    const from = fromDate.split('T')[0];
    const to = toDate.split('T')[0];

    if (isCricketMode()) {
      return fetchSportmonksFixturesBetween(from, to, []);
    }

    const collected: any[] = [];
    const MAX_PAGES = 6;
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= MAX_PAGES) {
      const url = `/fixtures/between/${from}/${to}?include=participants;league;venue;state;scores&per_page=50&page=${page}`;
      const response = await sportmonksClient.get(url);
      const data = response.data?.data;
      if (Array.isArray(data) && data.length > 0) collected.push(...data);
      hasMore = Boolean(response.data?.pagination?.has_more);
      page++;
    }
    console.log(`[Sportmonks Adapter] Unfiltered between ${from}/${to}: ${collected.length} fixtures.`);
    return collected.map(mapSportmonksFixture);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixturesBetweenAll:', err.message);
    return [];
  }
};

export const fetchSportmonksLiveFixtures = async (
  apiFootballLeagueIds?: number[]
): Promise<Fixture[]> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching live fixtures...`);

    if (isCricketMode()) {
      // Cricket API v2: /livescores endpoint
      const response = await sportmonksClient.get('/livescores?include=localteam,visitorteam,league,venue,runs');
      const data = response.data?.data;
      if (!Array.isArray(data)) return [];
      return data.map(mapCricketFixture).filter((f) => f.fixture.status.short === 'LIVE');
    }

    // Correct in-play endpoint is /livescores/inplay (/fixtures/live → 422).
    const response = await sportmonksClient.get('/livescores/inplay?include=participants;league;venue;state;scores;periods');
    const data = response.data?.data;
    if (!Array.isArray(data)) return [];

    let mapped = data
      .map(mapSportmonksFixture)
      // Keep only genuinely in-progress matches (the endpoint can also include
      // matches about to start / just finished).
      .filter((f) => ['LIVE', 'HT', 'ET', 'P', 'BT'].includes(f.fixture.status.short));
    if (apiFootballLeagueIds && apiFootballLeagueIds.length > 0) {
      mapped = mapped.filter((f) => apiFootballLeagueIds.includes(f.league.id));
    }
    return mapped;
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksLiveFixtures:', err.message);
    return [];
  }
};

export const fetchSportmonksFixtureById = async (id: number): Promise<Fixture | null> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching fixture by ID: ${id}...`);

    if (isCricketMode()) {
      const response = await sportmonksClient.get(`/fixtures/${id}?include=localteam,visitorteam,league,venue,runs`);
      const data = response.data?.data;
      if (!data) return null;
      return mapCricketFixture(data);
    }

    const response = await sportmonksClient.get(`/fixtures/${id}?include=participants;league;venue;state;scores;periods`);
    const data = response.data?.data;
    if (!data) return null;
    return mapSportmonksFixture(data);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixtureById:', err.message);
    return null;
  }
};

export const fetchSportmonksFixtureEvents = async (fixtureId: number): Promise<FixtureEvent[]> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching events for fixture: ${fixtureId}...`);
    const response = await sportmonksClient.get(`/fixtures/${fixtureId}?include=events.type;events.period;events.player;events.participant`);
    const events = response.data?.data?.events;
    if (!Array.isArray(events)) return [];
    return events.map(mapSportmonksEvent);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixtureEvents:', err.message);
    return [];
  }
};

export const fetchSportmonksFixtureStatistics = async (fixtureId: number): Promise<FixtureStatistic[]> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching stats for fixture: ${fixtureId}...`);
    const response = await sportmonksClient.get(`/fixtures/${fixtureId}?include=statistics.type;participants`);
    const data = response.data?.data;
    if (!data) return [];
    return mapSportmonksStats(data);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksFixtureStatistics:', err.message);
    return [];
  }
};

export const fetchSportmonksStandings = async (apiFootballLeagueId: number): Promise<StandingRow[]> => {
  try {
    const smLeagueId = LEAGUE_MAP[apiFootballLeagueId];
    if (!smLeagueId) return [];

    console.log(`[Sportmonks Adapter] Fetching standings for league: ${smLeagueId}...`);
    const response = await sportmonksClient.get(`/standings/leagues/${smLeagueId}?include=participant;details.type`);
    const data = response.data?.data;
    if (!Array.isArray(data)) return [];
    return data.map(mapSportmonksStandingRow);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksStandings:', err.message);
    return [];
  }
};

export const fetchSportmonksTeamStatistics = async (
  teamId: number,
  apiFootballLeagueId: number
): Promise<TeamStatistics | null> => {
  try {
    const lastFixtures = await fetchSportmonksTeamLastFixtures(teamId, 10);
    return computeTeamStatsFromFixtures(teamId, lastFixtures);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksTeamStatistics:', err.message);
    return null;
  }
};

export const fetchSportmonksTeamLastFixtures = async (
  teamId: number,
  last = 10
): Promise<Fixture[]> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching last ${last} fixtures for team: ${teamId}...`);
    // The `teamFixtures` filter on /fixtures returns 400 on this API version.
    // The reliable way to get a team's recent matches is the team entity's
    // `latest` include, which returns finished fixtures with full scores.
    const data = await smGet(`/teams/${teamId}`, {
      params: { include: 'latest.participants;latest.scores;latest.state' },
      ttl: TTL.teamForm,
    });
    const latest = data?.latest;
    if (!Array.isArray(latest)) return [];

    return latest
      .map(mapSportmonksFixture)
      // keep only finished matches (real, scored results) for form/ELO
      .filter((f) => f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN')
      .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
      .slice(0, last);
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksTeamLastFixtures:', err.message);
    return [];
  }
};

export const fetchSportmonksHeadToHead = async (
  team1: number,
  team2: number,
  last = 5
): Promise<H2HRecord[]> => {
  try {
    console.log(`[Sportmonks Adapter] Fetching head-to-head between ${team1} and ${team2}...`);
    // Dedicated H2H endpoint — returns past meetings with scores.
    const data = await smGet(`/fixtures/head-to-head/${team1}/${team2}`, {
      params: { include: 'participants;scores;state' },
      ttl: TTL.teamForm,
    });
    if (!Array.isArray(data)) return [];

    return data
      .map(mapSportmonksFixture)
      .filter((f) => f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN')
      .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
      .slice(0, last)
      .map((f) => ({
        fixture: f.fixture,
        league: f.league,
        teams: f.teams,
        goals: f.goals,
      }));
  } catch (err: any) {
    console.error('[Sportmonks Adapter] Error in fetchSportmonksHeadToHead:', err.message);
    return [];
  }
};
