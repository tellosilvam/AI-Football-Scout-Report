/**
 * Report quality evals: real API data + real model.
 * Run: npm run evals   (needs API_FOOTBALL_KEY and AI_GATEWAY_API_KEY in .env)
 *
 * For each player: generate a report and record schema validity (enforced by
 * Output.object), guard pass on first attempt, final guard pass, latency.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateReport } from '../src/lib/ai/report';
import { getPlayerProfile, searchPlayers } from '../src/lib/football/service';

// Mix of positions. Players in a warmed league pool cost no API requests.
const PLAYERS = [
  'Haaland', 'Salah', 'Saka', 'Palmer', 'Isak', 'Mbeumo', 'Rice', 'Mac Allister',
  'Bruno Fernandes', 'Van Dijk', 'Gvardiol', 'Saliba', 'Alisson', 'Raya', 'Semenyo',
];

type Row = { name: string; ok: boolean; firstTry: boolean; confidence: string; ms: number; issues: string };
const rows: Row[] = [];

describe('scouting report evals', () => {
  for (const name of PLAYERS) {
    it(name, async () => {
      const [hit] = await searchPlayers(name, 1);
      if (!hit) return void rows.push({ name, ok: false, firstTry: false, confidence: '-', ms: 0, issues: 'not found' });
      const profile = await getPlayerProfile(hit.id);
      if (!profile) return void rows.push({ name, ok: false, firstTry: false, confidence: '-', ms: 0, issues: 'no profile' });
      const t0 = Date.now();
      const r = await generateReport(profile, 'en', 'analyst');
      rows.push({
        name: profile.name,
        ok: r.guard.ok,
        firstTry: r.attempts === 1,
        confidence: r.report.confidence,
        ms: Date.now() - t0,
        issues: [...r.guard.unknownNumbers, ...r.guard.unknownMetrics].join(' '),
      });
    }, 120_000);
  }

  it('summary', () => {
    const scored = rows.filter((r) => r.ms > 0);
    const pass = scored.filter((r) => r.ok).length;
    const summary = {
      runAt: new Date().toISOString(),
      model: process.env.REPORT_MODEL ?? 'default',
      guardPass: `${pass}/${scored.length}`,
      firstTry: `${scored.filter((r) => r.firstTry).length}/${scored.length}`,
      avgMs: Math.round(scored.reduce((a, r) => a + r.ms, 0) / Math.max(1, scored.length)),
      rows,
    };
    writeFileSync('evals/results.json', JSON.stringify(summary, null, 2) + '\n');
    console.table(rows);
    console.log(`Guard pass: ${pass}/${scored.length} · first try: ${scored.filter((r) => r.firstTry).length}/${scored.length}`);
    expect(pass / Math.max(1, scored.length)).toBeGreaterThanOrEqual(0.9);
  });
});
