export interface Team {
  id: number;
  name: string;
  code?: string | null;
  country?: string;
  founded?: number;
  national?: boolean;
  logo: string;
}

export interface TeamStatistics {
  league: { id: number; season: number; name: string };
  team: Team;
  form: string; // e.g. "WWDLW"
  fixtures: {
    played: { home: number; away: number; total: number };
    wins: { home: number; away: number; total: number };
    draws: { home: number; away: number; total: number };
    loses: { home: number; away: number; total: number };
  };
  goals: {
    for: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
    };
    against: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
    };
  };
  clean_sheet?: { home: number; away: number; total: number };
  failed_to_score?: { home: number; away: number; total: number };
}
