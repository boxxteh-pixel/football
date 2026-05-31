/**
 * Live match tracker data from SportMonks (real, not simulated).
 *
 * The active plan exposes everything a Bet365-style tracker needs:
 *   - ballCoordinates: normalized {x,y} ball positions with a timer (500 pts)
 *   - formations:      {participant_id, formation: "4-2-3-1", location}
 *   - lineups:         player positions via formation_field "row:col"
 *   - pressure:        per-minute attacking pressure (momentum)
 *   - statistics:      possession/shots/corners/cards/xG
 *   - events:          goals/cards/subs/etc.
 *
 * We fetch them in ONE request and parse into a compact, render-ready shape.
 */
import { smGet, TTL } from './smClient';

export interface BallPoint {
  x: number; // 0-1 along length (0 = home goal line, 1 = away goal line)
  y: number; // 0-1 across width (0 = one touchline, 1 = the other)
  t: number; // seconds into the match (from timer "mm:ss")
}

export interface TrackerPlayer {
  id: number;
  name: string;
  shortName: string;
  jersey: number;
  side: 'home' | 'away';
  /** Field fraction along length (0 = own goal, 1 = opponent goal) in attack dir. */
  fx: number;
  /** Field fraction across width 0-1. */
  fy: number;
  isGK: boolean;
  image: string | null;
}

export interface TrackerStat {
  key: string;
  label: string;
  home: number;
  away: number;
}

export interface TrackerPressure {
  minute: number;
  home: number;
  away: number;
}

export interface LiveTrackerData {
  fixtureId: number;
  homeId: number;
  awayId: number;
  ball: BallPoint[]; // chronological (oldest → newest)
  players: TrackerPlayer[];
  homeFormation: string | null;
  awayFormation: string | null;
  pressure: TrackerPressure[];
  stats: TrackerStat[];
  /** Live possession % (home), from statistics type 45. Null if unknown. */
  possessionHome: number | null;
  hasBall: boolean;
  hasPlayers: boolean;
}

const toSeconds = (timer: string): number => {
  if (!timer) return 0;
  const [m, s] = timer.split(':').map((v) => parseInt(v, 10));
  return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
};

const num = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

// Statistic type IDs → label (only the ones we surface).
const STAT_DEFS: Array<{ id: number; key: string; label: string }> = [
  { id: 45, key: 'possession', label: 'Possession' },
  { id: 42, key: 'shots', label: 'Shots' },
  { id: 86, key: 'shotsOnTarget', label: 'On Target' },
  { id: 34, key: 'corners', label: 'Corners' },
  { id: 84, key: 'yellow', label: 'Yellow' },
  { id: 83, key: 'red', label: 'Red' },
  { id: 5304, key: 'xg', label: 'xG' },
];

/**
 * Parse lineups + formations into placed players using `formation_field`
 * ("row:col"). Players without a field position (subs/bench) are skipped.
 */
