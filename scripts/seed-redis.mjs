// One-off: copy league pools warmed locally (.cache/) into Upstash Redis, so
// production gets them without spending API-Football quota again.
// Usage: node --env-file=.env.local scripts/seed-redis.mjs 39:2024 [281:2026 ...]
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error('Redis credentials missing (run `vercel env pull .env.local` first)');
const redis = new Redis({ url, token });

for (const arg of process.argv.slice(2)) {
  const key = `pool:${arg}`;
  const file = `.cache/${createHash('sha1').update(key).digest('hex')}.json`;
  const { value } = JSON.parse(readFileSync(file, 'utf8'));
  await redis.set(`aiscout:v2:${key}`, value, { ex: 60 * 60 * 24 * 8 });
  console.log(`seeded ${key}: ${value.players.length} players, complete=${value.status.complete}`);
}
