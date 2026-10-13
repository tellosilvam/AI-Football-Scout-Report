import { metricsFor } from './metrics';
import { poolPercentiles } from './percentiles';
import type { PlayerSeason, PositionGroup } from './types';

export interface SimilarFilters {
  maxAge?: number;
  excludeBig5?: boolean;
  leagueIds?: number[];
  limit?: number;
}

export interface SimilarHit {
  player: PlayerSeason;
  similarity: number; // 0–100
  percentiles: Record<string, number>;
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function rms(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / a.length);
}

/**
 * Blend of two views on percentile profiles:
 * - shape: cosine over centred vectors (percentile − 50), "good at the same things";
 * - level: 1 − RMS distance, so near-average players still get sensible matches
 *   (their centred vectors are close to zero and cosine alone is unstable).
 * Percentiles are within each player's own league.
 */
export function findSimilar(
  target: { id: number; position: PositionGroup | null; percentiles: Record<string, number> },
  pools: PlayerSeason[][],
  big5Ids: Set<number>,
  filters: SimilarFilters = {},
): SimilarHit[] {
  if (!target.position) return [];
  const keys = metricsFor(target.position).map((m) => m.key).filter((k) => k in target.percentiles);
  if (keys.length < 4) return [];
  const tv = keys.map((k) => target.percentiles[k] - 50);

  const hits: SimilarHit[] = [];
  for (const pool of pools) {
    const { percentiles, byGroup } = poolPercentiles(pool);
    for (const p of byGroup.get(target.position) ?? []) {
      if (p.id === target.id) continue;
      if (filters.maxAge && (p.age ?? 99) > filters.maxAge) continue;
      if (filters.excludeBig5 && big5Ids.has(p.leagueId)) continue;
      if (filters.leagueIds?.length && !filters.leagueIds.includes(p.leagueId)) continue;
      const row = percentiles.get(p.id);
      if (!row) continue;
      const pv = keys.map((k) => (row[k] ?? 50) - 50);
      const shape = (cosine(tv, pv) + 1) / 2;
      const level = 1 - rms(tv, pv) / 100;
      hits.push({ player: p, similarity: Math.round((0.5 * shape + 0.5 * level) * 100), percentiles: row });
    }
  }
  return hits.sort((a, b) => b.similarity - a.similarity).slice(0, filters.limit ?? 8);
}
