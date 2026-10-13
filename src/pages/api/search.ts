import type { APIRoute } from 'astro';
import { searchPlayers } from '../../lib/football/service';
import { errorResponse, json } from '../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 60);
  if (q.trim().length < 3) return json({ results: [] });
  try {
    return json({ results: await searchPlayers(q, 8) }, { cacheSeconds: 3600 });
  } catch (e) {
    return errorResponse(e);
  }
};
