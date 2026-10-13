import { generateText, Output } from 'ai';
import { kv } from '../cache';
import { config } from '../env';
import type { PlayerProfile } from '../football/types';
import { bump, trackUsage } from '../usage';
import { playerContext, reportInstructions } from './context';
import { guardReport, type GuardResult } from './guard';
import { reportSchemaFor, type Lang, type Persona, type ScoutReport } from './schema';
import { reportModel } from './models';

export interface StoredReport {
  report: ScoutReport;
  guard: GuardResult;
  model: string;
  generatedAt: string;
  attempts: number;
}

const TTL = 60 * 60 * 24 * 7;
export const reportKey = (p: Pick<PlayerProfile, 'id' | 'season' | 'leagueId'>, lang: Lang, persona: Persona) =>
  `report:${p.id}:${p.leagueId}:${p.season}:${lang}:${persona}`;

export async function getCachedReport(p: PlayerProfile, lang: Lang, persona: Persona) {
  return kv().get<StoredReport>(reportKey(p, lang, persona));
}

/**
 * Generate a structured report and validate it against the data.
 * One retry with the guard's findings fed back; if it still fails, the report
 * is kept with confidence forced to "low" and the guard result exposed in the UI.
 */
export async function generateReport(p: PlayerProfile, lang: Lang, persona: Persona): Promise<StoredReport> {
  const context = playerContext(p);
  const instructions = reportInstructions(persona, lang);
  const schema = reportSchemaFor(p.percentiles.filter((m) => m.value !== null).map((m) => m.key));
  let feedback = '';
  let last: { report: ScoutReport; guard: GuardResult } | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { output, usage } = await generateText({
      model: reportModel(),
      instructions,
      output: Output.object({ schema }),
      prompt: `Create a scouting report on this player.\n\n${context}${feedback}`,
      // Only read by reasoning models (e.g. gpt-5-mini); other providers ignore it.
      providerOptions: { openai: { reasoningEffort: 'low' } },
    });
    await trackUsage(usage);
    const guard = guardReport(output, p);
    last = { report: output, guard };
    if (guard.ok) break;
    feedback = `\n\nYour previous draft cited values not present in the data: ${[...guard.unknownNumbers, ...guard.unknownMetrics].join(', ')}. Only use values and metric keys from the table.`;
  }

  const result = last!;
  if (!result.guard.ok) result.report.confidence = 'low';
  const stored: StoredReport = {
    ...result,
    model: config.reportModel,
    generatedAt: new Date().toISOString(),
    attempts: feedback ? 2 : 1,
  };
  await kv().set(reportKey(p, lang, persona), stored, TTL);
  await bump('reports');
  return stored;
}
