import type { APIRoute } from 'astro';
import { z } from 'zod';
import { generateReport, getCachedReport } from '../../lib/ai/report';
import { config } from '../../lib/env';
import { getPlayerProfile } from '../../lib/football/service';
import { badRequest, errorResponse, idSchema, json, langSchema, personaSchema, readJson, seasonSchema } from '../../lib/http';
import { ipOf, limit, tooMany } from '../../lib/ratelimit';
import { bump } from '../../lib/usage';

export const prerender = false;

const body = z.object({
  playerId: idSchema,
  season: seasonSchema,
  lang: langSchema,
  persona: personaSchema,
  /** Return only a cached report; never call the model. */
  cachedOnly: z.boolean().default(false),
  regenerate: z.boolean().default(false),
});

export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const input = await readJson(request, body);
  if (input instanceof z.ZodError) return badRequest(input);
  try {
    const profile = await getPlayerProfile(input.playerId, input.season);
    if (!profile) return json({ error: 'not_found' }, { status: 404 });

    if (!input.regenerate) {
      const hit = await getCachedReport(profile, input.lang, input.persona);
      if (hit) {
        await bump('reports_cached');
        return json({ ...hit, cached: true });
      }
    }
    if (input.cachedOnly) return json({ report: null });

    const rl = await limit('report', ipOf(ctx), config.reportsPerDay, 60 * 60 * 24);
    if (!rl.ok) return tooMany(rl, 'Daily AI report limit reached');

    const stored = await generateReport(profile, input.lang, input.persona);
    return json({ ...stored, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
};
