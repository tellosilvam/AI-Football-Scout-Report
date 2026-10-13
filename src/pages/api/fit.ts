import type { APIRoute } from 'astro';
import { z } from 'zod';
import { tacticalFit } from '../../lib/ai/analysis';
import { STYLES } from '../../lib/ai/schema';
import { config } from '../../lib/env';
import { getPlayerProfile } from '../../lib/football/service';
import { badRequest, errorResponse, idSchema, json, langSchema, readJson, seasonSchema } from '../../lib/http';
import { ipOf, limit, tooMany } from '../../lib/ratelimit';

export const prerender = false;

const body = z.object({ playerId: idSchema, season: seasonSchema, style: z.enum(STYLES), lang: langSchema });

export const POST: APIRoute = async (ctx) => {
  const input = await readJson(ctx.request, body);
  if (input instanceof z.ZodError) return badRequest(input);
  const rl = await limit('fit', ipOf(ctx), config.chatMessagesPerHour, 60 * 60);
  if (!rl.ok) return tooMany(rl, 'Limit reached');
  try {
    const profile = await getPlayerProfile(input.playerId, input.season);
    if (!profile) return json({ error: 'not_found' }, { status: 404 });
    return json(await tacticalFit(profile, input.style, input.lang));
  } catch (e) {
    return errorResponse(e);
  }
};