const parsePlayers = (lineups: any[], formations: any[], homeId: number): TrackerPlayer[] => {
  if (!Array.isArray(lineups)) return [];

  // Count columns per row, per team, to spread players evenly across the width.
  const rowsByTeam: Record<number, Record<number, any[]>> = {};
  for (const l of lineups) {
    const ff = l.formation_field;
    if (!ff || typeof ff !== 'string' || !ff.includes(':')) continue;
    const [rowStr] = ff.split(':');
    const row = parseInt(rowStr, 10);
    if (!Number.isFinite(row)) continue;
    rowsByTeam[l.team_id] = rowsByTeam[l.team_id] || {};
    rowsByTeam[l.team_id][row] = rowsByTeam[l.team_id][row] || [];
    rowsByTeam[l.team_id][row].push(l);
  }

  const players: TrackerPlayer[] = [];
  for (const l of lineups) {
    const ff = l.formation_field;
    if (!ff || typeof ff !== 'string' || !ff.includes(':')) continue;
    const [rowStr, colStr] = ff.split(':');
    const row = parseInt(rowStr, 10); // 1 = GK, increasing toward attack
    const col = parseInt(colStr, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;

    const side: 'home' | 'away' = l.team_id === homeId ? 'home' : 'away';
    const teamRows = rowsByTeam[l.team_id] || {};
    const maxRow = Math.max(...Object.keys(teamRows).map(Number), 1);
    const rowPlayers = teamRows[row] || [];
    const colsInRow = rowPlayers.length;

    // Depth along own half: row 1 (GK) ≈ 0.04, last row ≈ 0.46 of own half.
    const depth = maxRow > 1 ? (row - 1) / (maxRow - 1) : 0;
    const ownHalfX = 0.05 + depth * 0.42; // 0..~0.47 from own goal

    // Spread across width by column index.
    const fy = colsInRow > 0 ? (col - 0.5) / colsInRow : 0.5;

    // Home attacks toward x=1, away toward x=0. So home fx = ownHalfX, away fx = 1-ownHalfX.
    const fx = side === 'home' ? ownHalfX : 1 - ownHalfX;

    const name: string = l.player_name || 'Player';
    const parts = name.split(' ');
    players.push({
      id: l.player_id,
      name,
      shortName: parts.length > 1 ? parts[parts.length - 1] : name,
      jersey: l.jersey_number ?? 0,
      side,
      fx,
      fy: Math.max(0.06, Math.min(0.94, fy)),
      isGK: row === 1,
      image: l.player?.image_path || null,
    });
  }
  return players;
};

const parseStats = (statistics: any[], homeId: number): TrackerStat[] => {
  if (!Array.isArray(statistics)) return [];
  const byTeam: Record<number, Record<number, number>> = {};
  for (const s of statistics) {
    const tid = s.participant_id ?? s.team_id;
    const typeId = s.type_id;
    const val = s.data?.value ?? s.value;
    if (tid == null || typeId == null) continue;
    byTeam[tid] = byTeam[tid] || {};
    byTeam[tid][typeId] = num(val);
  }
  const teamIds = Object.keys(byTeam).map(Number);
  const awayId = teamIds.find((id) => id !== homeId) ?? teamIds[1];
  const out: TrackerStat[] = [];
  for (const def of STAT_DEFS) {
    const home = byTeam[homeId]?.[def.id] ?? 0;
    const away = (awayId != null ? byTeam[awayId]?.[def.id] : 0) ?? 0;
    if (home === 0 && away === 0) continue;
    out.push({ key: def.key, label: def.label, home, away });
  }
  return out;
};

export const fetchLiveTracker = async (
  fixtureId: number,
  homeId: number,
  awayId: number,
): Promise<LiveTrackerData> => {
  try {
    const include = 'ballCoordinates;formations;lineups.player;pressure;statistics';
    const data = await smGet(`/fixtures/${fixtureId}`, {
      params: { include },
      ttl: TTL.live,
    });

    // Ball: API returns newest-first; reverse to chronological.
    const rawBall: any[] = Array.isArray(data?.ballCoordinates) ? data.ballCoordinates : [];
    const ball: BallPoint[] = rawBall
      .map((b) => ({ x: num(b.x), y: num(b.y), t: toSeconds(b.timer) }))
      .filter((b) => b.x >= -0.05 && b.x <= 1.05)
      .reverse();

    const players = parsePlayers(data?.lineups || [], data?.formations || [], homeId);

    const formations: any[] = data?.formations || [];
    const homeFormation = formations.find((f) => f.participant_id === homeId)?.formation ?? null;
    const awayFormation = formations.find((f) => f.participant_id === awayId)?.formation ?? null;

    const stats = parseStats(data?.statistics || [], homeId);

    // Live possession (stat type 45) for the home team.
    const rawStats: any[] = Array.isArray(data?.statistics) ? data.statistics : [];
    let possHome: number | null = null;
    let possAway: number | null = null;
    for (const s of rawStats) {
      if (s.type_id !== 45) continue;
      const tid = s.participant_id ?? s.team_id;
      const val = num(s.data?.value ?? s.value);
      if (tid === homeId) possHome = val;
      else if (tid === awayId) possAway = val;
    }
    const possessionHome =
      possHome != null && possAway != null && possHome + possAway > 0
        ? (possHome / (possHome + possAway)) * 100
        : possHome != null
        ? possHome
        : null;

    // Pressure → home/away per minute.
    const rawPressure: any[] = Array.isArray(data?.pressure) ? data.pressure : [];
    const pressureByMinute: Record<number, { home: number; away: number }> = {};
    for (const p of rawPressure) {
      const m = p.minute ?? 0;
      pressureByMinute[m] = pressureByMinute[m] || { home: 0, away: 0 };
      if (p.participant_id === homeId) pressureByMinute[m].home = num(p.pressure);
      else if (p.participant_id === awayId) pressureByMinute[m].away = num(p.pressure);
    }
    const pressure: TrackerPressure[] = Object.keys(pressureByMinute)
      .map(Number)
      .sort((a, b) => a - b)
      .map((m) => ({ minute: m, home: pressureByMinute[m].home, away: pressureByMinute[m].away }));

    return {
      fixtureId,
      homeId,
      awayId,
      ball,
      players,
      homeFormation,
      awayFormation,
      pressure,
      stats,
      possessionHome,
      hasBall: ball.length > 0,
      hasPlayers: players.length > 0,
    };
  } catch (err: any) {
    console.warn('[smTracker] fetchLiveTracker failed:', err?.message);
    return {
      fixtureId, homeId, awayId, ball: [], players: [], homeFormation: null,
      awayFormation: null, pressure: [], stats: [], possessionHome: null, hasBall: false, hasPlayers: false,
    };
  }
};
