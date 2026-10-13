// Server-only environment access. Works in `astro dev`, `astro build` and on Vercel.
export function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  const fromVite = ((import.meta.env ?? {}) as Record<string, string | undefined>)[name];
  const value = fromProcess ?? fromVite;
  return value === '' ? undefined : value;
}

export const config = {
  get apiFootballKey() {
    return env('API_FOOTBALL_KEY');
  },
  get reportModel() {
    return env('REPORT_MODEL') ?? 'anthropic/claude-sonnet-5.5';
  },
  /**
   * Latest season the API plan can read. API-Football's free plan stops at 2024;
   * leave unset on a paid plan to always use the current season.
   */
  get maxSeason() {
    const v = Number(env('DATA_MAX_SEASON'));
    return Number.isFinite(v) && v > 2000 ? v : null;
  },
  /** Highest `page` the plan allows (free: 3). Unset = no cap; a plan error at runtime is still handled. */
  get maxPage() {
    const v = Number(env('DATA_MAX_PAGE'));
    return Number.isFinite(v) && v > 0 ? v : 99;
  },
  get chatModel() {
    return env('CHAT_MODEL') ?? 'anthropic/claude-haiku-5.5';
  },
  /** Vercel Marketplace Upstash exposes KV_REST_API_*; plain Upstash uses UPSTASH_REDIS_REST_*. */
  get redisUrl() {
    return env('UPSTASH_REDIS_REST_URL') ?? env('KV_REST_API_URL');
  },
  get redisToken() {
    return env('UPSTASH_REDIS_REST_TOKEN') ?? env('KV_REST_API_TOKEN');
  },
  get cronSecret() {
    return env('CRON_SECRET');
  },
  /** New (uncached) AI reports allowed per IP per day. */
  get reportsPerDay() {
    return Number(env('REPORTS_PER_IP_PER_DAY') ?? 10);
  },
  get chatMessagesPerHour() {
    return Number(env('CHAT_MESSAGES_PER_IP_PER_HOUR') ?? 40);
  },
};
