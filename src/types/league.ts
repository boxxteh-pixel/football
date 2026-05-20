export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag?: string;
  season: number;
  type?: string;
}

export interface StandingRow {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group?: string;
  form?: string;
  status?: string;
  description?: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  home: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  away: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  update?: string;
}
