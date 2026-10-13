import { kv } from '../cache';
import { config } from '../env';
import { apiGet, FootballApiError } from './client';
import { LEAGUES, currentSeason } from './leagues';
import { normalizeEntry } from './normalize';
import type { ApiPlayerEntry, PlayerSeason, PoolStatus } from './types';

/**
 * League pools: every player of a league-season, kept in the cache.
 * Percentiles, similarity and discovery run over these pools.
 *
 * Built team by team (`/teams?league&season`, then `/players?team&season&page`)
 * because API-Football's free plan caps `page` at 3, which would stop a
 * league-wide listing at 60 players. A squad fits in 2–4 pages; pages past the
 * plan's cap are skipped and the team is marked partial.
 */
interface StoredPool {
  status: PoolStatus;
  players: PlayerSeason[];
  /** Warm-up cursor. */
  cursor: { teams: number[] | null; teamIndex: number; page: number; partialTeams: number[] };
}

const POOL_TTL = 60 * 60 * 24 * 8; // refreshed weekly by the warm-up cron
const PAGE_TTL = 60 * 60 * 24 * 6;
const poolKey = (leagueId: number, season: number) => `pool:${leagueId}:${season}`;

const emptyPool = (leagueId: number, season: number): StoredPool => ({
  status: { leagueId, season, pagesLoaded: 0, totalPages: null, complete: false, updatedAt: null },
  players: [],
  cursor: { teams: null, teamIndex: 0, page: 1, partialTeams: [] },
});

export async function getPool(leagueId: number, season: number): Promise<StoredPool> {
  return (await kv().get<StoredPool>(poolKey(leagueId, season))) ?? emptyPool(leagueId, season);
}

export async function getAllPools(): Promise<StoredPool[]> {
  const pools = await Promise.all(LEAGUES.map(async (l) => getPool(l.id, await currentSeason(l.id))));
  return pools.filter((p) => p.players.length > 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WarmResult {
  leagueId: number;
  season: number;
  requests: number;
  status: PoolStatus;
  players: number;
  partialTeams: number;
  stoppedBy?: 'complete' | 'budget' | 'quota' | 'error';
  error?: string;
}

/**
 * Advance a league pool until it's complete, the time/request budget runs out
 * or the API quota is hit. Calls are spaced to stay under 10 req/min.
 * `status.pagesLoaded / totalPages` count teams done / teams in the league.
 */
export async function warmPool(
  leagueId: number,
  opts: { season?: number; maxRequests?: number; budgetMs?: number; spacingMs?: number; restart?: boolean } = {},
): Promise<WarmResult> {
  const season = opts.season ?? (await currentSeason(leagueId));
  const maxRequests = opts.maxRequests ?? 80;
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  const spacing = opts.spacingMs ?? 6_500;
  const maxPage = config.maxPage;

  let requests = 0;
  const pool = opts.restart ? emptyPool(leagueId, season) : await getPool(leagueId, season);
  pool.cursor ??= emptyPool(leagueId, season).cursor; // pools stored before the team-based cursor
  const done = (stoppedBy: WarmResult['stoppedBy'], error?: string): WarmResult => ({
    leagueId,
    season,
    requests,
    status: pool.status,
    players: pool.players.length,
    partialTeams: pool.cursor.partialTeams.length,
    stoppedBy,
    error,
  });
  if (pool.status.complete && !opts.restart) return done('complete');

  const byId = new Map(pool.players.map((p) => [p.id, p]));
  const save = async () => {
    pool.players = [...byId.values()];
    pool.status.updatedAt = new Date().toISOString();
    await kv().set(poolKey(leagueId, season), pool, POOL_TTL);
  };

  try {
    if (!pool.cursor.teams) {
      const res = await apiGet<{ team: { id: number } }>('teams', { league: leagueId, season }, PAGE_TTL);
      requests++;
      pool.cursor.teams = res.response.map((t) => t.team.id);
      pool.status.totalPages = pool.cursor.teams.length;
      await sleep(spacing);
    }

    const teams = pool.cursor.teams;
    while (pool.cursor.teamIndex < teams.length) {
      if (requests >= maxRequests || Date.now() > deadline) {
        await save();
        return done('budget');
      }
      const team = teams[pool.cursor.teamIndex];
      let res;
      try {
        res = await apiGet<ApiPlayerEntry>('players', { team, season, page: pool.cursor.page }, PAGE_TTL);
      } catch (e) {
        // Page beyond the plan's cap: keep what we have for this team and move on.
        if (e instanceof FootballApiError && e.kind === 'plan' && /page/i.test(e.message)) {
          pool.cursor.partialTeams.push(team);
          pool.cursor.teamIndex++;
          pool.cursor.page = 1;
          pool.status.pagesLoaded = pool.cursor.teamIndex;
          continue;
        }
        throw e;
      }
      requests++;
      for (const entry of res.response) {
        const row = normalizeEntry(entry, leagueId);
        if (row) byId.set(row.id, row);
      }
      const total = res.paging?.total ?? 1;
      if (pool.cursor.page < Math.min(total, maxPage)) {
        pool.cursor.page++;
      } else {
        if (total > maxPage) pool.cursor.partialTeams.push(team);
        pool.cursor.teamIndex++;
        pool.cursor.page = 1;
        pool.status.pagesLoaded = pool.cursor.teamIndex;
      }
      await sleep(spacing);
    }
    pool.status.complete = true;
    await save();
    return done('complete');
  } catch (e) {
    await save();
    const quota = e instanceof FootballApiError && (e.kind === 'quota' || e.kind === 'rate');
    return done(quota ? 'quota' : 'error', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Warm leagues in order, skipping complete ones. Used by the daily crons.
 * `maxRequests` caps API calls for the whole run so live traffic keeps some quota.
 */
export async function warmNext(budgetMs = 280_000, maxRequests = 40) {
  const results: WarmResult[] = [];
  const deadline = Date.now() + budgetMs;
  let left = maxRequests;
  for (const league of LEAGUES) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 15_000 || left <= 0) break;
    const r = await warmPool(league.id, { budgetMs: timeLeft, maxRequests: left });
    results.push(r);
    left -= r.requests;
    if (r.stoppedBy === 'quota' || r.stoppedBy === 'budget' || r.stoppedBy === 'error') break;
  }
  return results;
}
