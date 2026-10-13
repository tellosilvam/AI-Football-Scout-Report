import { z } from 'zod';

export const LANGS = ['en', 'es', 'fr', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export const PERSONAS = ['analyst', 'veteran', 'coach'] as const;
export type Persona = (typeof PERSONAS)[number];

export const STYLES = ['possession', 'high-press', 'low-block', 'transition'] as const;
export type TacticalStyle = (typeof STYLES)[number];

const evidence = z
  .array(
    z.object({
      metric: z.string().describe('Metric key exactly as given in the data, e.g. "key_passes_p90"'),
      note: z.string().describe('Short justification citing the value and/or percentile'),
    }),
  )
  .min(1)
  .max(3);

export const reportSchema = z.object({
  overallRating: z.number().int().min(1).max(100).describe('Overall scouting grade for their level, 1–100'),
  idealRole: z.string().describe('Most suitable tactical role, e.g. "Inverted winger", "Ball-playing CB"'),
  headline: z.string().max(140).describe('One-sentence scouting verdict'),
  tacticalProfile: z.string().describe('2–3 sentences on playing style'),
  strengths: z.array(z.object({ title: z.string(), evidence })).min(1).max(3),
  weaknesses: z.array(z.object({ title: z.string(), evidence })).min(1).max(3),
  comparablePlayers: z.array(z.string()).max(3).describe('Well-known players with a similar profile'),
  verdict: z.string().describe('Brief summary: overall level and whether the player would benefit a team'),
  confidence: z.enum(['low', 'medium', 'high']).describe('Lower when minutes or peer data are limited'),
});

export type ScoutReport = z.infer<typeof reportSchema>;

export const fitSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  pros: z.array(z.string()).min(1).max(3),
  cons: z.array(z.string()).min(1).max(3),
});
export type FitReport = z.infer<typeof fitSchema>;

export const compareSchema = z.object({
  winner: z.enum(['a', 'b', 'depends']),
  verdict: z.string(),
  edgesA: z.array(z.string()).max(3),
  edgesB: z.array(z.string()).max(3),
});
export type CompareVerdict = z.infer<typeof compareSchema>;
