import { kv } from './cache';

/** Public counters for /stats. Simple INCR keys; no personal data stored. */
export type Counter = 'reports' | 'reports_cached' | 'chat_messages' | 'compares' | 'discover_queries' | 'input_tokens' | 'output_tokens';

const KEY = (c: Counter) => `stats:${c}`;
const YEAR = 60 * 60 * 24 * 365;

export async function bump(counter: Counter, by = 1) {
  if (by <= 0) return;
  await kv().incr(KEY(counter), YEAR, by);
}

export async function trackUsage(usage: { inputTokens?: number; outputTokens?: number } | undefined) {
  await Promise.all([bump('input_tokens', usage?.inputTokens ?? 0), bump('output_tokens', usage?.outputTokens ?? 0)]);
}

export async function readStats(): Promise<Record<Counter, number>> {
  const counters: Counter[] = ['reports', 'reports_cached', 'chat_messages', 'compares', 'discover_queries', 'input_tokens', 'output_tokens'];
  const values = await Promise.all(counters.map((c) => kv().get<number>(KEY(c))));
  return Object.fromEntries(counters.map((c, i) => [c, values[i] ?? 0])) as Record<Counter, number>;
}
