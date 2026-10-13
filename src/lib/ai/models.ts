import { createGateway } from 'ai';
import { config, env } from '../env';

// Explicit key: Astro exposes .env through import.meta.env, which the SDK's
// process.env lookup can't see. On Vercel without a key, the gateway falls back to OIDC.
let gw: ReturnType<typeof createGateway> | null = null;
const gateway = () => (gw ??= createGateway({ apiKey: env('AI_GATEWAY_API_KEY') }));

export const reportModel = () => gateway()(config.reportModel);
export const chatModel = () => gateway()(config.chatModel);
