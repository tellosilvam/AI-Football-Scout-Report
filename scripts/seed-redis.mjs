// One-off: upload league pools warmed locally (.cache/) to production, so it
// gets them without spending API-Football quota again.
// Usage: CRON_SECRET=... node scripts/seed-redis.mjs https://ai-scout-tello.vercel.app 39:2024 [281:2024 ...]
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [base, ...pools] = process.argv.slice(2);
const secret = process.env.CRON_SECRET;
if (!base || !secret) throw new Error('Usage: CRON_SECRET=... node scripts/seed-redis.mjs <site-url> <league:season>...');

for (const arg of pools) {
  const [league, season] = arg.split(':');
  const file = `.cache/${createHash('sha1').update(`pool:${league}:${season}`).digest('hex')}.json`;
  const { value } = JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(`${base}/api/admin/pool?league=${league}&season=${season}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  console.log(arg, res.status, await res.text());
}
