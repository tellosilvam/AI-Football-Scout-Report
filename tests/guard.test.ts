import { describe, expect, it } from 'vitest';
import { checkText, guardReport } from '../src/lib/ai/guard';
import type { ScoutReport } from '../src/lib/ai/schema';
import type { PlayerProfile } from '../src/lib/football/types';
import { normalizeEntry } from '../src/lib/football/normalize';
import { entry, stats } from './fixtures';

const season = normalizeEntry(entry(1, [stats()]), 39)!;
const profile: PlayerProfile = {
  ...season,
  percentiles: [
    { key: 'key_passes_p90', value: 2, percentile: 91 },
    { key: 'goals_p90', value: 0.25, percentile: 64 },
    { key: 'tackles_p90', value: 1.5, percentile: 22 },
  ],
  peerGroup: { label: 'MF', size: 118, minMinutes: 540 },
  poolStatus: { leagueId: 39, season: 2025, pagesLoaded: 30, totalPages: 30, complete: true, updatedAt: null },
};

const report = (over: Partial<ScoutReport> = {}): ScoutReport => ({
  overallRating: 78,
  idealRole: 'Advanced playmaker',
  headline: 'Creative hub with 2 key passes per 90.',
  tacticalProfile: 'Ranks in the 91st percentile for key passes among 118 midfielders.',
  strengths: [{ title: 'Chance creation', evidence: [{ metric: 'key_passes_p90', note: '2.0 per 90, 91st percentile' }] }],
  weaknesses: [{ title: 'Defensive output', evidence: [{ metric: 'tackles_p90', note: '1.5 tackles per 90 (22nd percentile)' }] }],
  comparablePlayers: ['Example Player'],
  verdict: 'Played 1800 minutes; a reliable creator.',
  confidence: 'high',
  ...over,
});

describe('anti-hallucination guard', () => {
  it('accepts numbers that exist in the data, with rounding', () => {
    expect(guardReport(report(), profile)).toEqual({ ok: true, unknownNumbers: [], unknownMetrics: [] });
  });

  it('flags invented numbers', () => {
    const g = guardReport(report({ verdict: 'Scored 27 goals and has 3.4 xG per 90.' }), profile);
    expect(g.ok).toBe(false);
    expect(g.unknownNumbers).toEqual(expect.arrayContaining(['27', '3.4']));
  });

  it('flags evidence pointing to metrics that were not provided', () => {
    const g = guardReport(report({ strengths: [{ title: 'Aerial', evidence: [{ metric: 'aerials_won_p90', note: 'strong' }] }] }), profile);
    expect(g.unknownMetrics).toEqual(['aerials_won_p90']);
  });

  it('ignores small counts and formations', () => {
    expect(checkText('Top 3 traits in a 4-3-3', [])).toEqual([]);
  });
});
