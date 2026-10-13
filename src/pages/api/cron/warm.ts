import type { APIRoute } from 'astro';
import { config } from '../../../lib/env';
import { leagueById } from '../../../lib/football/leagues';
import { warmNext, warmPool } from '../../../lib/football/pool';
import { json } from '../../../lib/http';

export const prerender = false;

/**
 * Warm league pools. Called daily by Vercel Cron (Authorization: Bearer CRON_SECRET)
 * or manually: /api/cron/warm?league=39&requests=20
 */
export const GET: APIRoute = async ({ request, url }) => {
  const secret = config.cronSecret;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  const league = Number(url.searchParams.get('league'));
  const maxRequests = Number(url.searchParams.get('requests') ?? 80);
  const restart = url.searchParams.get('restart') === '1';
  if (league) {
    if (!leagueById(league)) return json({ error: 'unknown league' }, { status: 400 });
    return json(await warmPool(league, { maxRequests, restart }));
  }
  return json({ results: await warmNext() });
};
