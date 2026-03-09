# Live Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Live tab so both sections use unified full-width cards, the Live section shows today's games with a live ticking countdown for pre-game, and Upcoming shows only tomorrow's games.

**Architecture:** Backend narrows `/games/upcoming` to tomorrow-only. Frontend replaces the card grid in both sections with full-width stacked rows. `LiveGameCard` gains a `useEffect`/`setInterval` countdown for pre-game state. Section names stay unchanged ("Live Win Probability" and "Upcoming Games").

**Tech Stack:** FastAPI (Python), React 18, inline styles (no Tailwind/CSS modules)

---

### Task 1: Backend — narrow /games/upcoming to tomorrow only

**Files:**
- Modify: `backend/main.py` (function `get_upcoming_games`, around line 1065–1097)
- Modify: `backend/tests/test_upcoming_api.py`

**Context:**
The endpoint currently filters `today < game_date <= today + 7 days`. We need it to return only games where `game_date == today + 1 day` (tomorrow). The fake schedule in the test has games at +3 and +6 days; update them to +1 day so tests still pass.

**Step 1: Update the test fixture to use tomorrow (+1) instead of +3 and +6**

In `backend/tests/test_upcoming_api.py`, find `FAKE_SCHEDULE_ROWS` and change both date offsets:

```python
FAKE_SCHEDULE_ROWS = [
    {
        "game_id":   "0022500100",
        "date":      (_today + _dt.timedelta(days=1)).isoformat(),   # was days=3
        ...
    },
    {
        "game_id":   "0022500101",
        "date":      (_today + _dt.timedelta(days=1)).isoformat(),   # was days=6
        ...
    },
]
```

Also update `test_returns_two_games` — it still expects 2 games (both are tomorrow) so no change needed there.

**Step 2: Run test to verify it still passes (fixture change only)**

```bash
cd backend && python -m pytest tests/test_upcoming_api.py -v
```
Expected: 9 passed

**Step 3: Update `get_upcoming_games` in `backend/main.py`**

Find the lines:
```python
today    = _dt.date.today()
cutoff   = today + _dt.timedelta(days=7)
```
and the filter:
```python
if game_date <= today or game_date > cutoff:
    continue
```

Replace with:
```python
today    = _dt.date.today()
tomorrow = today + _dt.timedelta(days=1)
```
and change the filter to:
```python
if game_date != tomorrow:
    continue
```

**Step 4: Run tests to verify passing**

```bash
cd backend && python -m pytest tests/test_upcoming_api.py -v
```
Expected: 9 passed

**Step 5: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add backend/main.py backend/tests/test_upcoming_api.py
git commit -m "feat: narrow /games/upcoming to tomorrow only"
```

---

### Task 2: Frontend — redesign LiveGameCard to full-width row with countdown

**Files:**
- Modify: `frontend/src/components/LiveGameCard.jsx`

**Context:**
The card currently uses a compact layout with variable font sizes for upcoming vs live. We need one unified full-width horizontal row:

```
[ STATUS ]   AWAY abbr   AWAY name   [ CENTER ]   HOME name   HOME abbr   [ WIN PROB ]
```

For pre-game today (`status === 'Upcoming'` AND `game.date === today`): show a live ticking `HH:MM:SS` countdown using `useState` + `useEffect` with `setInterval(fn, 1000)`.

For tomorrow (`status === 'Upcoming'` AND `game.date !== today`): show formatted tip-off time string.

For in-progress: show scores + win probability bar below the row (existing behavior).

**The countdown logic:**
```js
// Parse "7:30 pm ET" into a Date for today. Strip " ET" suffix, parse as local time.
function parseTipoffDate(dateStr, timeStr) {
  const cleaned = timeStr.replace(/\s*ET$/i, '').trim(); // "7:30 pm"
  return new Date(`${dateStr}T${to24h(cleaned)}`);
}

