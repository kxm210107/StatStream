# Live Tab Redesign: Full-Width Cards + Countdown

**Date:** 2026-03-09
**Status:** Approved

## Summary

Redesign the Live tab's two sections to use unified full-width cards and show more relevant time-scoped data.

## Section Behavior

### "Live Win Probability" Section (unchanged name)
- Shows ALL of today's games from `/games/live/probabilities`
- Pre-game games (`status: "Upcoming"` with today's date): live ticking countdown `HH:MM:SS` to tipoff
- In-progress games: live scores + win probability bar (existing behavior)
- Single endpoint, no backend changes needed

### "Upcoming Games" Section (unchanged name)
- Shows only **tomorrow's games** (1 day ahead, not 7)
- Backend: change `/games/upcoming` cutoff from `today + 7 days` to `today + 1 day`, filter strictly to `game_date == today + 1`
- Shows tip-off time (e.g. `7:30 PM ET`), no countdown
- Remove team filter dropdown (single day = manageable list)

## Card Layout

Both sections use the same **full-width stacked card** component:

```
[ STATUS ]   AWAY abbr · name   [ SCORE / COUNTDOWN / TIME ]   HOME abbr · name   [ WIN PROB BAR ]
```

- Cards are 100% width, stacked vertically (no CSS grid)
- Status badge: green pulsing "LIVE", muted "TODAY", or muted "TOMORROW"
- Center element by game state:
  - In-progress: large score `88 VS 91`
  - Pre-game today: live ticking `HH:MM:SS` countdown (JS setInterval in browser)
  - Tomorrow: formatted tip-off time string
- Win probability bar: in-progress games only (below the row)

## Changes Required

### Backend (`backend/main.py`)
- `/games/upcoming`: change `cutoff = today + timedelta(days=7)` → `timedelta(days=1)`, filter to `game_date == today + 1`

### Frontend
- `LiveGameCard.jsx`: redesign to full-width horizontal row; add `useEffect`/`setInterval` countdown for pre-game state
- `LiveWinProbability.jsx`: switch from `gridTemplateColumns` grid to stacked layout; update empty state text for Upcoming section ("No games tomorrow" instead of "No upcoming games in the next 7 days"); remove team filter dropdown
