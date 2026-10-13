import { describe, expect, it } from 'vitest';
import { normalizeEntry } from '../src/lib/football/normalize';
import { minMinutesFor, peersOf, percentileRank, percentilesFor, poolPercentiles } from '../src/lib/football/percentiles';
import { findSimilar } from '../src/lib/football/similarity';
import type { PlayerSeason } from '../src/lib/football/types';
import { entry, stats } from './fixtures';

const pool: PlayerSeason[] = Array.from({ length: 20 }, (_, i) =>
  normalizeEntry(
    entry(i + 1, [stats({ goals: { total: i, assists: 19 - i }, dribbles: { past: i, attempts: 40, success: 20 }, passes: { key: i * 2 } })], 20 + (i % 10)),
    39,
  )!,
);

describe('percentiles', () => {
  it('ranks with ties counted as half', () => {
    expect(percentileRank([1, 2, 3, 4], 4)).toBe(88);
    expect(percentileRank([1, 1, 1, 1], 1)).toBe(50);
  });

  it('scales the minutes threshold with the season and clamps it', () => {
    expect(minMinutesFor(pool)).toBe(540); // 30% of 1800
    expect(minMinutesFor([{ ...pool[0], minutes: 100 }])).toBe(270);
  });

  it('puts the top scorer on top and inverts lower-is-better metrics', () => {
    const peers = peersOf(pool, 'MF', 540);
    const best = percentilesFor(pool[19], peers);
    expect(best.find((m) => m.key === 'goals_p90')!.percentile).toBe(98);
    // Most times dribbled past → worst after inversion
    expect(best.find((m) => m.key === 'dribbled_past_p90')!.percentile).toBe(2);
  });

  it('needs at least 5 peers before reporting a percentile', () => {
    const r = percentilesFor(pool[0], pool.slice(0, 3));
    expect(r.every((m) => m.percentile === null)).toBe(true);
  });

  it('computes a percentile row for every peer in the pool', () => {
    const { percentiles } = poolPercentiles(pool);
    expect(percentiles.size).toBe(20);
  });
});

describe('similarity', () => {
  it('finds the closest statistical neighbours and respects filters', () => {
    const { percentiles } = poolPercentiles(pool);
    const target = { id: 10, position: 'MF' as const, percentiles: percentiles.get(10)! };
    const hits = findSimilar(target, [pool], new Set(), { limit: 3 });
    expect(hits).toHaveLength(3);
    expect(hits.map((h) => h.player.id)).not.toContain(10);
    expect([9, 11]).toContain(hits[0].player.id);

    const young = findSimilar(target, [pool], new Set(), { maxAge: 21 });
    expect(young.every((h) => (h.player.age ?? 99) <= 21)).toBe(true);

    expect(findSimilar(target, [pool], new Set([39]), { excludeBig5: true })).toHaveLength(0);
  });
});
