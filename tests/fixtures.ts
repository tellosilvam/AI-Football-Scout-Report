// Synthetic API-Football entries for unit tests only (not real players).
import type { ApiPlayerEntry, ApiStatistics } from '../src/lib/football/types';

export function stats(over: Partial<{ [K in keyof ApiStatistics]: Partial<ApiStatistics[K]> }> = {}, leagueId = 39, teamId = 1): ApiStatistics {
  const base: ApiStatistics = {
    team: { id: teamId, name: `Team ${teamId}`, logo: '' },
    league: { id: leagueId, name: 'Test League', country: 'X', logo: null, flag: null, season: 2025 },
    games: { appearences: 20, lineups: 18, minutes: 1800, number: 10, position: 'Midfielder', rating: '7.000000', captain: false },
    substitutes: { in: 2, out: 5, bench: 3 },
    shots: { total: 30, on: 12 },
    goals: { total: 5, conceded: 0, assists: 4, saves: null },
    passes: { total: 900, key: 40, accuracy: 85 },
    tackles: { total: 30, blocks: 5, interceptions: 20 },
    duels: { total: 200, won: 100 },
    dribbles: { attempts: 40, success: 20, past: 10 },
    fouls: { drawn: 25, committed: 15 },
    cards: { yellow: 3, yellowred: 0, red: 0 },
    penalty: { won: 0, commited: null, scored: 0, missed: 0, saved: null },
  };
  for (const [k, v] of Object.entries(over)) Object.assign((base as unknown as Record<string, object>)[k], v);
  return base;
}

export function entry(id: number, statistics: ApiStatistics[], age = 24): ApiPlayerEntry {
  return {
    player: { id, name: `P. Player${id}`, firstname: 'Test', lastname: `Player${id}`, age, nationality: 'X', height: '180 cm', weight: '75 kg', photo: `https://x/${id}.png` },
    statistics,
  };
}
