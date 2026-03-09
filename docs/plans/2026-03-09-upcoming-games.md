# Upcoming Games Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Upcoming Games" section below the live games in the Live tab, showing league-wide games for the next 7 days with a client-side team filter.

**Architecture:** New `GET /games/upcoming` backend endpoint uses `nba_api` `LeagueSchedule` (same source as per-team schedule), cached at 1-hour TTL. Frontend fetches once on mount, renders `LiveGameCard` in an "upcoming" variant (date/time instead of score/period, no probability bar), with a dropdown to filter by team abbreviation.

**Tech Stack:** FastAPI (Python), Pydantic v2, nba_api, React (JSX), inline styles

---

### Task 1: Add `UpcomingGame` Pydantic schema

**Files:**
- Modify: `backend/schemas.py`

**Step 1: Write the failing test (schema validation)**

Add to `backend/tests/test_upcoming_api.py` (create the file):

```python
"""
Tests for GET /games/upcoming endpoint.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache

FAKE_UPCOMING = [
    {
        "game_id":   "0022500100",
        "status":    "Upcoming",
        "date":      "2026-03-10",
        "time":      "7:30 pm ET",
        "home_team": {"abbr": "BOS", "name": "Celtics"},
        "away_team": {"abbr": "LAL", "name": "Lakers"},
    }
]

def test_upcoming_schema_fields():
    """UpcomingGame schema accepts the expected shape."""
    from schemas import UpcomingGame
    game = UpcomingGame(**FAKE_UPCOMING[0])
    assert game.game_id == "0022500100"
    assert game.status  == "Upcoming"
    assert game.home_team.abbr == "BOS"
    assert game.away_team.abbr == "LAL"
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/test_upcoming_api.py::test_upcoming_schema_fields -v
```
Expected: FAIL with `ImportError: cannot import name 'UpcomingGame'`

**Step 3: Add schema to `backend/schemas.py`**

Append after the `LiveGameWithProbability` class at the end of the file:

```python
# ── Upcoming game schemas ──────────────────────────────────────────────────────

class UpcomingTeam(BaseModel):
    abbr: str
    name: str

class UpcomingGame(BaseModel):
    game_id:   str
    status:    str   # "Upcoming"
    date:      str   # ISO date: "2026-03-10"
    time:      str   # e.g. "7:30 pm ET"
    home_team: UpcomingTeam
    away_team: UpcomingTeam
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_upcoming_api.py::test_upcoming_schema_fields -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/schemas.py backend/tests/test_upcoming_api.py
git commit -m "feat: add UpcomingGame pydantic schema with test"
```

---

### Task 2: Add `GET /games/upcoming` backend endpoint

**Files:**
- Modify: `backend/main.py` (append after line 1049, after the `/games/live/probabilities` endpoint)

**Step 1: Write the failing tests**

Add these tests to `backend/tests/test_upcoming_api.py`:

