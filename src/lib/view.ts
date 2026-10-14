import type { PizzaSlice } from '../components/PizzaChart';
import type { Lang } from './ai/schema';
import { FootballApiError } from './football/client';
import { seasonLabel } from './football/leagues';
import { CATEGORY_ORDER, metricByKey } from './football/metrics';
import type { PlayerProfile } from './football/types';
import { fmt, t } from './i18n';

/** Server-side: profile → ordered pizza slices with translated labels. */
export function slicesFor(p: PlayerProfile, lang: Lang): PizzaSlice[] {
  const d = t(lang);
  return p.percentiles
    .map((m) => ({ m, def: metricByKey(m.key)! }))
    .filter(({ def }) => !!def)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.def.category) - CATEGORY_ORDER.indexOf(b.def.category))
    .map(({ m, def }) => ({
      key: m.key,
      label: d.metrics[m.key] ?? def.label,
      category: def.category,
      categoryLabel: d.categories[def.category],
      value: m.value,
      percentile: m.percentile,
      unit: def.unit,
    }));
}

export function peerNote(p: PlayerProfile, lang: Lang) {
  const d = t(lang);
  if (!p.peerGroup || !p.position) return null;
  return fmt(d.player.vsPeers, {
    n: p.peerGroup.size,
    position: d.positionsPlural[p.position],
    league: p.league?.name ?? '',
    min: p.peerGroup.minMinutes,
  });
}

export function poolWarning(p: PlayerProfile, lang: Lang) {
  const d = t(lang);
  const s = p.poolStatus;
  if (s.pagesLoaded === 0) return d.player.poolMissing;
  if (!s.complete) return fmt(d.player.poolWarming, { loaded: s.pagesLoaded, total: s.totalPages ?? '?' });
  if (p.peerGroup && p.minutes < p.peerGroup.minMinutes) return d.player.lowMinutes;
  return null;
}

export const seasonText = (p: PlayerProfile) => seasonLabel(p.season, p.leagueId);

export function dataErrorMessage(e: unknown, lang: Lang) {
  const d = t(lang);
  if (e instanceof FootballApiError) {
    if (e.kind === 'no-key') return d.errors.noKey;
    if (e.kind === 'quota' || e.kind === 'rate') return d.errors.quota;
  }
  return d.errors.generic;
}

export interface CategoryScore {
  key: string;
  name: string;
  value: number | null;
  metrics: string;
}

/** Average percentile per category: the dossier's "scoreboard". */
export function categoryScores(slices: PizzaSlice[]): CategoryScore[] {
  const order: string[] = [];
  const by = new Map<string, PizzaSlice[]>();
  for (const s of slices) {
    if (!by.has(s.category)) {
      by.set(s.category, []);
      order.push(s.category);
    }
    by.get(s.category)!.push(s);
  }
  return order.map((key) => {
    const rows = by.get(key)!;
    const pcts = rows.map((r) => r.percentile).filter((p): p is number => p !== null);
    return {
      key,
      name: rows[0].categoryLabel,
      value: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      metrics: rows.map((r) => r.label.toLowerCase()).join(', '),
    };
  });
}

/** Percentile band → CSS colour token (same thresholds as the chart). */
export const bandVar = (p: number | null) =>
  p === null ? 'var(--line)' : p >= 67 ? 'var(--hi)' : p >= 34 ? 'var(--mid)' : 'var(--lo)';
