/**
 * TheSportsDB fallback — no API key required.
 * Used for team crests, jerseys, and league logos when API-Football crests are missing.
 */
import axios from 'axios';
import { config } from '@/constants/config';

const client = axios.create({
  baseURL: config.sportsDb.baseUrl,
  timeout: 10000,
});

export interface SportsDbTeam {
  idTeam: string;
  strTeam: string;
  strTeamBadge: string | null;
  strStadium: string | null;
  strCountry: string | null;
  strColor1: string | null;
}

export const searchTeam = async (name: string): Promise<SportsDbTeam | null> => {
  try {
    const { data } = await client.get<{ teams: SportsDbTeam[] | null }>('/searchteams.php', {
      params: { t: name },
    });
    return data.teams?.[0] ?? null;
  } catch {
    return null;
  }
};

export const getTeamCrestUrl = async (name: string): Promise<string | null> => {
  const team = await searchTeam(name);
  return team?.strTeamBadge ?? null;
};
