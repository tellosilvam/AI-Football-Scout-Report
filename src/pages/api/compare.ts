import type { APIRoute } from 'astro';
import { z } from 'zod';
import { compareVerdict } from '../../lib/ai/analysis';
import { config } from '../../lib/env';
import { getPlayerProfile } from '../../lib/football/service';
import { badRequest, errorResponse, idSchema, json, langSchema, readJson } from '../../lib/http';
import { ipOf, limit, tooMany } from '../../lib/ratelimit';
import { bump } from '../../lib/usage';

export const prerender = false;

const body = z.object({ a: idSchema, b: idSchema, lang: langSchema, verdict: z.boolean().default(true) });

export const POST: APIRoute = async (ctx) => {
  const input = await readJson(ctx.request, body);
  if (input instanceof z.ZodError) return badRequest(input);
  if (input.a === input.b) return badRequest('Pick two different players');
  try {
    const [a, b] = await Promise.all([getPlayerProfile(input.a), getPlayerProfile(input.b)]);
    if (!a || !b) return json({ error: 'not_found' }, { status: 404 });
    let verdict = null;
    if (input.verdict) {
      const rl = await limit('compare', ipOf(ctx), config.chatMessagesPerHour, 60 * 60);
      if (!rl.ok) return tooMany(rl, 'Limit reached');
      // The metric table is useful on its own; a model failure only drops the verdict.
      verdict = await compareVerdict(a, b, input.lang).catch((e) => {
        console.error('[compare] verdict failed', e);
        return null;
      });
      if (verdict) await bump('compares');
    }
    return json({ a, b, verdict });
  } catch (e) {
    return errorResponse(e);
  }
};
