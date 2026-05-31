/**
 * Real season goal rates for the two teams of a fixture, from SportMonks team
 * statistics (type 52 "Goals" and type 88 "Goals Conceded", with home/away
 * splits). These feed a Dixon-Coles Poisson goals model — the strongest
 * statistical signal for Over/Under and BTTS markets.
 *
 * Verified fields:
 *   type 52: { all:{average}, home:{average}, away:{average} }   // scored
 *   type 88: { all:{average}, home:{average}, away:{average} }   // conceded
 */
import { smGet, TTL } from './smClient';

export interface TeamGoalRates {
  scoredHome: number | null;
  scoredAway: number | null;
  scoredAll: number | null;
  concededHome: number | null;
  concededAway: number | null;
  concededAll: number | null;
  matchesPlayed: number | null;
}

export interface FixtureGoalRates {
  home: TeamGoalRates | null;
  away: TeamGoalRates | null;
}

const numOr = (v: any): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const parseTeamGoals = (statsBlocks: any[]): TeamGoalRates | null => {
  if (!Array.isArray(statsBlocks) || statsBlocks.length === 0) return null;
  // Most recent season block.
  const latest = [...statsBlocks].sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0))[0];
  const details: any[] = latest?.details || [];
  const byType = (id: number) => details.find((d) => d.type_id === id)?.value;

  const scored = byType(52);
  const conceded = byType(88);
  if (!scored && !conceded) return null;

  const played = scored?.all?.count ?? conceded?.all?.count ?? null;

  return {
    scoredHome: numOr(scored?.home?.average),
    scoredAway: numOr(scored?.away?.average),
    scoredAll: numOr(scored?.all?.average),
    concededHome: numOr(conceded?.home?.average),
    concededAway: numOr(conceded?.away?.average),
    concededAll: numOr(conceded?.all?.average),
    matchesPlayed: numOr(played),
  };
};

export const fetchTeamGoalRates = async (teamId: number): Promise<TeamGoalRates | null> => {
  try {
    const data = await smGet(`/teams/${teamId}`, {
      params: { include: 'statistics.details.type' },
      ttl: TTL.standings, // season stats move slowly
    });
    return parseTeamGoals(data?.statistics || []);
  } catch {
    return null;
  }
};

/**
 * Goal rates for many teams at once — used by the batched fixture fetchers so
 * the cards/Results screen build the SAME Dixon-Coles goals model the match
 * page does (one prediction everywhere). Per-team calls are cached (30 min) and
 * de-duped by the client, and capped to a small concurrency so a big slate
 * never floods the API.
 */
export const fetchTeamRatesMap = async (
  teamIds: number[],
): Promise<Map<number, TeamGoalRates | null>> => {
  const unique = [...new Set(teamIds.filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<number, TeamGoalRates | null>();
  const CONCURRENCY = 10;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const slice = unique.slice(i, i + CONCURRENCY);
    const res = await Promise.all(slice.map((id) => fetchTeamGoalRates(id).catch(() => null)));
    slice.forEach((id, idx) => map.set(id, res[idx]));
  }
  return map;
};

export const fetchFixtureGoalRates = async (
  homeId: number,
  awayId: number,
): Promise<FixtureGoalRates> => {
  const [home, away] = await Promise.all([
    fetchTeamGoalRates(homeId).catch(() => null),
    fetchTeamGoalRates(awayId).catch(() => null),
  ]);
  return { home, away };
};
