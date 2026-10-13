import type { PositionGroup } from './types';

export type Category = 'attack' | 'creation' | 'possession' | 'defense' | 'goalkeeping';

export interface MetricDef {
  key: string;
  category: Category;
  /** Short label (EN) – translated in the UI via i18n `metric.<key>`. */
  label: string;
  unit: 'p90' | 'pct';
  /** Lower is better (e.g. times dribbled past). Percentile is inverted. */
  inverted?: boolean;
  /** Position groups where the metric is shown on the radar. */
  groups: PositionGroup[];
  /** Compute from season totals + minutes. Return null when the denominator is 0. */
  compute: (t: Record<string, number>, minutes: number) => number | null;
}

const per90 = (v: number, minutes: number) => (minutes > 0 ? (v / minutes) * 90 : null);
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const OUTFIELD: PositionGroup[] = ['DF', 'MF', 'FW'];

/**
 * Metric map: API-Football season totals → radar metrics.
 * Documented in docs/METRICS.md. `passes.accuracy` semantics must be confirmed in the Phase 0 spike.
 */
export const METRICS: MetricDef[] = [
  // Attack
  { key: 'goals_p90', category: 'attack', label: 'Goals', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.goals, m) },
  { key: 'shots_p90', category: 'attack', label: 'Shots', unit: 'p90', groups: ['MF', 'FW'], compute: (t, m) => per90(t.shots, m) },
  { key: 'shots_on_target_pct', category: 'attack', label: 'Shot accuracy', unit: 'pct', groups: ['MF', 'FW'], compute: (t) => ratio(t.shots_on, t.shots) },
  { key: 'goals_per_shot_pct', category: 'attack', label: 'Conversion', unit: 'pct', groups: ['FW'], compute: (t) => ratio(t.goals, t.shots) },
  // Creation
  { key: 'assists_p90', category: 'creation', label: 'Assists', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.assists, m) },
  { key: 'key_passes_p90', category: 'creation', label: 'Key passes', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.key_passes, m) },
  { key: 'fouls_drawn_p90', category: 'creation', label: 'Fouls won', unit: 'p90', groups: ['MF', 'FW'], compute: (t, m) => per90(t.fouls_drawn, m) },
  // Possession
  { key: 'passes_p90', category: 'possession', label: 'Passes', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.passes, m) },
  { key: 'dribbles_p90', category: 'possession', label: 'Dribbles completed', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.dribbles_success, m) },
  { key: 'dribble_success_pct', category: 'possession', label: 'Dribble success', unit: 'pct', groups: ['MF', 'FW'], compute: (t) => ratio(t.dribbles_success, t.dribbles_attempts) },
  // Defense
  { key: 'tackles_p90', category: 'defense', label: 'Tackles', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.tackles, m) },
  { key: 'interceptions_p90', category: 'defense', label: 'Interceptions', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.interceptions, m) },
  { key: 'blocks_p90', category: 'defense', label: 'Blocks', unit: 'p90', groups: ['DF', 'MF'], compute: (t, m) => per90(t.blocks, m) },
  { key: 'duels_won_p90', category: 'defense', label: 'Duels won', unit: 'p90', groups: OUTFIELD, compute: (t, m) => per90(t.duels_won, m) },
  { key: 'duel_win_pct', category: 'defense', label: 'Duel success', unit: 'pct', groups: OUTFIELD, compute: (t) => ratio(t.duels_won, t.duels) },
  { key: 'dribbled_past_p90', category: 'defense', label: 'Dribbled past', unit: 'p90', inverted: true, groups: ['DF', 'MF'], compute: (t, m) => per90(t.dribbled_past, m) },
  // Goalkeeping
  { key: 'saves_p90', category: 'goalkeeping', label: 'Saves', unit: 'p90', groups: ['GK'], compute: (t, m) => per90(t.saves, m) },
  { key: 'save_pct', category: 'goalkeeping', label: 'Save %', unit: 'pct', groups: ['GK'], compute: (t) => ratio(t.saves, t.saves + t.conceded) },
  { key: 'conceded_p90', category: 'goalkeeping', label: 'Goals conceded', unit: 'p90', inverted: true, groups: ['GK'], compute: (t, m) => per90(t.conceded, m) },
  { key: 'gk_passes_p90', category: 'goalkeeping', label: 'Passes', unit: 'p90', groups: ['GK'], compute: (t, m) => per90(t.passes, m) },
  { key: 'pen_saved', category: 'goalkeeping', label: 'Penalties saved', unit: 'p90', groups: ['GK'], compute: (t, m) => per90(t.pen_saved, m) },
];

export const metricByKey = (key: string) => METRICS.find((m) => m.key === key) ?? null;
export const metricsFor = (group: PositionGroup | null) => METRICS.filter((m) => group && m.groups.includes(group));

export const CATEGORY_ORDER: Category[] = ['attack', 'creation', 'possession', 'defense', 'goalkeeping'];

export const POSITION_LABEL: Record<PositionGroup, string> = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
};

export function toPositionGroup(pos: string | null | undefined): PositionGroup | null {
  switch ((pos ?? '').toLowerCase()) {
    case 'goalkeeper':
    case 'g':
      return 'GK';
    case 'defender':
    case 'd':
      return 'DF';
    case 'midfielder':
    case 'm':
      return 'MF';
    case 'attacker':
    case 'forward':
    case 'f':
      return 'FW';
    default:
      return null;
  }
}
