import { config } from '../env';
import { cached, kv } from '../cache';
import type { ApiEnvelope } from './types';

const BASE = 'https://v3.football.api-sports.io';

export class FootballApiError extends Error {
  constructor(
    message: string,
    public kind: 'no-key' | 'quota' | 'rate' | 'upstream' | 'plan',
  ) {
    super(message);
  }
}

export interface Quota {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteRemaining: number | null;
  at: string;
}

const QUOTA_KEY = 'quota:api-football';

/**
 * Raw GET against API-Football with cache. API-Football answers 200 even on
 * errors and reports them in `errors`, so every response is checked.
 */
export async function apiGet<T>(
  endpoint: string,
  params: Record<string, string | number>,
  ttlSeconds: number,
): Promise<ApiEnvelope<T>> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const cacheKey = `af:${endpoint}?${qs}`;
  return cached(cacheKey, ttlSeconds, () => fetchLive<T>(endpoint, qs));
}

async function fetchLive<T>(endpoint: string, qs: string): Promise<ApiEnvelope<T>> {
  const key = config.apiFootballKey;
  if (!key) throw new FootballApiError('API_FOOTBALL_KEY is not set', 'no-key');

  const res = await fetch(`${BASE}/${endpoint}?${qs}`, { headers: { 'x-apisports-key': key } });
  await recordQuota(res.headers);

  if (res.status === 429) throw new FootballApiError('API-Football rate limit reached', 'rate');
  if (!res.ok) throw new FootballApiError(`API-Football responded ${res.status}`, 'upstream');

  const body = (await res.json()) as ApiEnvelope<T>;
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {});
  if (errors.length) {
    const msg = errors.map(String).join('; ');
    const lower = msg.toLowerCase();
    if (lower.includes('request limit') || lower.includes('requests')) throw new FootballApiError(msg, 'quota');
    if (lower.includes('rate')) throw new FootballApiError(msg, 'rate');
    if (lower.includes('plan') || lower.includes('season')) throw new FootballApiError(msg, 'plan');
    throw new FootballApiError(msg, 'upstream');
  }
  return body;
}

async function recordQuota(h: Headers) {
  const num = (name: string) => {
    const v = h.get(name);
    return v === null ? null : Number(v);
  };
  const quota: Quota = {
    dailyLimit: num('x-ratelimit-requests-limit'),
    dailyRemaining: num('x-ratelimit-requests-remaining'),
    minuteRemaining: num('x-ratelimit-remaining'),
    at: new Date().toISOString(),
  };
  if (quota.dailyRemaining !== null) await kv().set(QUOTA_KEY, quota, 60 * 60 * 24);
}

export const getQuota = () => kv().get<Quota>(QUOTA_KEY);
