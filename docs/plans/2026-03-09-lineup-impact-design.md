# Lineup Impact Analysis — Design Doc
Date: 2026-03-09

## Goal
Add a Lineup Impact Analysis tab (3rd tab) to StatStream showing top lineup combinations for any NBA team with key metrics: minutes, points for/against, +/-, OffRtg, DefRtg, NetRtg.

## Data Source Decision
Use `LeagueDashLineups` NBA API endpoint for V1 (pre-aggregated, reliable). Play-by-play reconstruction kept as a future option for custom metrics.

## Architecture

### Backend
- `backend/lineup_data.py` — Wrapper around `LeagueDashLineups`. Fetches and normalizes lineup data for a team/season.
- `backend/lineup_impact.py` — Applies min-minutes filter, sort, limit. Returns `LineupResponse`.
- Route in `backend/main.py`: `GET /teams/{abbr}/lineups?season=&min_minutes=&limit=&sort_by=`
- Schemas in `backend/schemas.py`: `LineupPlayer`, `LineupSummary`, `LineupResponse`

### Frontend
- `frontend/src/components/LineupImpact.jsx` — Main tab container. Manages team/season/sort/min_minutes state.
- `frontend/src/components/LineupTable.jsx` — Sortable table rendering lineup rows.
- Tab inserted as 3rd tab (after Team Search, Live). Existing tabs shift right.
- API helper `getTeamLineups(abbr, params)` added to `src/api.js`.

## Data Flow
1. User selects team in LineupImpact
2. Fetches `/teams/{abbr}/lineups?season=&min_minutes=20&sort_by=net_rating`
3. Backend calls LeagueDashLineups, normalizes rows to LineupSummary
4. Frontend renders LineupTable with sortable columns

## Response Shape
```json
{
  "team": "ATL",
  "season": "2025-26",
  "lineups": [
    {
      "lineup_id": "atl_...",
      "players": ["Trae Young", "..."],
      "minutes": 142.6,
      "points_for": 318,
      "points_against": 287,
      "plus_minus": 31,
      "off_rating": 118.4,
      "def_rating": 106.8,
      "net_rating": 11.6
    }
  ]
}
```

## Defaults
- `min_minutes`: 20
- `sort_by`: `net_rating` (descending)
- `limit`: 20

## Error / Empty States
- Loading spinner while fetching
- Error message if API call fails
- "No lineups found" message if fewer than min_minutes threshold

## MVP Definition of Done
- User selects team, lineup combinations appear
- Each row shows players, minutes, +/-, OffRtg, DefRtg, NetRtg
- Table headers are clickable to sort
- Min-minutes filter input works
- Loading/error/empty states handled
