import { METRICS, metricsFor } from './metrics';
import type { MetricPercentile, PlayerSeason, PositionGroup } from './types';

/**
 * Minimum minutes to enter a peer group. Scales with how far the season is:
 * 30% of the most-played player's minutes, clamped to [270, 900].
 */
export function minMinutesFor(pool: PlayerSeason[]): number {
  const max = pool.reduce((m, p) => Math.max(m, p.minutes), 0);
  return Math.min(900, Math.max(270, Math.round(max * 0.3)));
}

export function peersOf(pool: PlayerSeason[], group: PositionGroup, minMinutes: number) {
  return pool.filter((p) => p.position === group && p.minutes >= minMinutes);
}

/** Percentile rank with ties counted as half (0–100). */
export function percentileRank(values: number[], v: number): number {
  if (!values.length) return 0;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return Math.round(((below + 0.5 * equal) / values.length) * 100);
}

export function percentilesFor(player: PlayerSeason, peers: PlayerSeason[]): MetricPercentile[] {
  return metricsFor(player.position).map((def) => {
    const value = player.metrics[def.key] ?? null;
    if (value === null || peers.length < 5) return { key: def.key, value, percentile: null };
    const values = peers.map((p) => p.metrics[def.key]).filter((x): x is number => x !== null);
    const pct = percentileRank(values, value);
    return { key: def.key, value, percentile: def.inverted ? 100 - pct : pct };
  });
}

/**
 * Percentile vector for every player in the pool, over all metrics of the
 * player's group (used for similarity and NL discovery).
 */
export function poolPercentiles(pool: PlayerSeason[]) {
  const minMinutes = minMinutesFor(pool);
  const byGroup = new Map<PositionGroup, PlayerSeason[]>();
  for (const g of ['GK', 'DF', 'MF', 'FW'] as PositionGroup[]) byGroup.set(g, peersOf(pool, g, minMinutes));

  const columns = new Map<string, number[]>();
  const colKey = (g: PositionGroup, k: string) => `${g}:${k}`;
  for (const [g, peers] of byGroup) {
    for (const def of METRICS) {
      columns.set(
        colKey(g, def.key),
        peers.map((p) => p.metrics[def.key]).filter((x): x is number => x !== null),
      );
    }
  }

  const out = new Map<number, Record<string, number>>();
  for (const [g, peers] of byGroup) {
    for (const p of peers) {
      const row: Record<string, number> = {};
      for (const def of metricsFor(g)) {
        const v = p.metrics[def.key];
        if (v === null || v === undefined) continue;
        const pct = percentileRank(columns.get(colKey(g, def.key)) ?? [], v);
        row[def.key] = def.inverted ? 100 - pct : pct;
      }
      out.set(p.id, row);
    }
  }
  return { minMinutes, byGroup, percentiles: out };
}
