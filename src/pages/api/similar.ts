import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getPlayerProfile, similarPlayers } from '../../lib/football/service';
import { errorResponse, idSchema, json, seasonSchema } from '../../lib/http';

export const prerender = false;

const query = z.object({
  id: idSchema,
  season: seasonSchema,
  maxAge: z.coerce.number().int().min(16).max(45).optional(),
  excludeBig5: z.enum(['1', '0']).optional(),
});

export const GET: APIRoute = async ({ url }) => {
  const q = query.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return json({ error: 'bad_request' }, { status: 400 });
  try {
    const profile = await getPlayerProfile(q.data.id, q.data.season);
    if (!profile) return json({ error: 'not_found' }, { status: 404 });
    const hits = await similarPlayers(profile, { maxAge: q.data.maxAge, excludeBig5: q.data.excludeBig5 === '1', limit: 8 });
    return json(
      {
        results: hits.map((h) => ({
          id: h.player.id,
          name: h.player.name,
          photo: h.player.photo,
          age: h.player.age,
          team: h.player.team,
          league: h.player.league,
          minutes: h.player.minutes,
          similarity: h.similarity,
        })),
      },
      { cacheSeconds: 3600 },
    );
  } catch (e) {
    return errorResponse(e);
  }
};