```python
# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    live_cache.clear()
    yield
    live_cache.clear()


def _make_fake_df(games: list):
    """Build a minimal DataFrame mimicking LeagueSchedule output."""
    import pandas as pd
    rows = []
    for g in games:
        rows.append({
            "GAME_ID":               g["game_id"],
            "GAME_DATE_EST":         g["date"] + "T00:00:00",
            "GAME_STATUS_TEXT":      g["time"],
            "HOME_TEAM_ID":          g["home_id"],
            "HOME_TEAM_ABBREVIATION": g["home_abbr"],
            "HOME_TEAM_NAME":        g["home_name"],
            "VISITOR_TEAM_ID":       g["away_id"],
            "VISITOR_TEAM_ABBREVIATION": g["away_abbr"],
            "VISITOR_TEAM_NAME":     g["away_name"],
        })
    return pd.DataFrame(rows)


# Two games 3 and 6 days from today
import datetime as _dt
_today = _dt.date.today()
FAKE_SCHEDULE_ROWS = [
    {
        "game_id":   "0022500100",
        "date":      (_today + _dt.timedelta(days=3)).isoformat(),
        "time":      "7:30 pm ET",
        "home_id":   1610612738,  # BOS
        "home_abbr": "BOS",
        "home_name": "Celtics",
        "away_id":   1610612747,  # LAL
        "away_abbr": "LAL",
        "away_name": "Lakers",
    },
    {
        "game_id":   "0022500101",
        "date":      (_today + _dt.timedelta(days=6)).isoformat(),
        "time":      "9:00 pm ET",
        "home_id":   1610612744,  # GSW
        "home_abbr": "GSW",
        "home_name": "Warriors",
        "away_id":   1610612749,  # MIL
        "away_abbr": "MIL",
        "away_name": "Bucks",
    },
]


class FakeLeagueSchedule:
    def get_data_frames(self):
        return [_make_fake_df(FAKE_SCHEDULE_ROWS)]


class TestGetUpcomingGames:

    @pytest.fixture(autouse=True)
    def patch_league_schedule(self, monkeypatch):
        import nba_api.stats.endpoints.leagueschedule as _ls
        monkeypatch.setattr(_ls, "LeagueSchedule", lambda **kwargs: FakeLeagueSchedule())

    def test_returns_200(self, client):
        assert client.get("/games/upcoming").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/upcoming").json()
        assert isinstance(data, list)

    def test_returns_two_games(self, client):
        data = client.get("/games/upcoming").json()
        assert len(data) == 2

    def test_game_has_expected_fields(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert "game_id"   in game
        assert "status"    in game
        assert "date"      in game
        assert "time"      in game
        assert "home_team" in game
        assert "away_team" in game

    def test_status_is_upcoming(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert game["status"] == "Upcoming"

    def test_team_has_abbr_and_name(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert "abbr" in game["home_team"]
        assert "name" in game["home_team"]
        assert "abbr" in game["away_team"]
        assert "name" in game["away_team"]

    def test_games_sorted_by_date(self, client):
        data = client.get("/games/upcoming").json()
        dates = [g["date"] for g in data]
        assert dates == sorted(dates)


class TestGetUpcomingGamesErrorHandling:

    @pytest.fixture(autouse=True)
    def patch_league_schedule_error(self, monkeypatch):
        import nba_api.stats.endpoints.leagueschedule as _ls
        def _boom(**kwargs):
            raise RuntimeError("nba_api down")
        monkeypatch.setattr(_ls, "LeagueSchedule", _boom)

    def test_returns_empty_list_on_failure(self, client):
        data = client.get("/games/upcoming").json()
        assert data == []
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/test_upcoming_api.py -v
```
Expected: test_upcoming_schema_fields PASS, all others FAIL with 404 or import error.

**Step 3: Add the endpoint to `backend/main.py`**

Append after line 1049 (after the `get_live_probabilities` function):

```python
# ==========================================
# ENDPOINT: League-wide upcoming games
# GET /games/upcoming
# ==========================================
@app.get("/games/upcoming")
def get_upcoming_games():
    import datetime as _dt

    cache_key = f"upcoming_games_{_dt.date.today().isoformat()}"
    cached = live_cache.get(cache_key)
    if cached is not None:
        return cached

    today    = _dt.date.today()
    cutoff   = today + _dt.timedelta(days=7)

    try:
        from nba_api.stats.endpoints import leagueschedule as _lsched
        time.sleep(0.6)
        sched  = _lsched.LeagueSchedule(league_id='00', season_year='2024-25', game_type='2')
        df_all = sched.get_data_frames()[0]

        candidates = []
        for _, g in df_all.iterrows():
            raw_date = str(g.get('GAME_DATE_EST', '') or g.get('GAME_DATE', ''))
            try:
                game_date = _dt.date.fromisoformat(raw_date[:10])
            except ValueError:
                continue
            if game_date <= today or game_date > cutoff:
                continue
            candidates.append({
                "game_id": str(g.get('GAME_ID', '')),
                "status":  "Upcoming",
                "date":    game_date.isoformat(),
                "time":    str(g.get('GAME_STATUS_TEXT', '')),
                "home_team": {
                    "abbr": str(g.get('HOME_TEAM_ABBREVIATION', '')),
                    "name": str(g.get('HOME_TEAM_NAME', '')),
                },
                "away_team": {
                    "abbr": str(g.get('VISITOR_TEAM_ABBREVIATION', '')),
                    "name": str(g.get('VISITOR_TEAM_NAME', '')),
                },
            })

        result = sorted(candidates, key=lambda x: x['date'])
        live_cache.set(cache_key, result, ttl=3600)
        return result

    except Exception as e:
        print(f"[StatStream] Upcoming games fetch failed: {e}")
        return []
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_upcoming_api.py -v
```
Expected: All 11 tests PASS.

**Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_upcoming_api.py
git commit -m "feat: add GET /games/upcoming endpoint with caching and tests"
```

---

### Task 3: Add `getUpcomingGames` to frontend API

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Add the function**

Append after `getLiveGamesWithProbabilities` at the end of `frontend/src/api.js`:

```javascript
export async function getUpcomingGames() {
  const res = await fetch(`${BASE_URL}/games/upcoming`);
  if (!res.ok) throw new Error('Failed to fetch upcoming games');
  return res.json();
}
```

**Step 2: Verify no syntax errors**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build 2>&1 | tail -5
```
Expected: build succeeds (exit 0).

**Step 3: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add getUpcomingGames API helper"
```

---

### Task 4: Add "upcoming" variant to `LiveGameCard`

**Files:**
- Modify: `frontend/src/components/LiveGameCard.jsx`

**Context:** When `game.status === "Upcoming"`, the card shows:
- Header: "Upcoming" label (grey, no pulse) + date on the right
- Scoreboard: team abbreviations + name, dashes instead of scores
- No `WinProbabilityBar`

**Step 1: Update `LiveGameCard.jsx`**

Replace the entire file content:

```jsx
// frontend/src/components/LiveGameCard.jsx
import WinProbabilityBar from './WinProbabilityBar';

const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

function formatUpcomingDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids timezone shifts
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function LiveGameCard({ game, selected, onClick }) {
  const { home_team: home, away_team: away } = game;
  const isUpcoming = game.status === 'Upcoming';

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--bg-card-2)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--cyan)' : 'var(--border-light)'}`,
        borderRadius: 14,
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        boxShadow: selected ? '0 0 0 1px rgba(34,211,238,0.15) inset' : 'none',
      }}
    >
      {/* Status + time header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        {isUpcoming ? (
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            Upcoming
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
            color: '#4ADE80', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: '#4ADE80', boxShadow: '0 0 5px #4ADE80',
              animation: 'pulse 2s ease infinite',
            }} />
            Live
          </span>
        )}

        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}>
          {isUpcoming
            ? `${formatUpcomingDate(game.date)} · ${game.time}`
            : `${PERIOD_LABEL[game.period] ?? `OT${game.period - 4}`} · ${game.clock}`
          }
        </span>
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isUpcoming ? 0 : 16 }}>
        {/* Away team */}
        <div style={{ textAlign: 'left', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {away.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: isUpcoming ? 18 : 36, lineHeight: 1,
            color: isUpcoming ? 'var(--text-secondary)' : (away.score > home.score ? 'var(--text-primary)' : 'var(--text-secondary)'),
          }}>
            {isUpcoming ? away.name : away.score}
          </div>
        </div>

        {/* Divider */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {isUpcoming ? '@' : 'VS'}
        </div>

        {/* Home team */}
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {home.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: isUpcoming ? 18 : 36, lineHeight: 1,
            color: isUpcoming ? 'var(--text-secondary)' : (home.score > away.score ? 'var(--text-primary)' : 'var(--text-secondary)'),
          }}>
            {isUpcoming ? home.name : home.score}
          </div>
        </div>
      </div>

      {/* Win probability bar — live games only */}
      {!isUpcoming && home.win_probability != null && (
        <WinProbabilityBar
          homeProb={home.win_probability}
          awayProb={away.win_probability}
          homeAbbr={home.abbr}
          awayAbbr={away.abbr}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build 2>&1 | tail -5
```
Expected: build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/LiveGameCard.jsx
git commit -m "feat: add upcoming variant to LiveGameCard"
```

---

### Task 5: Add "Upcoming Games" section to `LiveWinProbability`

**Files:**
- Modify: `frontend/src/components/LiveWinProbability.jsx`

**Step 1: Replace the file content**

```jsx
// frontend/src/components/LiveWinProbability.jsx
import { useState, useEffect, useRef } from 'react';
import LiveGameCard from './LiveGameCard';
import { getLiveGamesWithProbabilities, getUpcomingGames } from '../api';

const POLL_INTERVAL_MS = 25_000;

export default function LiveWinProbability() {
  const [games,          setGames         ] = useState([]);
  const [upcoming,       setUpcoming      ] = useState([]);
  const [loading,        setLoading       ] = useState(true);
  const [upcomingLoading,setUpcomingLoading] = useState(true);
  const [error,          setError         ] = useState(null);
  const [upcomingError,  setUpcomingError  ] = useState(null);
  const [lastUpdated,    setLastUpdated   ] = useState(null);
  const [selectedId,     setSelectedId    ] = useState(null);
  const [teamFilter,     setTeamFilter    ] = useState('ALL');
  const intervalRef = useRef(null);

  const fetchGames = async () => {
    try {
      const data = await getLiveGamesWithProbabilities();
      setGames(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError('Could not fetch live game data. Retrying…');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const data = await getUpcomingGames();
      setUpcoming(data);
      setUpcomingError(null);
    } catch (e) {
      setUpcomingError('Could not fetch upcoming games.');
    } finally {
      setUpcomingLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchUpcoming();
    intervalRef.current = setInterval(fetchGames, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Build sorted list of unique team abbreviations for the filter dropdown
  const teamOptions = ['ALL', ...Array.from(
    new Set(upcoming.flatMap(g => [g.home_team.abbr, g.away_team.abbr]))
  ).sort()];

  const filteredUpcoming = teamFilter === 'ALL'
    ? upcoming
    : upcoming.filter(g => g.home_team.abbr === teamFilter || g.away_team.abbr === teamFilter);

  return (
    <div>
      {/* ── Live section header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 26,
            color: 'var(--text-primary)', letterSpacing: '0.05em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Live Win Probability
          </h2>
          {lastUpdated && (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, letterSpacing: '0.06em' }}>
              Updated {lastUpdated.toLocaleTimeString()} · refreshes every 25s
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ADE80', boxShadow: '0 0 6px #4ADE80',
            animation: 'pulse 2s ease infinite', display: 'inline-block',
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#4ADE80', textTransform: 'uppercase' }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Live games ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching live games…</p>
        </div>
      )}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}
      {!loading && !error && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🏀</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.06em' }}>
            No games live right now.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, letterSpacing: '0.06em' }}>
            Check back during game time. Page refreshes automatically.
          </p>
        </div>
      )}
      {!loading && games.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {games.map(game => (
            <LiveGameCard
              key={game.game_id}
              game={game}
              selected={selectedId === game.game_id}
              onClick={() => setSelectedId(id => id === game.game_id ? null : game.game_id)}
            />
          ))}
        </div>
      )}

      {/* ── Upcoming section ── */}
      <div style={{ marginTop: 48 }}>
        {/* Upcoming header + filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--text-primary)', letterSpacing: '0.05em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Upcoming Games
          </h2>

          {!upcomingLoading && upcoming.length > 0 && (
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                padding: '6px 10px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {teamOptions.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Teams' : t}</option>
              ))}
            </select>
          )}
        </div>

        {/* Upcoming loading */}
        {upcomingLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching schedule…</p>
          </div>
        )}

        {/* Upcoming error */}
        {!upcomingLoading && upcomingError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
          }}>
            {upcomingError}
          </div>
        )}

        {/* Upcoming empty state */}
        {!upcomingLoading && !upcomingError && filteredUpcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.06em' }}>
              {teamFilter === 'ALL' ? 'No upcoming games in the next 7 days.' : `No upcoming games for ${teamFilter}.`}
            </p>
          </div>
        )}

        {/* Upcoming game grid */}
        {!upcomingLoading && !upcomingError && filteredUpcoming.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {filteredUpcoming.map(game => (
              <LiveGameCard
                key={game.game_id}
                game={game}
                selected={false}
                onClick={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build 2>&1 | tail -5
```
Expected: build succeeds.

**Step 3: Run all backend tests to confirm no regressions**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/ -v
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add frontend/src/components/LiveWinProbability.jsx
git commit -m "feat: add upcoming games section with team filter to Live tab"
```
