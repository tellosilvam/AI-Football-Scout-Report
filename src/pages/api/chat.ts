import type { APIRoute } from 'astro';
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from 'ai';
import { z } from 'zod';
import { getCachedReport } from '../../lib/ai/report';
import { LANG_NAME, PERSONA_PROMPT, playerContext } from '../../lib/ai/context';
import { scoutTools } from '../../lib/ai/tools';
import { config } from '../../lib/env';
import { getPlayerProfile } from '../../lib/football/service';
import { badRequest, errorResponse, idSchema, json, langSchema, personaSchema, readJson, seasonSchema } from '../../lib/http';
import { ipOf, limit, tooMany } from '../../lib/ratelimit';
import { bump, trackUsage } from '../../lib/usage';
import { chatModel } from '../../lib/ai/models';

export const prerender = false;

const body = z.object({
  messages: z.array(z.custom<UIMessage>((m) => typeof m === 'object' && m !== null && 'role' in m)).min(1).max(40),
  playerId: idSchema,
  season: seasonSchema,
  lang: langSchema,
  persona: personaSchema,
});

export const POST: APIRoute = async (ctx) => {
  const input = await readJson(ctx.request, body);
  if (input instanceof z.ZodError) return badRequest(input);

  const rl = await limit('chat', ipOf(ctx), config.chatMessagesPerHour, 60 * 60);
  if (!rl.ok) return tooMany(rl, 'Chat limit reached');

  try {
    const profile = await getPlayerProfile(input.playerId, input.season);
    if (!profile) return json({ error: 'not_found' }, { status: 404 });
    const report = await getCachedReport(profile, input.lang, input.persona);

    const instructions = [
      PERSONA_PROMPT[input.persona],
      `You are chatting with a user about ${profile.name}. Reply in ${LANG_NAME[input.lang]}, conversational, concise but insightful (max ~180 words unless asked for more).`,
      'Ground every claim in data: the player data below or tool results. Never invent statistics.',
      'Use tools when the user mentions other players, asks for comparisons, similar players or league-wide searches.',
      'When you cite a metric, mention its value and percentile.',
      '',
      '## Player data',
      playerContext(profile),
      report ? `\n## Your earlier scouting report (JSON)\n${JSON.stringify(report.report)}` : '',
    ].join('\n');

    const tools = scoutTools(profile);
    const result = streamText({
      model: chatModel(),
      instructions,
      messages: await convertToModelMessages(input.messages),
      tools,
      stopWhen: isStepCount(5),
      onEnd: async ({ usage }) => {
        await Promise.all([trackUsage(usage), bump('chat_messages')]);
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, tools, onError: () => 'The scout could not answer right now.' }),
    });
  } catch (e) {
    return errorResponse(e);
  }
};
