import { tool } from 'ai';
import { z } from 'zod';
import { metricByKey, METRICS } from '../football/metrics';
import { discover, type DiscoverFilters, getPlayerProfile, percentileMap, searchPlayers, similarPlayers } from '../football/service';
import type { PlayerProfile } from '../football/types';
import { LEAGUES } from '../football/leagues';

/** Compact profile for tool results: keeps token use low and numbers citeable. */
export function compactProfile(p: PlayerProfile) {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    position: p.position,
    club: p.team?.name,
    league: p.league?.name,
    season: p.season,
    minutes: p.minutes,
    appearances: p.appearances,
    rating: p.rating,
    goals: p.totals.goals,
    assists: p.totals.assists,
    peers: p.peerGroup?.size ?? 0,
    metrics: p.percentiles
      .filter((m) => m.value !== null)
      .map((m) => ({ key: m.key, label: metricByKey(m.key)?.label, value: m.value, percentile: m.percentile })),
  };
}

const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const;
const metricKey = z.enum(METRICS.map((m) => m.key) as [string, ...string[]]);

export const discoverInput = z.object({
  position: z.enum(POSITIONS).optional().describe('GK, DF (defenders incl. full-backs), MF, FW (forwards and wingers)'),
  minAge: z.number().int().min(15).max(45).optional(),
  maxAge: z.number().int().min(15).max(45).optional(),
  leagueIds: z
    .array(z.number().int())
    .optional()
    .describe(`Restrict to leagues: ${LEAGUES.map((l) => `${l.id}=${l.name}`).join(', ')}`),
  excludeBig5: z.boolean().optional().describe('Exclude the big 5 European leagues'),
  minMinutes: z.number().int().optional(),
  minPercentiles: z
    .array(z.object({ metric: metricKey, min: z.number().min(0).max(100) }))
    .optional()
    .describe('Minimum percentile per metric, e.g. [{"metric":"dribbles_p90","min":70}]'),
  sortBy: metricKey.optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export type DiscoverInput = z.infer<typeof discoverInput>;

/** Model-facing filter shape → service filter shape. */
export const toDiscoverFilters = ({ minPercentiles, ...rest }: DiscoverInput): DiscoverFilters => ({
  ...rest,
  minPercentiles: minPercentiles?.length ? Object.fromEntries(minPercentiles.map((m) => [m.metric, m.min])) : undefined,
});

export function scoutTools(current: PlayerProfile) {
  return {
    getPlayerStats: tool({
      description:
        'Get season stats and percentiles for a player by id. Use for the current player or any player found with searchPlayers.',
      inputSchema: z.object({ playerId: z.number().int() }),
      execute: async ({ playerId }) => {
        const p = playerId === current.id ? current : await getPlayerProfile(playerId);
        return p ? compactProfile(p) : { error: 'Player not found' };
      },
    }),
    searchPlayers: tool({
      description: 'Find players by name. Returns ids to use with getPlayerStats or comparePlayers.',
      inputSchema: z.object({ name: z.string().min(3) }),
      execute: async ({ name }) => (await searchPlayers(name, 5)).map((p) => ({ id: p.id, name: p.name, club: p.team?.name ?? null, position: p.position })),
    }),
    comparePlayers: tool({
      description: 'Compare the current player with another player id, metric by metric (values and percentiles).',
      inputSchema: z.object({ otherPlayerId: z.number().int() }),
      execute: async ({ otherPlayerId }) => {
        const other = await getPlayerProfile(otherPlayerId);
        if (!other) return { error: 'Player not found' };
        const a = percentileMap(current);
        const b = percentileMap(other);
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
        return {
          a: { id: current.id, name: current.name, club: current.team?.name, minutes: current.minutes },
          b: { id: other.id, name: other.name, club: other.team?.name, minutes: other.minutes },
          samePositionGroup: current.position === other.position,
          metrics: keys.map((k) => ({
            key: k,
            label: metricByKey(k)?.label,
            a: current.metrics[k] ?? null,
            aPct: a[k] ?? null,
            b: other.metrics[k] ?? null,
            bPct: b[k] ?? null,
          })),
        };
      },
    }),
    findSimilar: tool({
      description: 'Find players with a similar statistical style to the current player, across cached leagues.',
      inputSchema: z.object({
        maxAge: z.number().int().optional(),
        excludeBig5: z.boolean().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (f) => {
        const hits = await similarPlayers(current, { ...f, limit: f.limit ?? 5 });
        return hits.map((h) => ({
          id: h.player.id,
          name: h.player.name,
          age: h.player.age,
          club: h.player.team?.name,
          league: h.player.league?.name,
          similarity: h.similarity,
        }));
      },
    }),
    discoverPlayers: tool({
      description: 'Search all cached leagues with structured filters (position, age, league, minimum percentiles).',
      inputSchema: discoverInput,
      execute: async (f) => {
        const { hits } = await discover({ ...toDiscoverFilters(f), limit: f.limit ?? 6 });
        return hits.map((h) => ({ id: h.player.id, name: h.player.name, age: h.player.age, club: h.player.team?.name, score: h.score }));
      },
    }),
  };
}

export type ScoutTools = ReturnType<typeof scoutTools>;
