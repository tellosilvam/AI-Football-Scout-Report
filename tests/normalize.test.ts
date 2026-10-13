import { describe, expect, it } from 'vitest';
import { idFromSlug, normalizeEntry, slugify } from '../src/lib/football/normalize';
import { entry, stats } from './fixtures';

describe('normalizeEntry', () => {
  it('computes per-90 and ratio metrics', () => {
    const p = normalizeEntry(entry(1, [stats()]), 39)!;
    expect(p.minutes).toBe(1800);
    expect(p.metrics.goals_p90).toBe(0.25); // 5 / 1800 * 90
    expect(p.metrics.key_passes_p90).toBe(2);
    expect(p.metrics.shots_on_target_pct).toBe(40);
    expect(p.metrics.duel_win_pct).toBe(50);
    expect(p.position).toBe('MF');
    expect(p.rating).toBe(7);
  });

  it('sums rows for a mid-season transfer within the same league', () => {
    const p = normalizeEntry(entry(2, [stats({ games: { minutes: 900 }, goals: { total: 2 } }, 39, 1), stats({ games: { minutes: 900 }, goals: { total: 4 } }, 39, 2)]), 39)!;
    expect(p.minutes).toBe(1800);
    expect(p.totals.goals).toBe(6);
  });

  it('ignores other competitions and picks the busiest league when none is given', () => {
    const p = normalizeEntry(entry(3, [stats({ games: { minutes: 300 } }, 2), stats({ games: { minutes: 1500 } }, 140)]))!;
    expect(p.leagueId).toBe(140);
    expect(p.minutes).toBe(1500);
  });

  it('returns null metrics when there are no minutes', () => {
    const p = normalizeEntry(entry(4, [stats({ games: { minutes: 0 } })]), 39)!;
    expect(p.metrics.goals_p90).toBeNull();
  });
});

describe('slugs', () => {
  it('round-trips ids and strips accents', () => {
    expect(slugify('Raphaël Varane', 77)).toBe('raphael-varane-77');
    expect(idFromSlug('raphael-varane-77')).toBe(77);
    expect(idFromSlug('nope')).toBeNull();
  });
});
