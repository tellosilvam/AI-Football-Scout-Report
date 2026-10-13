# AI Scout 2.0 — Plan aprobado

Rewrite of the Streamlit prototype (kept in `legacy/`, tagged `v1-streamlit`) into a portfolio-grade web product.

## Decisions (approved 2026-10-13)

| # | Decision | Choice |
|---|---|---|
| D1 | Web stack | **Astro 7** + React islands + TypeScript strict + Tailwind v4, `@astrojs/vercel` |
| D2 | Data source | **API-Football** (api-sports.io v3). FBref lost its Opta data in Jan 2026 and returns 403 to bots. |
| D3 | Data architecture | **Live API calls + cache** (no own database / ingest pipeline) |
| D4 | AI | **Vercel AI SDK v7 + AI Gateway**, model ids from env. Defaults: report `anthropic/claude-sonnet-5.5`, chat/search `anthropic/claude-haiku-5.5` |
| D5 | Repo | Rewrite **this repo** on branch `v2-astro` |
| Visual | Direction | **Scouting dossier** |
| Ideas | Scope | **All 17 approved** |

## How "live calls" coexists with percentiles, similarity and NL search

Percentiles, "similar players" and natural-language discovery need the whole population of a league, not just one player. With live calls only, that population is built **lazily and cached**:

- **Player lookups** (`/players?id=&season=`, `/players/profiles?search=`) are live, cached 24 h.
- **League pools** (`/players?league=&season=&page=N`, ~20 players/page, ~30–40 pages per league) are fetched page by page by a **Vercel Cron** warm-up route that respects the per-minute limit, and stored in **Upstash Redis** (7-day TTL). Percentiles, similarity (cosine over percentile vectors, computed in memory) and NL search run over those cached pools.
- **Reports** are cached per `player + season + lang + persona`. Rate limit per IP via `@upstash/ratelimit`; cached reports don't count.
- **Local dev without Redis** falls back to an in-memory + `.cache/` file store, so nothing external is needed except the API key.

### ⚠️ Quota reality check
Free plan = **100 requests/day, 10/min**. Bootstrapping one league pool costs ~35 requests, so the free plan warms ~2 leagues/day and leaves little for live traffic. Free-plan season access must be verified in Phase 0. If it's too tight, the **Pro plan (~$19/month)** removes the constraint. Your call, not needed to start.

## Ideas (all approved)
1 Autocomplete search · 2 Structured report (Zod) · 3 Pizza chart · 4 Tool-calling streaming chat · 5 Shareable URLs + OG image · 6 Report cache + rate limit · 7 Head-to-head compare · 8 Similar players · 9 Natural-language discovery · 10 Tactical fit · 11 Anti-hallucination guard + evals · 12 EN/ES/FR/PT · 13 PDF export · 14 Shortlist · 15 Scout persona · 16 Product landing · 17 Analytics + usage `/stats`

## Phases
0. **Spike**: verify API-Football fields, season access and quota with a real key; lock the metric map (`docs/METRICS.md`).
1. **Data layer**: API client, cache, per-90 normalization, percentiles, league pool warm-up.
2. **MVP app**: search, player page, report, pizza chart, chat, cache + rate limit → Vercel preview.
3. **Polish**: landing, OG images, i18n, evals, a11y, Lighthouse ≥ 95.
4. **Level 2**: compare, similar, discovery, tactical fit, PDF, shortlist, personas, `/stats`.
5. **Portfolio**: rewrite `aiscout.mdx` (EN/ES/FR/PT), new screenshots, `order: 1`, PR.
