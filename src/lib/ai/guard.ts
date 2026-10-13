import type { PlayerProfile } from '../football/types';
import type { ScoutReport } from './schema';

/**
 * Anti-hallucination guard: every number the model writes must exist in the
 * data it was given (rounding tolerated), and evidence must cite real metric keys.
 */
export interface GuardResult {
  ok: boolean;
  unknownNumbers: string[];
  unknownMetrics: string[];
}

// Captures plain numbers, thousands-grouped numbers (3,155 / 3.155) and ordinals
// (91st, 91e, 91º) so invented percentiles are caught too.
const NUMBER_RE = /(?<![\w.,])(\d{1,3}(?:[.,\u202f ]\d{3})+|\d+(?:[.,]\d+)?)(?:st|nd|rd|th|ème|er|e|º|ª|°|\.º)?(?![\w])/g;

/** "3,155" is 3155 in English and 3.155 in Spanish: accept either reading. */
function readings(raw: string): number[] {
  const out = [Number(raw.replace(',', '.'))];
  if (/^\d{1,3}([.,\u202f ]\d{3})+$/.test(raw)) out.push(Number(raw.replace(/[.,\u202f ]/g, '')));
  return out.filter(Number.isFinite);
}

export function allowedNumbers(p: PlayerProfile): number[] {
  const out: number[] = [90, 100, p.age ?? -1, p.minutes, p.appearances, p.starts, p.rating ?? -1, p.season, p.season + 1];
  out.push(...Object.values(p.totals));
  for (const m of p.percentiles) {
    if (m.value !== null) out.push(m.value);
    if (m.percentile !== null) out.push(m.percentile, 100 - m.percentile);
  }
  if (p.peerGroup) out.push(p.peerGroup.size, p.peerGroup.minMinutes);
  return out.filter((n) => n >= 0);
}

function matches(n: number, allowed: number[]) {
  return allowed.some((a) => Math.abs(a - n) <= Math.max(0.051, Math.abs(a) * 0.01) || Math.round(a) === n);
}

/** Numbers that are fine anywhere: small counts ("top 3", "2 strengths"), formation digits, etc. */
const isTrivial = (raw: string, n: number) => (Number.isInteger(n) && n <= 11) || /^\d{1}-\d/.test(raw);

export function checkText(text: string, allowed: number[]): string[] {
  const bad: string[] = [];
  for (const match of text.matchAll(NUMBER_RE)) {
    const raw = match[0];
    const values = readings(match[1]);
    if (values.some((n) => isTrivial(raw, n))) continue;
    if (!values.some((n) => matches(n, allowed))) bad.push(raw);
  }
  return bad;
}

export function guardReport(report: ScoutReport, p: PlayerProfile): GuardResult {
  const allowed = allowedNumbers(p);
  const known = new Set(p.percentiles.map((m) => m.key));
  const texts = [
    report.headline,
    report.tacticalProfile,
    report.verdict,
    ...[...report.strengths, ...report.weaknesses].flatMap((s) => [s.title, ...s.evidence.map((e) => e.note)]),
  ];
  const unknownNumbers = texts.flatMap((t) => checkText(t, allowed));
  const unknownMetrics = [...report.strengths, ...report.weaknesses]
    .flatMap((s) => s.evidence.map((e) => e.metric))
    .filter((k) => !known.has(k));
  return { ok: !unknownNumbers.length && !unknownMetrics.length, unknownNumbers, unknownMetrics };
}
