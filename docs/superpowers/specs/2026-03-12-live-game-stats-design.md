# Live Game Stats — Design Spec
**Date:** 2026-03-12

## Overview

Add live in-game box score stats (team stats + player roster stats) to the expanded Live game card in the Live tab. Stats are displayed in tabs alongside the existing Win Probability chart.

## User-Facing Behavior

When a live game card is clicked/expanded, a tab bar appears with three tabs:
1. **Win Probability** — existing chart (default tab)
2. **Team Stats** — full box score per team (FG, 3P, FT, REB, AST, STL, BLK, TO, PTS)
3. **Roster** — player box scores sorted by minutes played (starters first)

If box score data is unavailable (API failure), tabs 2 and 3 are hidden and only Win Probability is shown.

## Architecture

### Data Flow

```
NBA API (BoxScoreTraditionalV2)
    ↓ per game_id, 5s cache
backend/boxscore.py :: fetch_live_boxscore(game_id)
    ↓ appended to each game object
GET /games/live/probabilities  (existing endpoint, extended)
    ↓ poll every 5s (no frontend changes needed)
LiveGameCard.jsx  (extended with tabs)
    ├── Tab: Win Probability  (existing WinProbabilityChart)
    ├── Tab: Team Stats       (new TeamStatsPanel)
    └── Tab: Roster           (new RosterPanel)
```

### Backend: New `boxscore.py` module

- `fetch_live_boxscore(game_id)` — calls `nba_api.live.nba.endpoints.boxscore.BoxScore`
- Returns normalized dict with `home` and `away` keys, each containing `team_stats` and `players`
- Cached per game_id with 5s TTL using existing `live_cache.py`
- Returns `None` on any error (graceful degradation)

### Backend: Extended `/games/live/probabilities` response

Each game object gains a `box_score` field:

```json
{
  "box_score": {
    "home": {
      "team_stats": {
        "fgm": int, "fga": int, "fg_pct": float,
        "fg3m": int, "fg3a": int, "fg3_pct": float,
        "ftm": int, "fta": int, "ft_pct": float,
        "reb": int, "ast": int, "stl": int,
        "blk": int, "to": int, "pts": int
      },
      "players": [
        {
          "name": str, "jersey": str, "position": str,
          "starter": bool, "min": str,
          "pts": int, "reb": int, "ast": int,
          "stl": int, "blk": int,
          "fgm": int, "fga": int,
          "fg3m": int, "fg3a": int,
          "ftm": int, "fta": int, "to": int
        }
      ]
    },
    "away": { "...same shape..." }
  }
}
```

`box_score` is `null` if the fetch fails.

### Frontend: Modified `LiveGameCard.jsx`

- Add `activeTab` state (default: `"probability"`)
- Render tab bar (only shown when selected and isLive)
- Tab bar has three buttons: Win Probability / Team Stats / Roster
- Conditionally render `WinProbabilityChart`, `TeamStatsPanel`, or `RosterPanel`

### Frontend: New `TeamStatsPanel.jsx`

- Two-column layout: away team on left, home team on right
- Each column shows all 9 stats with labels
- FG shown as "38/85 (44.7%)", 3P as "12/31 (38.7%)", FT as "18/22 (81.8%)"
- Other stats shown as plain numbers
- Team abbreviations and colors as column headers

### Frontend: New `RosterPanel.jsx`

- Single table spanning both teams side by side, OR two stacked tables (one per team)
- Two stacked tables (home/away) for readability
- Columns: #, Name, Pos, Min, Pts, Reb, Ast, Stl, Blk, FG, 3P, FT, TO
- Players sorted by minutes (starters first within each team)
- DNP players shown at bottom with "DNP" in minutes column

## Error Handling

- Box score fetch failure: `box_score = null` in response; frontend hides Team Stats and Roster tabs
- Network error during poll: existing error handling in `LiveWinProbability.jsx` covers this
- Player with null stats: render "—" for missing values

## Files Changed

| File | Type |
|------|------|
| `backend/boxscore.py` | New |
| `backend/main.py` | Modified |
| `backend/schemas.py` | Modified |
| `frontend/src/components/LiveGameCard.jsx` | Modified |
| `frontend/src/components/TeamStatsPanel.jsx` | New |
| `frontend/src/components/RosterPanel.jsx` | New |
