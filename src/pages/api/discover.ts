import type { APIRoute } from 'astro';
import { z } from 'zod';
import { interpretQuery } from '../../lib/ai/analysis';
import { discoverInput, toDiscoverFilters } from '../../lib/ai/tools';
import { config } from '../../lib/env';
import { discover } from '../../lib/football/service';
import { badRequest, errorResponse, json, langSchema, readJson } from '../../lib/http';
import { ipOf, limit, tooMany } from '../../lib/ratelimit';
import { bump } from '../../lib/usage';

export const prerender = false;

/** Either a natural-language `query` (AI → filters) or explicit `filters` (user-edited chips). */
const body = z.object({
  query: z.string().trim().min(3).max(300).optional(),
  filters: discoverInput.optional(),
  lang: langSchema,
});

export const POST: APIRoute = async (ctx) => {
  const input = await readJson(ctx.request, body);
  if (input instanceof z.ZodError) return badRequest(input);
  if (!input.query && !input.filters) return badRequest('query or filters required');
  try {
    let filters = input.filters;
    let explanation: string | null = null;
    if (!filters && input.query) {
      const rl = await limit('discover', ipOf(ctx), config.chatMessagesPerHour, 60 * 60);
      if (!rl.ok) return tooMany(rl, 'Limit reached');
      const interpreted = await interpretQuery(input.query, input.lang);
      filters = interpreted.filters;
      explanation = interpreted.explanation;
      await bump('discover_queries');
    }
    const result = await discover({ ...toDiscoverFilters(filters!), limit: filters!.limit ?? 12 });
    return json({ filters, explanation, ...result });
  } catch (e) {
    return errorResponse(e);
  }
};
