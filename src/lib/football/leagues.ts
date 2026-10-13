import { apiGet } from './client';

export interface LeagueDef {
  id: number;
  name: string;
  country: string;
  /** Top-5 European league, used for the "outside the big 5" filter. */
  big5: boolean;
  /** Season used when the API can't be asked (no key / quota exhausted). */
  fallbackSeason: number;
}

// API-Football league ids.
export const LEAGUES: LeagueDef[] = [
  { id: 39, name: 'Premier League', country: 'England', big5: true, fallbackSeason: 2025 },
  { id: 140, name: 'LaLiga', country: 'Spain', big5: true, fallbackSeason: 2025 },
  { id: 135, name: 'Serie A', country: 'Italy', big5: true, fallbackSeason: 2025 },
  { id: 78, name: 'Bundesliga', country: 'Germany', big5: true, fallbackSeason: 2025 },
  { id: 61, name: 'Ligue 1', country: 'France', big5: true, fallbackSeason: 2025 },
  { id: 281, name: 'Liga 1', country: 'Peru', big5: false, fallbackSeason: 2026 },
  { id: 253, name: 'MLS', country: 'USA', big5: false, fallbackSeason: 2026 },
];

export const leagueById = (id: number) => LEAGUES.find((l) => l.id === id) ?? null;
export const isSupportedLeague = (id: number | null | undefined) => !!id && LEAGUES.some((l) => l.id === id);

interface ApiLeagueEntry {
  league: { id: number; name: string; logo: string };
  seasons: { year: number; current: boolean; coverage?: { players?: boolean } }[];
}

/** Current season for a league according to the API (cached 24h). */
export async function currentSeason(leagueId: number): Promise<number> {
  const def = leagueById(leagueId);
  try {
    const res = await apiGet<ApiLeagueEntry>('leagues', { id: leagueId, current: 'true' }, 60 * 60 * 24);
    const season = res.response[0]?.seasons.find((s) => s.current)?.year;
    return season ?? def?.fallbackSeason ?? new Date().getFullYear() - 1;
  } catch {
    return def?.fallbackSeason ?? new Date().getFullYear() - 1;
  }
}

export const seasonLabel = (season: number, leagueId: number) => {
  // Calendar-year leagues (Peru, MLS) show a single year.
  if (leagueId === 281 || leagueId === 253) return String(season);
  return `${season}/${String(season + 1).slice(-2)}`;
};
