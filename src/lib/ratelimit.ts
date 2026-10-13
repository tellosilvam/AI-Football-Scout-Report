import { kv } from './cache';

export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

/** Fixed-window limiter on the shared KV (Upstash in prod, local fallback in dev). */
export async function limit(bucket: string, ip: string, max: number, windowSeconds: number): Promise<LimitResult> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const count = await kv().incr(`rl:${bucket}:${ip}:${window}`, windowSeconds);
  const resetSeconds = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
  return { ok: count <= max, remaining: Math.max(0, max - count), resetSeconds };
}

export function clientIp(request: Request, fallback = 'local'): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || fallback;
}

/** Astro's `clientAddress` getter throws where it's unavailable; headers first, then it. */
export function ipOf(ctx: { request: Request; clientAddress?: string }): string {
  const fromHeaders = clientIp(ctx.request, '');
  if (fromHeaders) return fromHeaders;
  try {
    return ctx.clientAddress || 'local';
  } catch {
    return 'local';
  }
}

export function tooMany(r: LimitResult, message: string) {
  return Response.json(
    { error: 'rate_limited', message, resetSeconds: r.resetSeconds },
    { status: 429, headers: { 'Retry-After': String(r.resetSeconds) } },
  );
}
