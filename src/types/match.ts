import type { Team } from './team';

export type FixtureStatus =
  | 'TBD'
  | 'NS' // Not started
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'P'
  | 'BT'
  | 'SUSP'
  | 'INT'
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO'
  | 'LIVE';

export interface Fixture {
  fixture: {
    id: number;
    referee?: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods?: { first: number | null; second: number | null };
    venue?: { id: number | null; name: string | null; city: string | null };
    status: { long: string; short: FixtureStatus; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag?: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: Team & { winner: boolean | null };
    away: Team & { winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface FixtureEvent {
  time: { elapsed: number; extra?: number | null };
  team: Team;
  player: { id: number | null; name: string };
  assist?: { id: number | null; name: string | null };
  type: 'Goal' | 'Card' | 'subst' | 'Var';
  detail: string;
  comments?: string | null;
}

export interface FixtureStatistic {
  team: Team;
  statistics: Array<{ type: string; value: string | number | null }>;
}

export interface H2HRecord {
  fixture: Fixture['fixture'];
  league: Fixture['league'];
  teams: Fixture['teams'];
  goals: Fixture['goals'];
}

export const LIVE_STATUSES: FixtureStatus[] = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE'];
export const FINISHED_STATUSES: FixtureStatus[] = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
export const SCHEDULED_STATUSES: FixtureStatus[] = ['TBD', 'NS', 'PST'];

export const isLive = (status: FixtureStatus): boolean => LIVE_STATUSES.includes(status);
export const isFinished = (status: FixtureStatus): boolean => FINISHED_STATUSES.includes(status);
export const isScheduled = (status: FixtureStatus): boolean => SCHEDULED_STATUSES.includes(status);