function to24h(timeStr) {
  // "7:30 pm" -> "19:30:00", "7:30 am" -> "07:30:00"
  const [time, meridiem] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (meridiem?.toLowerCase() === 'pm' && h !== 12) h += 12;
  if (meridiem?.toLowerCase() === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'STARTING';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
```

**Step 1: Rewrite `LiveGameCard.jsx` completely**

Replace the entire file with:

```jsx
// frontend/src/components/LiveGameCard.jsx
import { useState, useEffect } from 'react';
import WinProbabilityBar from './WinProbabilityBar';

const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

function to24h(timeStr) {
  const parts = timeStr.trim().split(' ');
  const [h24, m24] = parts[0].split(':').map(Number);
  const meridiem = (parts[1] || '').toLowerCase();
  let h = h24;
  if (meridiem === 'pm' && h !== 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m24).padStart(2, '0')}:00`;
}

function parseTipoffMs(dateStr, timeStr) {
  try {
    const cleaned = timeStr.replace(/\s*ET$/i, '').trim();
    const tipoff = new Date(`${dateStr}T${to24h(cleaned)}`);
    return tipoff.getTime() - Date.now();
  } catch {
    return null;
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return 'STARTING';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTipoffTime(timeStr) {
  // "7:30 pm ET" -> "7:30 PM ET"
  return timeStr.toUpperCase();
}

function CountdownCell({ dateStr, timeStr }) {
  const [msLeft, setMsLeft] = useState(() => parseTipoffMs(dateStr, timeStr));

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(parseTipoffMs(dateStr, timeStr));
    }, 1000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);

  return (
    <div style={{ textAlign: 'center', minWidth: 120 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '0.08em',
        color: 'var(--cyan)', fontWeight: 700, lineHeight: 1,
      }}>
        {msLeft != null ? formatCountdown(msLeft) : '--:--:--'}
      </div>
      <div style={{
        fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)',
        textTransform: 'uppercase', marginTop: 4,
      }}>
        to tipoff
      </div>
    </div>
  );
}

function ScoreCell({ home, away }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 120, justifyContent: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1,
        color: away.score > home.score ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
        {away.score}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1,
        color: home.score > away.score ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
        {home.score}
      </span>
    </div>
  );
}

function TipoffCell({ timeStr }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 120 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.08em',
        color: 'var(--text-secondary)', fontWeight: 600,
      }}>
        {formatTipoffTime(timeStr)}
      </div>
    </div>
  );
}

export default function LiveGameCard({ game, selected, onClick }) {
  const { home_team: home, away_team: away } = game;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isLive     = game.status !== 'Upcoming';
  const isToday    = game.date === todayStr;
  const isTomorrow = !isLive && !isToday;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--bg-card-2)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--cyan)' : 'var(--border-light)'}`,
        borderRadius: 12,
        padding: '14px 20px',
        cursor: isLive ? 'pointer' : 'default',
        transition: 'border-color 0.2s, background 0.2s',
        boxShadow: selected ? '0 0 0 1px rgba(34,211,238,0.15) inset' : 'none',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Status badge */}
        <div style={{ minWidth: 64, flexShrink: 0 }}>
          {isLive ? (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
              color: '#4ADE80', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: '#4ADE80', boxShadow: '0 0 5px #4ADE80',
                animation: 'pulse 2s ease infinite', flexShrink: 0,
              }} />
              {PERIOD_LABEL[game.period] ?? `OT${game.period - 4}`}
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{game.clock}</span>
            </span>
          ) : isToday ? (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>Today</span>
          ) : (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>Tomorrow</span>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 2,
          }}>
            {away.abbr}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', letterSpacing: '0.05em',
            fontWeight: 500,
          }}>
            {away.name}
          </div>
        </div>

        {/* Center: score / countdown / time */}
        <div style={{ flexShrink: 0 }}>
          {isLive    && <ScoreCell home={home} away={away} />}
          {isToday   && !isLive && <CountdownCell dateStr={game.date} timeStr={game.time} />}
          {isTomorrow && <TipoffCell timeStr={game.time} />}
        </div>

        {/* Home team */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 2,
          }}>
            {home.abbr}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text-secondary)', letterSpacing: '0.05em',
            fontWeight: 500,
          }}>
            {home.name}
          </div>
        </div>

      </div>

      {/* Win probability bar — live games only */}
      {isLive && home.win_probability != null && (
        <div style={{ marginTop: 14 }}>
          <WinProbabilityBar
            homeProb={home.win_probability}
            awayProb={away.win_probability}
            homeAbbr={home.abbr}
            awayAbbr={away.abbr}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify frontend builds without errors**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend && npm run build 2>&1 | tail -20
```
Expected: no errors, build succeeds.

**Step 3: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add frontend/src/components/LiveGameCard.jsx
git commit -m "feat: redesign LiveGameCard to full-width row with countdown"
```

---

### Task 3: Frontend — update LiveWinProbability layout to stacked rows

**Files:**
- Modify: `frontend/src/components/LiveWinProbability.jsx`

**Context:**
Both game sections currently use `display: grid; gridTemplateColumns: repeat(auto-fill, minmax(300px, 1fr))`. Replace both grids with a vertical flex stack (`display: flex; flexDirection: column; gap: 10px`). Remove the team filter dropdown entirely. Update the empty state message for Upcoming to say "No games tomorrow."

**Step 1: Replace both grid containers with flex stacks in `LiveWinProbability.jsx`**

Find the live games grid:
```js
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 16,
}}>
  {games.map(game => (
    <LiveGameCard ...
```
Replace with:
```js
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
  {games.map(game => (
    <LiveGameCard ...
```

Find the upcoming game grid:
```js
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 16,
}}>
  {filteredUpcoming.map(game => (
    <LiveGameCard ...
```
Replace with:
```js
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
  {upcoming.map(game => (
    <LiveGameCard ...
```
(Note: also change `filteredUpcoming` → `upcoming` since we're removing the team filter.)

**Step 2: Remove the team filter dropdown and related state**

Remove these `useState` lines:
```js
const [teamFilter, setTeamFilter] = useState('ALL');
```

Remove the `teamOptions` computed value:
```js
const teamOptions = ['ALL', ...Array.from(
  new Set(upcoming.flatMap(g => [g.home_team.abbr, g.away_team.abbr]))
).sort()];
```

Remove the `filteredUpcoming` computed value:
```js
const filteredUpcoming = teamFilter === 'ALL'
  ? upcoming
  : upcoming.filter(g => g.home_team.abbr === teamFilter || g.away_team.abbr === teamFilter);
```

Remove the `<select>` dropdown JSX block (the one inside the Upcoming header row).

**Step 3: Update empty state text for Upcoming section**

Find:
```js
{teamFilter === 'ALL' ? 'No upcoming games in the next 7 days.' : `No upcoming games for ${teamFilter}.`}
```
Replace with:
```js
No games tomorrow.
```

**Step 4: Verify build**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

**Step 5: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add frontend/src/components/LiveWinProbability.jsx
git commit -m "feat: switch live tab sections to full-width stacked layout, remove team filter"
```

---

## Verification

After all tasks, do a full sanity check:

```bash
# Backend tests
cd /Users/kevjumba/PycharmProjects/StatStream/backend && python -m pytest tests/test_upcoming_api.py -v

# Frontend build
cd /Users/kevjumba/PycharmProjects/StatStream/frontend && npm run build
```

Then open the browser at `http://localhost:5173` and confirm:
1. Live Win Probability section shows today's games as full-width rows
2. Pre-game cards show a ticking `HH:MM:SS` countdown
3. Upcoming Games section shows tomorrow's games only as full-width rows
4. No team filter dropdown is visible
