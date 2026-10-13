import { seasonLabel } from '../football/leagues';
import { metricByKey, POSITION_LABEL } from '../football/metrics';
import type { PlayerProfile } from '../football/types';
import type { Lang, Persona } from './schema';

export const LANG_NAME: Record<Lang, string> = { en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese' };

export const PERSONA_PROMPT: Record<Persona, string> = {
  analyst:
    'You are a data-driven football analyst. You speak in precise, measured language and lean on numbers and percentiles.',
  veteran:
    'You are a veteran football scout with 30 years on the road. You write with the colour and instinct of the trade, but every claim is still backed by the data provided.',
  coach:
    'You are a tactical head coach evaluating a potential signing. You think in roles, systems and game phases.',
};

/** Compact, model-friendly description of a player's season. The ONLY numbers the model may cite. */
export function playerContext(p: PlayerProfile): string {
  const lines = [
    `Player: ${p.fullName} (${p.name})`,
    `Position group: ${p.position ? POSITION_LABEL[p.position] : 'Unknown'}`,
    `Age: ${p.age ?? 'unknown'} · Nationality: ${p.nationality ?? 'unknown'}`,
    `Club: ${p.team?.name ?? 'unknown'} · League: ${p.league?.name ?? 'unknown'} · Season: ${seasonLabel(p.season, p.leagueId)}`,
    `Appearances: ${p.appearances} (${p.starts} starts) · Minutes: ${p.minutes} · Avg match rating: ${p.rating ?? 'n/a'}`,
    `Goals: ${p.totals.goals} · Assists: ${p.totals.assists} · Yellow cards: ${p.totals.yellow} · Red cards: ${p.totals.red}`,
    p.peerGroup
      ? `Percentiles are vs. ${p.peerGroup.size} ${p.position ? POSITION_LABEL[p.position] : ''}s in the same league with ≥${p.peerGroup.minMinutes} minutes.`
      : 'Peer percentiles are not available yet; judge from raw per-90 values only.',
    '',
    'metric_key | label | value | percentile',
  ];
  for (const m of p.percentiles) {
    const def = metricByKey(m.key);
    if (!def || m.value === null) continue;
    const unit = def.unit === 'pct' ? '%' : ' per 90';
    lines.push(`${m.key} | ${def.label}${def.inverted ? ' (lower is better)' : ''} | ${m.value}${unit} | ${m.percentile ?? 'n/a'}`);
  }
  return lines.join('\n');
}

export function reportInstructions(persona: Persona, lang: Lang) {
  return [
    PERSONA_PROMPT[persona],
    `Write every text field in ${LANG_NAME[lang]}. Keep football terminology natural for that language.`,
    'Rules:',
    '- Use ONLY the data provided. Never invent statistics, transfer fees, injuries or match events.',
    '- Every number you write must appear in the data (you may round to 1 decimal).',
    '- Evidence items must reference metric keys exactly as listed in the table (the `metric` field only).',
    '- In all prose (headline, profile, notes, verdict) name metrics in plain words in the output language, never by their key, and translate "per 90" (e.g. "por 90", "par 90", "por 90").',
    '- Prefer percentiles over raw values when they exist: "91st percentile for key passes among league forwards" says more than a raw number.',
    '- If minutes are low (< 900) or percentiles are missing, lower `confidence` and say so in the verdict.',
    '- Comparable players are illustrative style references, not statistical claims.',
  ].join('\n');
}
