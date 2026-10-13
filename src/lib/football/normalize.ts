import { METRICS, toPositionGroup } from './metrics';
import type { ApiPlayerEntry, ApiStatistics, PlayerSeason } from './types';

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function totalsOf(s: ApiStatistics): Record<string, number> {
  return {
    goals: n(s.goals.total),
    assists: n(s.goals.assists),
    conceded: n(s.goals.conceded),
    saves: n(s.goals.saves),
    shots: n(s.shots.total),
    shots_on: n(s.shots.on),
    passes: n(s.passes.total),
    key_passes: n(s.passes.key),
    tackles: n(s.tackles.total),
    blocks: n(s.tackles.blocks),
    interceptions: n(s.tackles.interceptions),
    duels: n(s.duels.total),
    duels_won: n(s.duels.won),
    dribbles_attempts: n(s.dribbles.attempts),
    dribbles_success: n(s.dribbles.success),
    dribbled_past: n(s.dribbles.past),
    fouls_drawn: n(s.fouls.drawn),
    fouls_committed: n(s.fouls.committed),
    yellow: n(s.cards.yellow),
    red: n(s.cards.red) + n(s.cards.yellowred),
    pen_won: n(s.penalty.won),
    pen_scored: n(s.penalty.scored),
    pen_missed: n(s.penalty.missed),
    pen_saved: n(s.penalty.saved),
  };
}

/**
 * Collapse an API entry into one season line for `leagueId`.
 * Players transferred within the league have several `statistics` rows; totals are summed.
 * If `leagueId` is omitted, the league where the player logged the most minutes is used.
 */
export function normalizeEntry(entry: ApiPlayerEntry, leagueId?: number): PlayerSeason | null {
  const rows = entry.statistics.filter((s) => s.league.id !== null);
  if (!rows.length) return null;

  const targetLeague =
    leagueId ??
    [...rows].sort((a, b) => n(b.games.minutes) - n(a.games.minutes))[0].league.id!;
  const inLeague = rows.filter((s) => s.league.id === targetLeague);
  if (!inLeague.length) return null;

  const main = [...inLeague].sort((a, b) => n(b.games.minutes) - n(a.games.minutes))[0];
  const totals: Record<string, number> = {};
  let minutes = 0;
  let appearances = 0;
  let starts = 0;
  let ratingWeighted = 0;
  let ratingMinutes = 0;

  for (const s of inLeague) {
    for (const [k, v] of Object.entries(totalsOf(s))) totals[k] = (totals[k] ?? 0) + v;
    const m = n(s.games.minutes);
    minutes += m;
    appearances += n(s.games.appearences);
    starts += n(s.games.lineups);
    const r = s.games.rating ? Number.parseFloat(s.games.rating) : NaN;
    if (Number.isFinite(r) && m > 0) {
      ratingWeighted += r * m;
      ratingMinutes += m;
    }
  }

  const metrics: Record<string, number | null> = {};
  for (const def of METRICS) {
    const v = def.compute(totals, minutes);
    metrics[def.key] = v === null ? null : Math.round(v * 100) / 100;
  }

  const p = entry.player;
  return {
    id: p.id,
    name: p.name,
    fullName: [p.firstname, p.lastname].filter(Boolean).join(' ') || p.name,
    photo: p.photo,
    age: p.age,
    nationality: p.nationality,
    position: toPositionGroup(main.games.position ?? p.position),
    team: { id: main.team.id, name: main.team.name, logo: main.team.logo },
    league: { id: targetLeague, name: main.league.name, logo: main.league.logo },
    season: main.league.season,
    leagueId: targetLeague,
    height: p.height,
    weight: p.weight,
    injured: !!p.injured,
    appearances,
    starts,
    minutes,
    rating: ratingMinutes > 0 ? Math.round((ratingWeighted / ratingMinutes) * 100) / 100 : null,
    totals,
    metrics,
  };
}

export function slugify(name: string, id: number) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'player'}-${id}`;
}

export function idFromSlug(slug: string): number | null {
  const m = /-?(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}
