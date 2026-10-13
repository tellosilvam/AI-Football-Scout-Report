import { generateText, Output } from 'ai';
import { z } from 'zod';
import { cached } from '../cache';
import { config } from '../env';
import { LEAGUES } from '../football/leagues';
import { METRICS } from '../football/metrics';
import type { PlayerProfile } from '../football/types';
import { trackUsage } from '../usage';
import { LANG_NAME, playerContext } from './context';
import { compareSchema, fitSchema, type CompareVerdict, type FitReport, type Lang, type TacticalStyle } from './schema';
import { discoverInput } from './tools';

const WEEK = 60 * 60 * 24 * 7;

const STYLE_BRIEF: Record<TacticalStyle, string> = {
  possession: 'Possession-based: short build-up, high pass volume, patience, positional play.',
  'high-press': 'High press: aggressive counter-pressing, duels and ball recoveries high up the pitch, intensity.',
  'low-block': 'Low block: compact defending, aerial and defensive duels, blocks, then quick outlets.',
  transition: 'Transition: fast vertical attacks, dribbling, carrying, finishing on the break.',
};

export async function tacticalFit(p: PlayerProfile, style: TacticalStyle, lang: Lang): Promise<FitReport> {
  return cached(`fit:${p.id}:${p.season}:${style}:${lang}`, WEEK, async () => {
    const { output, usage } = await generateText({
      model: config.chatModel,
      instructions: `You are a tactical head coach. Answer in ${LANG_NAME[lang]}. Use only the data given; every number you cite must appear in it.`,
      output: Output.object({ schema: fitSchema }),
      prompt: `Evaluate how well this player fits this system.\nSystem: ${STYLE_BRIEF[style]}\n\n${playerContext(p)}`,
    });
    await trackUsage(usage);
    return output;
  });
}

export async function compareVerdict(a: PlayerProfile, b: PlayerProfile, lang: Lang): Promise<CompareVerdict> {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  const verdict = await cached(`compare:${x.id}:${x.season}:${y.id}:${y.season}:${lang}`, WEEK, async () => {
    const { output, usage } = await generateText({
      model: config.chatModel,
      instructions: `You are a professional football scout. Answer in ${LANG_NAME[lang]}. Use only the data given. Note that percentiles are relative to each player's own league; flag it when leagues or position groups differ.`,
      output: Output.object({ schema: compareSchema }),
      prompt: `Compare Player A and Player B and give a verdict. "a" refers to Player A.\n\n## Player A\n${playerContext(x)}\n\n## Player B\n${playerContext(y)}`,
    });
    await trackUsage(usage);
    return output;
  });
  // Cache is keyed by sorted ids; flip back to the caller's order.
  if (x.id === a.id) return verdict;
  const flip = { a: 'b', b: 'a', depends: 'depends' } as const;
  return { ...verdict, winner: flip[verdict.winner], edgesA: verdict.edgesB, edgesB: verdict.edgesA };
}

const interpretSchema = z.object({
  filters: discoverInput,
  explanation: z.string().describe('One sentence restating how the request was interpreted'),
});

/** Natural-language request → typed discovery filters. */
export async function interpretQuery(query: string, lang: Lang) {
  return cached(`nlq:${lang}:${query.trim().toLowerCase()}`, WEEK, async () => {
    const { output, usage } = await generateText({
      model: config.chatModel,
      instructions: [
        `Translate a football scouting request into search filters. Write the explanation in ${LANG_NAME[lang]}.`,
        'Position groups: GK, DF (centre-backs and full-backs), MF, FW (strikers and wingers).',
        `Leagues: ${LEAGUES.map((l) => `${l.id}=${l.name} (${l.country})`).join(', ')}.`,
        `Metric keys: ${METRICS.map((m) => `${m.key} (${m.label})`).join(', ')}.`,
        'Map qualitative words to minimum percentiles: "good" ≈ 60, "very good"/"elite" ≈ 80. "Young"/"U23" → maxAge 23.',
        'Use only metric keys from the list. Leave filters out rather than guessing.',
      ].join('\n'),
      output: Output.object({ schema: interpretSchema }),
      prompt: query,
    });
    await trackUsage(usage);
    return output;
  });
}
