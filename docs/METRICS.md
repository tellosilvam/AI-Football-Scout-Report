# Metric map

Source: API-Football v3 `/players` season totals. Code: [`src/lib/football/metrics.ts`](../src/lib/football/metrics.ts).

All `p90` metrics are `total / minutes × 90`. `%` metrics are ratios. Percentiles are computed **within the same position group and the same league-season**, among players with at least `max(270, min(900, 30% of the most-played player's minutes))` minutes. Fewer than 5 peers → no percentile.

| Key | Category | Formula (API fields) | Groups | Notes |
|---|---|---|---|---|
| `goals_p90` | Attack | `goals.total` | DF MF FW | |
| `shots_p90` | Attack | `shots.total` | MF FW | |
| `shots_on_target_pct` | Attack | `shots.on / shots.total` | MF FW | |
| `goals_per_shot_pct` | Attack | `goals.total / shots.total` | FW | |
| `assists_p90` | Creation | `goals.assists` | DF MF FW | |
| `key_passes_p90` | Creation | `passes.key` | DF MF FW | |
| `fouls_drawn_p90` | Creation | `fouls.drawn` | MF FW | |
| `passes_p90` | Possession | `passes.total` | DF MF FW | |
| `dribbles_p90` | Possession | `dribbles.success` | DF MF FW | |
| `dribble_success_pct` | Possession | `dribbles.success / dribbles.attempts` | MF FW | |
| `tackles_p90` | Defense | `tackles.total` | DF MF FW | |
| `interceptions_p90` | Defense | `tackles.interceptions` | DF MF FW | |
| `blocks_p90` | Defense | `tackles.blocks` | DF MF | |
| `duels_won_p90` | Defense | `duels.won` | DF MF FW | |
| `duel_win_pct` | Defense | `duels.won / duels.total` | DF MF FW | |
| `dribbled_past_p90` | Defense | `dribbles.past` | DF MF | Lower is better (percentile inverted) |
| `saves_p90` | Goalkeeping | `goals.saves` | GK | |
| `save_pct` | Goalkeeping | `saves / (saves + goals.conceded)` | GK | |
| `conceded_p90` | Goalkeeping | `goals.conceded` | GK | Lower is better |
| `gk_passes_p90` | Goalkeeping | `passes.total` | GK | |
| `pen_saved` | Goalkeeping | `penalty.saved` | GK | per 90 |

## Position groups
API-Football only exposes four positions (`Goalkeeper`, `Defender`, `Midfielder`, `Attacker`), so peers are GK / DF / MF / FW. Full-backs are compared with centre-backs and wingers with strikers. This is a known limitation of the source and is stated in the UI.

## Phase 0 spike results (2026-10-13, free plan)
- **Seasons**: free plan reads 2022–2024 only (`Free plans do not have access to this season`). `DATA_MAX_SEASON=2024` caps every season the app asks for. `/players/seasons` still lists 2025–2026, so the cap is required.
- **Pagination**: free plan caps `page` at 3. A league-wide listing would stop at 60 players (Premier League has 57 pages), so pools are built per team: `/teams?league&season` + `/players?team&season&page≤3`. Large clubs can have a 4th page (youth/loans); those teams are marked partial.
- **Cost**: ~61 requests per league (1 + 20 teams × ≤3 pages). Free quota is 100/day and 10/min.
- **`passes.accuracy`**: mostly `null`, otherwise an unexplained small integer. Not used.
- **Positions**: `games.position` uses `Goalkeeper / Defender / Midfielder / Attacker`, and sometimes `Forward`. Both map to FW.
- **Search**: `/players/profiles?search=raphinha` works (≥3 chars) and returns position and photo, but no club.
