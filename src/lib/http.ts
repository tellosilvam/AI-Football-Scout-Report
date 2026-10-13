import { z } from 'zod';
import { FootballApiError } from './football/client';
import { LANGS, PERSONAS } from './ai/schema';

export const langSchema = z.enum(LANGS).default('en');
export const personaSchema = z.enum(PERSONAS).default('analyst');
export const idSchema = z.coerce.number().int().positive();
export const seasonSchema = z.coerce.number().int().min(2010).max(2100).optional();

export function json(data: unknown, init: ResponseInit & { cacheSeconds?: number } = {}) {
  const headers = new Headers(init.headers);
  if (init.cacheSeconds) headers.set('Cache-Control', `public, s-maxage=${init.cacheSeconds}, stale-while-revalidate=${init.cacheSeconds * 4}`);
  return Response.json(data, { ...init, headers });
}

export function badRequest(error: z.ZodError | string) {
  const message = typeof error === 'string' ? error : error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return json({ error: 'bad_request', message }, { status: 400 });
}

/** Map any thrown error to a safe JSON response (no stack traces to the client). */
export function errorResponse(e: unknown) {
  if (e instanceof FootballApiError) {
    const status = e.kind === 'no-key' ? 503 : e.kind === 'quota' || e.kind === 'rate' ? 429 : 502;
    return json({ error: `data_${e.kind}`, message: e.message }, { status });
  }
  console.error('[api]', e);
  return json({ error: 'internal', message: 'Unexpected error' }, { status: 500 });
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | z.ZodError> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : parsed.error;
}
