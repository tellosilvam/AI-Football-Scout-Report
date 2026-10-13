# AI Scout

Football scouting dossiers powered by AI. Search a player from 7 leagues and get season stats normalised per 90, percentiles against same-position peers, a structured AI scouting report whose numbers are verified against the data, and a scout you can chat with that looks up, compares and searches players with tools.

> **v2** is a full rewrite of the original Streamlit prototype (kept in [`legacy/`](legacy/), tagged `v1-streamlit`). The prototype scraped FBref's scouting tables, which disappeared when Opta pulled FBref's advanced data in January 2026. v2 uses a licensed API and computes its own percentiles.

## Features

- **Player dossier**: per-90 stats, percentile pizza chart (with accessible table view), key facts.
- **Structured AI report**: rating, ideal role, strengths and weaknesses with metric evidence, comparables, verdict. Three scout voices (data analyst, veteran scout, tactical coach).
- **Anti-hallucination guard**: every number in a report must exist in the source data; one automatic retry, otherwise confidence is forced to low and the UI shows what failed.
- **Agent chat**: streaming, with tools `getPlayerStats`, `searchPlayers`, `comparePlayers`, `findSimilar`, `discoverPlayers`.
- **Head-to-head**: metric-by-metric comparison plus an AI verdict.
- **Similar players**: blended cosine + distance over percentile profiles, filters for age and "outside the big 5".
- **Natural-language discovery**: "U23 winger outside the big 5 who dribbles a lot" → typed filters (editable chips) → ranked results.
- **Tactical fit** for possession, high press, low block or transition.
- **Share & export**: canonical URLs, dynamic OG images, print-to-PDF dossier, browser-only shortlist with CSV export.
- **EN / ES / FR / PT**, dark and light themes, public `/stats` usage page.

## Architecture

```
Browser (Astro pages + React islands)
   │
   ├─ /[lang]/player/[slug]  SSR, cached at the edge 1h
   ├─ /api/search · /api/player/:id · /api/similar        (data)
   ├─ /api/report · /api/chat · /api/fit · /api/compare · /api/discover   (AI, rate-limited)
   └─ /api/og/:id.png        satori + resvg
         │
         ▼
   src/lib/football  ──► API-Football v3 (live, cached 24h)
         │                 league pools warmed daily by Vercel Cron (/api/cron/warm)
         ▼
   Upstash Redis: API cache · league pools · report cache · rate limits · usage counters
         │
   src/lib/ai  ──► Vercel AI Gateway (REPORT_MODEL, CHAT_MODEL)
```

**Why league pools?** Percentiles, similarity and discovery need every player in a league, not one. Pools are fetched page by page under the API's per-minute limit and kept for a week, so user requests never wait on a full league download.

## Stack

Astro 7 · React 19 islands · TypeScript (strict) · Tailwind CSS 4 · Vercel AI SDK 7 + AI Gateway · Zod 4 · Upstash Redis · satori/resvg · Vitest · Vercel.

## Run locally

Requires Node 22+ (`nvm use`).

```bash
npm install
cp .env.example .env   # add API_FOOTBALL_KEY and AI_GATEWAY_API_KEY
npm run dev
```

Without Redis credentials the app uses a file cache in `.cache/`. Warm a league pool (percentiles need it):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:4321/api/cron/warm?league=39"
```

| Script | What it does |
|---|---|
| `npm run check` | Astro + TypeScript diagnostics |
| `npm test` | Unit tests: per-90 normalisation, percentiles, similarity, hallucination guard |
| `npm run evals` | Generates real reports for 15 players and reports the guard pass rate (needs keys) |
| `npm run build` | Production build (Vercel output) |

## Data and limits

- Data: [API-Football](https://www.api-football.com). The free plan allows 100 requests/day; one league pool costs ~35 requests.
- Position groups are API-Football's four (GK/DF/MF/FW); full-backs share a peer group with centre-backs.
- Percentiles are relative to each player's league. Cross-league comparisons say so in the UI.
- AI output is analysis, not fact. Verify before making decisions.

Metric definitions: [`docs/METRICS.md`](docs/METRICS.md). Plan and decisions: [`docs/PLAN.md`](docs/PLAN.md).

Built by [Miguel Tello](https://migueltello.site).
