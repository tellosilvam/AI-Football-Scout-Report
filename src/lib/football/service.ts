import { apiGet } from './client';
import { LEAGUES, clampSeason, currentSeason, isSupportedLeague, leagueById } from './leagues';
import { METRICS, toPositionGroup } from './metrics';
import { normalizeEntry } from './normalize';
import { minMinutesFor, peersOf, percentilesFor, poolPercentiles } from './percentiles';
import { getAllPools, getPool } from './pool';
import { findSimilar, type SimilarFilters } from './similarity';
import type { ApiPlayer, ApiPlayerEntry, PlayerProfile, PlayerSeason, PlayerSummary, PositionGroup } from './types';

const DAY = 60 * 60 * 24;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- search

/** Search cached league pools first (instant, has club info), then the live profiles endpoint. */
export async function searchPlayers(query: string, limit = 8): Promise<PlayerSummary[]> {
  const q = fold(query.trim());
  if (q.length < 3) return [];

  const pools = await getAllPools();
  const local: PlayerSummary[] = [];
  for (const pool of pools) {
    for (const p of pool.players) {
      if (fold(`${p.name} ${p.fullName}`).includes(q)) local.push(toSummary(p));
    }
  }
  local.sort((a, b) => (b as PlayerSeason).minutes - (a as PlayerSeason).minutes);
  if (local.length >= limit) return dedupe(local).slice(0, limit);

  try {
    const res = await apiGet<{ player: ApiPlayer }>('players/profiles', { search: query.trim() }, DAY);
    const remote = res.response.map(({ player }) => ({
      id: player.id,
      name: player.name,
      fullName: [player.firstname, player.lastname].filter(Boolean).join(' ') || player.name,
      photo: player.photo,
      age: player.age,
      nationality: player.nationality,
      position: toPositionGroup(player.position),
      team: null,
      league: null,
    }));
    return dedupe([...local, ...remote]).slice(0, limit);
  } catch {
    return dedupe(local).slice(0, limit);
  }
}

