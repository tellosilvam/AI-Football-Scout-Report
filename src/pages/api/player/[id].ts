import type { APIRoute } from 'astro';
import { getPlayerProfile } from '../../../lib/football/service';
import { errorResponse, idSchema, json, seasonSchema } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const id = idSchema.safeParse(params.id);
  const season = seasonSchema.safeParse(url.searchParams.get('season') ?? undefined);
  if (!id.success || !season.success) return json({ error: 'bad_request' }, { status: 400 });
  try {
    const profile = await getPlayerProfile(id.data, season.data);
    if (!profile) return json({ error: 'not_found' }, { status: 404 });
    return json(profile, { cacheSeconds: 3600 });
  } catch (e) {
    return errorResponse(e);
  }
};
