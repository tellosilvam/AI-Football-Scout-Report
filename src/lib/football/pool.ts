import { kv } from '../cache';
import { apiGet, FootballApiError } from './client';
import { LEAGUES, currentSeason } from './leagues';
import { normalizeEntry } from './normalize';
import type { ApiPlayerEntry, PlayerSeason, PoolStatus } from './types';

/**
 * League pools: every player of a league-season, fetched page by page
 * (`/players?league&season&page`) and kept in the cache. Percentiles,
 * similarity and discovery run over these pools.
 */
interface StoredPool {
  status: PoolStatus;
  players: PlayerSeason[];
}

const POOL_TTL = 60 * 60 * 24 * 8; // refreshed weekly by the warm-up cron
const PAGE_TTL = 60 * 60 * 24 * 6;
const poolKey = (leagueId: number, season: number) => `pool:${leagueId}:${season}`;

const emptyStatus = (leagueId: number, season: number): PoolStatus => ({
  leagueId,
  season,
  pagesLoaded: 0,
  totalPages: null,
  complete: false,
  updatedAt: null,
});

export async function getPool(leagueId: number, season: number): Promise<StoredPool> {
  return (await kv().get<StoredPool>(poolKey(leagueId, season))) ?? { status: emptyStatus(leagueId, season), players: [] };
}

export async function getAllPools(): Promise<StoredPool[]> {
  const pools = await Promise.all(LEAGUES.map(async (l) => getPool(l.id, await currentSeason(l.id))));
  return pools.filter((p) => p.players.length > 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WarmResult {
  leagueId: number;
  season: number;
  fetched: number;
  status: PoolStatus;
  stoppedBy?: 'complete' | 'budget' | 'quota' | 'error';
  error?: string;
}

/**
 * Fetch the next pages of a league pool until it's complete, the time budget
 * runs out or the API quota is hit. Spaces calls to stay under 10 req/min.
 */
export async function warmPool(
  leagueId: number,
  opts: { season?: number; maxPages?: number; budgetMs?: number; spacingMs?: number; restart?: boolean } = {},
): Promise<WarmResult> {
  const season = opts.season ?? (await currentSeason(leagueId));
  const maxPages = opts.maxPages ?? 50;
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  const spacing = opts.spacingMs ?? 6_500;

  const pool = opts.restart ? { status: emptyStatus(leagueId, season), players: [] } : await getPool(leagueId, season);
  if (pool.status.complete && !opts.restart) return { leagueId, season, fetched: 0, status: pool.status, stoppedBy: 'complete' };

  const byId = new Map(pool.players.map((p) => [p.id, p]));
  let page = pool.status.pagesLoaded + 1;
  let fetched = 0;
  let stoppedBy: WarmResult['stoppedBy'];
  let error: string | undefined;

  while (fetched < maxPages) {
    if (Date.now() > deadline) {
      stoppedBy = 'budget';
      break;
    }
    try {
      const res = await apiGet<ApiPlayerEntry>('players', { league: leagueId, season, page }, PAGE_TTL);
      for (const entry of res.response) {
        const row = normalizeEntry(entry, leagueId);
        if (row) byId.set(row.id, row);
      }
      pool.status.totalPages = res.paging?.total ?? pool.status.totalPages;
      pool.status.pagesLoaded = page;
      fetched++;
      if (!res.paging || page >= res.paging.total) {
        pool.status.complete = true;
        stoppedBy = 'complete';
        break;
      }
      page++;
      await sleep(spacing);
    } catch (e) {
      stoppedBy = e instanceof FootballApiError && (e.kind === 'quota' || e.kind === 'rate') ? 'quota' : 'error';
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }

  pool.players = [...byId.values()];
  pool.status.updatedAt = new Date().toISOString();
  await kv().set(poolKey(leagueId, season), pool, POOL_TTL);
  return { leagueId, season, fetched, status: pool.status, stoppedBy, error };
}

/** Warm leagues in order, skipping complete ones. Used by the cron route. */
export async function warmNext(budgetMs = 240_000) {
  const results: WarmResult[] = [];
  const deadline = Date.now() + budgetMs;
  for (const league of LEAGUES) {
    const left = deadline - Date.now();
    if (left < 15_000) break;
    const r = await warmPool(league.id, { budgetMs: left });
    results.push(r);
    if (r.stoppedBy === 'quota' || r.stoppedBy === 'budget') break;
  }
  return results;
}
