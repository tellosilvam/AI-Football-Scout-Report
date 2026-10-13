import type { APIRoute } from 'astro';
import { kv, usingRedis } from '../../../lib/cache';
import { config } from '../../../lib/env';
import { leagueById } from '../../../lib/football/leagues';
import { json } from '../../../lib/http';

export const prerender = false;

/**
 * Upload a league pool warmed elsewhere (e.g. locally) so production doesn't
 * spend API quota rebuilding it. Protected by CRON_SECRET.
 * PUT /api/admin/pool?league=39&season=2024  body: stored pool JSON
 */
export const PUT: APIRoute = async ({ request, url }) => {
  if (!config.cronSecret || request.headers.get('authorization') !== `Bearer ${config.cronSecret}`) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  const league = Number(url.searchParams.get('league'));
  const season = Number(url.searchParams.get('season'));
  if (!leagueById(league) || !season) return json({ error: 'bad_request' }, { status: 400 });

  const pool = (await request.json()) as { status?: { leagueId?: number; season?: number }; players?: unknown[] };
  if (!Array.isArray(pool.players) || pool.status?.leagueId !== league || pool.status?.season !== season) {
    return json({ error: 'pool does not match league/season' }, { status: 400 });
  }
  await kv().set(`pool:${league}:${season}`, pool, 60 * 60 * 24 * 8);
  return json({ ok: true, redis: usingRedis(), players: pool.players.length });
};
