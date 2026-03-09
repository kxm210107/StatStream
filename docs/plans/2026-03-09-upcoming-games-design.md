# Upcoming Games Feature — Design Doc

**Date**: 2026-03-09
**Status**: Approved

## Summary

Add an "Upcoming Games" section to the Live tab showing league-wide games scheduled for the next 7 days, with a client-side team filter.

## Layout

The Live tab gets two stacked sections:
1. **Live Now** — existing live games with win probability (unchanged)
2. **Upcoming Games** — next 7 days of scheduled games, below

A team filter dropdown in the Upcoming section header lets users narrow by team. Defaults to "All Teams".

## Backend

### New endpoint: `GET /games/upcoming`

- Uses `nba_api` `LeagueSchedule` (same source as `/teams/{abbr}/schedule`)
- Filters games where date is between tomorrow and +7 days
- Cached with 1-hour TTL via `live_cache` (schedule rarely changes)
- Returns `[]` on any `nba_api` failure

**Response shape** (array of `UpcomingGame`):
```json
{
  "game_id": "string",
  "status": "Upcoming",
  "date": "2026-03-10",
  "time": "7:30 PM ET",
  "home_team": { "abbr": "BOS", "name": "Celtics" },
  "away_team": { "abbr": "LAL", "name": "Lakers" }
}
```

### New Pydantic schema: `UpcomingGame`

Added to `backend/schemas.py`.

## Frontend

### `api.js`

New function: `getUpcomingGames()` — `GET /games/upcoming`.

### `LiveGameCard.jsx`

Extended with an "upcoming" variant:
- When `status === "Upcoming"`: show date + time instead of period/clock
- Scores hidden (show "—" or omit)
- `WinProbabilityBar` not rendered
- Card dimensions and layout identical to live variant

### `LiveWinProbability.jsx`

- Fetches upcoming games once on mount (no polling)
- Renders "Upcoming Games" section below live games
- Team filter dropdown: populated from unique team abbreviations in fetched data, client-side filtering

## Error Handling

- Fetch failure: upcoming section shows inline error, independent of live section
- Empty state: "No upcoming games scheduled" if array is empty
- Backend failure: returns `[]`, frontend shows empty state

## Testing

New `backend/tests/test_upcoming_api.py`:
- `GET /games/upcoming` returns 200
- Response is a list with correct fields (`game_id`, `date`, `time`, `home_team`, `away_team`)
- Returns `[]` when `LeagueSchedule` raises an exception
