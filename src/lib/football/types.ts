// ---------- Raw API-Football v3 shapes (only the fields we use) ----------

export type N = number | null;

export interface ApiEnvelope<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[] | Record<string, string>;
  results: number;
  paging?: { current: number; total: number };
  response: T[];
}

export interface ApiPlayer {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: N;
  birth?: { date: string | null; place: string | null; country: string | null };
  nationality: string | null;
  height: string | null;
  weight: string | null;
  injured?: boolean;
  photo: string;
  position?: string | null; // only on /players/profiles
}

export interface ApiStatistics {
  team: { id: number; name: string; logo: string };
  league: { id: number | null; name: string; country: string | null; logo: string | null; flag: string | null; season: number };
  games: { appearences: N; lineups: N; minutes: N; number: N; position: string | null; rating: string | null; captain: boolean };
  substitutes: { in: N; out: N; bench: N };
  shots: { total: N; on: N };
  goals: { total: N; conceded: N; assists: N; saves: N };
  passes: { total: N; key: N; accuracy: N };
  tackles: { total: N; blocks: N; interceptions: N };
  duels: { total: N; won: N };
  dribbles: { attempts: N; success: N; past: N };
  fouls: { drawn: N; committed: N };
  cards: { yellow: N; yellowred: N; red: N };
  penalty: { won: N; commited: N; scored: N; missed: N; saved: N };
}

export interface ApiPlayerEntry {
  player: ApiPlayer;
  statistics: ApiStatistics[];
}

// ---------- Normalized domain model ----------

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

export interface PlayerSummary {
  id: number;
  name: string;
  fullName: string;
  photo: string;
  age: number | null;
  nationality: string | null;
  position: PositionGroup | null;
  team?: { id: number; name: string; logo: string } | null;
  league?: { id: number; name: string; logo: string | null } | null;
}

/** Season totals for one player in one league (summed across clubs if transferred mid-season). */
export interface PlayerSeason extends PlayerSummary {
  season: number;
  leagueId: number;
  height: string | null;
  weight: string | null;
  injured: boolean;
  appearances: number;
  starts: number;
  minutes: number;
  rating: number | null;
  /** Raw counting stats, keyed by metric source. */
  totals: Record<string, number>;
  /** Derived metrics (per-90 and ratios), keyed by metric key. `null` when not computable. */
  metrics: Record<string, number | null>;
}

export interface MetricPercentile {
  key: string;
  value: number | null;
  percentile: number | null;
}

export interface PlayerProfile extends PlayerSeason {
  percentiles: MetricPercentile[];
  /** Peers this player was ranked against. */
  peerGroup: { label: string; size: number; minMinutes: number } | null;
  poolStatus: PoolStatus;
}

export interface PoolStatus {
  leagueId: number;
  season: number;
  pagesLoaded: number;
  totalPages: number | null;
  complete: boolean;
  updatedAt: string | null;
}