function dedupe(list: PlayerSummary[]) {
  const seen = new Set<number>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

const toSummary = (p: PlayerSeason): PlayerSummary & { minutes: number } => ({
  id: p.id,
  name: p.name,
  fullName: p.fullName,
  photo: p.photo,
  age: p.age,
  nationality: p.nationality,
  position: p.position,
  team: p.team,
  league: p.league,
  minutes: p.minutes,
});

// ---------------------------------------------------------------- player

async function latestSeason(playerId: number): Promise<number | null> {
  const res = await apiGet<number>('players/seasons', { player: playerId }, DAY);
  const seasons = res.response.filter((s) => typeof s === 'number').sort((a, b) => b - a);
  return seasons[0] ? clampSeason(seasons[0]) : null;
}

/** Live player season (cached 24h). Picks the supported league with most minutes. */
export async function getPlayerSeason(playerId: number, season?: number): Promise<PlayerSeason | null> {
  const s = season !== undefined ? clampSeason(season) : await latestSeason(playerId);
  if (!s) return null;
  const res = await apiGet<ApiPlayerEntry>('players', { id: playerId, season: s }, DAY);
  const entry = res.response[0];
  if (!entry) {
    // Season just started and the player has no rows yet: fall back one season.
    return season === undefined ? getPlayerSeason(playerId, s - 1) : null;
  }
  const supported = entry.statistics
    .filter((st) => isSupportedLeague(st.league.id))
    .sort((a, b) => (b.games.minutes ?? 0) - (a.games.minutes ?? 0))[0];
  const row = normalizeEntry(entry, supported?.league.id ?? undefined);
  if (row && row.minutes === 0 && season === undefined) {
    const prev = await getPlayerSeason(playerId, s - 1).catch(() => null);
    if (prev && prev.minutes > 0) return prev;
  }
  return row;
}

/** Player + percentiles vs. same-position peers in their league pool. */
export async function getPlayerProfile(playerId: number, season?: number): Promise<PlayerProfile | null> {
  const player = await getPlayerSeason(playerId, season);
  if (!player) return null;

  const pool = await getPool(player.leagueId, player.season);
  const poolPlayers = pool.players.some((p) => p.id === player.id)
    ? pool.players.map((p) => (p.id === player.id ? player : p))
    : [...pool.players, player];

  if (!player.position || !isSupportedLeague(player.leagueId) || pool.players.length === 0) {
    return { ...player, percentiles: percentilesFor(player, []), peerGroup: null, poolStatus: pool.status };
  }
  const minMinutes = minMinutesFor(poolPlayers);
  const peers = peersOf(poolPlayers, player.position, minMinutes);
  return {
    ...player,
    percentiles: percentilesFor(player, peers),
    peerGroup: { label: `${player.league?.name ?? ''} ${player.position}`, size: peers.length, minMinutes },
    poolStatus: pool.status,
  };
}

export const percentileMap = (p: PlayerProfile) =>
  Object.fromEntries(p.percentiles.filter((x) => x.percentile !== null).map((x) => [x.key, x.percentile as number]));

// ---------------------------------------------------------------- similar / discover

const BIG5 = new Set(LEAGUES.filter((l) => l.big5).map((l) => l.id));

export async function similarPlayers(profile: PlayerProfile, filters: SimilarFilters = {}) {
  const pools = await getAllPools();
  return findSimilar(
    { id: profile.id, position: profile.position, percentiles: percentileMap(profile) },
    pools.map((p) => p.players),
    BIG5,
    filters,
  );
}

export interface DiscoverFilters {
  position?: PositionGroup;
  minAge?: number;
  maxAge?: number;
  leagueIds?: number[];
  excludeBig5?: boolean;
  minMinutes?: number;
  /** Metric keys with minimum percentile, e.g. { dribbles_p90: 70 } */
  minPercentiles?: Record<string, number>;
  /** Metric to rank by (percentile, desc). */
  sortBy?: string;
  limit?: number;
}

export interface DiscoverHit {
  player: PlayerSummary & { minutes: number; season: number };
  score: number;
  percentiles: Record<string, number>;
}

/** Structured search over all cached pools. Score = mean percentile of the requested metrics. */
export async function discover(f: DiscoverFilters): Promise<{ hits: DiscoverHit[]; poolsSearched: number; playersSearched: number }> {
  const pools = await getAllPools();
  const wanted = Object.keys(f.minPercentiles ?? {});
  const scoreKeys = wanted.length ? wanted : f.sortBy ? [f.sortBy] : [];
  const hits: DiscoverHit[] = [];
  let playersSearched = 0;

  for (const pool of pools) {
    const league = leagueById(pool.status.leagueId);
    if (f.leagueIds?.length && !f.leagueIds.includes(pool.status.leagueId)) continue;
    if (f.excludeBig5 && league?.big5) continue;
    const { percentiles, byGroup } = poolPercentiles(pool.players);
    for (const [group, peers] of byGroup) {
      if (f.position && f.position !== group) continue;
      for (const p of peers) {
        playersSearched++;
        if (f.minAge && (p.age ?? 0) < f.minAge) continue;
        if (f.maxAge && (p.age ?? 99) > f.maxAge) continue;
        if (f.minMinutes && p.minutes < f.minMinutes) continue;
        const row = percentiles.get(p.id) ?? {};
        if (wanted.some((k) => (row[k] ?? -1) < (f.minPercentiles?.[k] ?? 0))) continue;
        const score = scoreKeys.length
          ? scoreKeys.reduce((s, k) => s + (row[k] ?? 0), 0) / scoreKeys.length
          : (p.rating ?? 0) * 10;
        hits.push({ player: { ...toSummary(p), season: p.season }, score: Math.round(score), percentiles: row });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, f.limit ?? 12), poolsSearched: pools.length, playersSearched };
}

export const METRIC_KEYS = METRICS.map((m) => m.key);

export async function seasonFor(leagueId: number) {
  return currentSeason(leagueId);
}
