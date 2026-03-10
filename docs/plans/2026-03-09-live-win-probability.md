# Live Win Probability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Forecast tab with a Live Win Probability view showing live NBA games with real-time score, clock, and home/away win probability from a trained logistic regression model.

**Architecture:** Backend fetches live game state from `nba_api.live.nba.endpoints.scoreboard`, feeds score_diff + seconds_remaining into a logistic regression trained on historical game data from `LeagueGameLog`, and returns probabilities via `/games/live/probabilities`. Frontend polls every 25 seconds and renders game cards with a probability bar.

**Tech Stack:** FastAPI · nba_api · scikit-learn · joblib · React · Vite · lucide-react

---

## What's Being Removed

The Forecast tab (PlayerTrajectory) and Outlook tab (SeasonOutlook) are both player forecasting features being replaced.

**Backend to remove:**
- `_regress()` helper (lines 370–388 in main.py)
- `/players/{player_id}/trajectory` endpoint (~lines 394–451)
- `/predictions/season-preview` endpoint (~lines 458–550)
- `defaultdict` import (only used by season-preview)

**Frontend to remove:**
- `PlayerTrajectory.jsx` import and tab reference in App.jsx
- `SeasonOutlook.jsx` import and tab reference in App.jsx
- `fetchPlayerTrajectory`, `fetchSeasonPreview` from api.js
- `TrendingUp`, `BarChart2` icons (only used for removed tabs)

**New tab order after removal:**
1. Team Search
2. **Live** ← new, position 2
3. Roster
4. Top Scorers
5. Team Comparer
6. Playoffs

---

## Task 1: Remove Forecasting Code from Backend

**Files:**
- Modify: `backend/main.py`

**Step 1: Delete the `_regress` helper and the two endpoints**

In `main.py`, remove the entire block between the `# TRAJECTORY HELPERS` comment and the `# PLAYOFF SIMULATOR HELPERS` comment (roughly lines 366–551). This deletes:
- `_regress()`
- `get_player_trajectory()` at `/players/{player_id}/trajectory`
- `season_preview()` at `/predictions/season-preview`

Also remove `from collections import defaultdict` at line 557 (it moves up after the deletion — search for it and remove it since `defaultdict` is only used in `season_preview`).

**Step 2: Verify the server still starts**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -c "import main; print('OK')"
```
Expected: `OK` with no import errors.

**Step 3: Run existing tests to confirm nothing breaks**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/ -v -k "not trajectory and not season_preview"
```
Expected: all remaining tests pass.

**Step 4: Commit**

```bash
git add backend/main.py
git commit -m "refactor: remove player trajectory and season preview endpoints"
```

---

## Task 2: Remove Forecasting Code from Frontend

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/api.js`
- Delete: `frontend/src/components/PlayerTrajectory.jsx`
- Delete: `frontend/src/components/SeasonOutlook.jsx`

**Step 1: Update `api.js`**

Remove the two functions:
```js
// DELETE these two functions from api.js:
export async function fetchPlayerTrajectory(playerId) { ... }
export async function fetchSeasonPreview(targetSeason, limit) { ... }
```

**Step 2: Update `App.jsx` TABS and imports**

Remove from imports:
```jsx
// Remove these lines:
import PlayerTrajectory from './components/PlayerTrajectory';
import SeasonOutlook    from './components/SeasonOutlook';
```

Remove `TrendingUp` and `BarChart2` from the lucide-react import if they are only used for the removed tabs. Keep `Activity` — add it to the import for the new Live tab:
```jsx
import { LayoutGrid, Trophy, Search, Zap, Award, Activity } from 'lucide-react';
```

Replace the TABS array with:
```jsx
const TABS = [
  { id: 'Team Search',   label: 'Team Search',   icon: <Search     size={16} strokeWidth={2.5} /> },
  { id: 'Live',          label: 'Live',           icon: <Activity   size={16} strokeWidth={2.5} /> },
  { id: 'Roster',        label: 'Roster',         icon: <LayoutGrid size={16} strokeWidth={2.5} /> },
  { id: 'Top Scorers',   label: 'Top Scorers',    icon: <Trophy     size={16} strokeWidth={2.5} /> },
  { id: 'Team Comparer', label: 'Team Comparer',  icon: <Zap        size={16} strokeWidth={2.5} /> },
  { id: 'Playoffs',      label: 'Playoffs',       icon: <Award      size={16} strokeWidth={2.5} /> },
];
```

In the `<main>` render block, remove:
```jsx
{activeSeason && activeTab === 'Forecast'      && <PlayerTrajectory season={activeSeason} />}
{activeSeason && activeTab === 'Outlook'       && <SeasonOutlook    season={activeSeason} />}
```

Leave a placeholder for the Live tab (Task 9 will add the real component):
```jsx
{activeTab === 'Live' && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading Live…</div>}
```

Also change the default tab to `'Team Search'` (already correct), and set it so Live tab doesn't need `activeSeason`.

**Step 3: Delete the component files**

```bash
rm /Users/kevjumba/PycharmProjects/StatStream/frontend/src/components/PlayerTrajectory.jsx
rm /Users/kevjumba/PycharmProjects/StatStream/frontend/src/components/SeasonOutlook.jsx
```

**Step 4: Verify frontend builds**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build 2>&1 | tail -10
```
Expected: build succeeds with no errors.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/api.js
git add -u frontend/src/components/PlayerTrajectory.jsx frontend/src/components/SeasonOutlook.jsx
git commit -m "refactor: remove Forecast and Outlook tabs, add Live tab placeholder"
```

---

## Task 3: Add Pydantic Schemas for Live Game Data

**Files:**
- Modify: `backend/schemas.py`

**Step 1: Add the schemas**

Append to the end of `backend/schemas.py`:

```python
# ── Live game schemas ─────────────────────────────────────────────────────────

class LiveTeam(BaseModel):
    abbr:             str
    name:             str
    score:            int
    win_probability:  float   # 0.0 – 1.0

class LiveGame(BaseModel):
    game_id:      str
    status:       str          # "Live", "Final", "Scheduled"
    home_team:    LiveTeam
    away_team:    LiveTeam
    period:       int          # 1-4 (0 = not started)
    clock:        str          # "PT08M42.00S" from nba_api, normalized to "08:42"
    last_updated: str          # ISO-8601 UTC

class LiveGameWithProbability(LiveGame):
    # win_probability is already on each LiveTeam; this class exists
    # for future extension (e.g. model_type field)
    model_type: str = "logistic"
```

Note: `BaseModel` is already imported in schemas.py. Verify it is; if not, add `from pydantic import BaseModel`.

**Step 2: Verify schemas import cleanly**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -c "from schemas import LiveGame, LiveTeam, LiveGameWithProbability; print('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add LiveTeam, LiveGame, LiveGameWithProbability pydantic schemas"
```

---

## Task 4: Create `live_cache.py`

**Files:**
- Create: `backend/live_cache.py`

**Step 1: Write the module**

```python
# backend/live_cache.py
"""
Lightweight TTL in-memory cache for live API responses.
Prevents hammering nba_api on every poll request.
Default TTL: 20 seconds (matches frontend poll interval).
"""

import time
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}   # key → (expire_at, value)


def get(key: str) -> Any | None:
    """Return cached value if still valid, else None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    expire_at, value = entry
    if time.time() > expire_at:
        del _cache[key]
        return None
    return value


def set(key: str, value: Any, ttl: int = 20) -> None:
    """Store value with a TTL in seconds."""
    _cache[key] = (time.time() + ttl, value)


def clear() -> None:
    """Flush all cache entries (useful for testing)."""
    _cache.clear()
```

**Step 2: Verify it imports**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -c "import live_cache; live_cache.set('x', 42); print(live_cache.get('x'))"
```
Expected: `42`

**Step 3: Commit**

```bash
git add backend/live_cache.py
git commit -m "feat: add TTL in-memory cache for live API responses"
```

---

## Task 5: Create `live_games.py`

**Files:**
- Create: `backend/live_games.py`

**Step 1: Write the module**

```python
# backend/live_games.py
"""
Fetches currently live NBA games from nba_api and normalises them
into the internal LiveGame shape (no win probability logic here).
"""

import datetime
from nba_api.live.nba.endpoints import scoreboard


def _parse_clock(clock_str: str) -> str:
    """
    Convert nba_api clock format "PT08M42.00S" → "08:42".
    Returns "—" if not in expected format.
    """
    if not clock_str or not clock_str.startswith("PT"):
        return "—"
    try:
        rest = clock_str[2:]                   # "08M42.00S"
        m, rest2 = rest.split("M")
        s = rest2.rstrip("S").split(".")[0]
        return f"{int(m):02d}:{int(s):02d}"
    except Exception:
        return clock_str


def fetch_live_games() -> list[dict]:
    """
    Return a list of dicts representing games currently in progress.
    Each dict matches the LiveGame schema (without win_probability fields).
    """
    try:
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
    except Exception:
        return []

    live = []
    now  = datetime.datetime.utcnow().isoformat() + "Z"

    for g in games:
        game_status = g.get("gameStatus", 1)  # 1=scheduled, 2=live, 3=final
        if game_status != 2:                  # only live games
            continue

        home = g.get("homeTeam", {})
        away = g.get("awayTeam", {})

        live.append({
            "game_id": g.get("gameId", ""),
            "status":  "Live",
            "period":  g.get("period", 0),
            "clock":   _parse_clock(g.get("gameClock", "")),
            "home_team": {
                "abbr":  home.get("teamTricode", ""),
                "name":  home.get("teamName", ""),
                "score": int(home.get("score", 0)),
            },
            "away_team": {
                "abbr":  away.get("teamTricode", ""),
                "name":  away.get("teamName", ""),
                "score": int(away.get("score", 0)),
            },
            "last_updated": now,
        })

    return live
```

**Step 2: Manual smoke test (optional — requires internet)**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -c "from live_games import fetch_live_games; import json; print(json.dumps(fetch_live_games(), indent=2))"
```
Expected: JSON array (empty list `[]` if no games are live right now is fine).

**Step 3: Commit**

```bash
git add backend/live_games.py
git commit -m "feat: add live_games fetcher using nba_api scoreboard"
```

---

## Task 6: Train the Win Probability Model

**Files:**
- Create: `backend/train_win_probability.py`

**Step 1: Write the training script**

This script fetches historical game data, synthesizes per-quarter game states (since `LeagueGameLog` only has final scores), and trains a logistic regression.

```python
# backend/train_win_probability.py
"""
Train a logistic regression win probability model.

Features (at a simulated game state):
  - score_diff: home_score − away_score
  - seconds_remaining: total seconds left in the game (2880 = start, 0 = end)

Label:
  - 1 if home team won, 0 otherwise

Run once before starting the server:
    cd backend
    python train_win_probability.py
"""

import os
import numpy as np
import joblib
from nba_api.stats.endpoints import leaguegamelog

MODEL_PATH = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
REGULATION_SECONDS = 48 * 60  # 2880


def _fetch_game_logs(seasons: list[str]) -> list[dict]:
    """Fetch completed game rows for the given seasons."""
    rows = []
    for season in seasons:
        print(f"  Fetching {season}…")
        try:
            logs = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
            ).get_dict()
            headers = logs["resultSets"][0]["headers"]
            data    = logs["resultSets"][0]["rowSet"]
            idx     = {h: i for i, h in enumerate(headers)}
            for row in data:
                rows.append({
                    "team_id":    row[idx["TEAM_ID"]],
                    "game_id":    row[idx["GAME_ID"]],
                    "wl":         row[idx["WL"]],          # "W" or "L"
                    "pts":        row[idx["PTS"]],
                    "matchup":    row[idx["MATCHUP"]],     # "LAL vs. BOS" or "LAL @ BOS"
                })
        except Exception as e:
            print(f"  Warning: {e}")
    return rows


def _pair_games(rows: list[dict]) -> list[dict]:
    """
    Pair home and away rows by game_id.
    Home team matchup contains "vs." (home), away contains "@".
    """
    by_game: dict[str, list] = {}
    for r in rows:
        by_game.setdefault(r["game_id"], []).append(r)

    pairs = []
    for game_id, game_rows in by_game.items():
        if len(game_rows) != 2:
            continue
        home = next((r for r in game_rows if "vs." in r["matchup"]), None)
        away = next((r for r in game_rows if " @ "  in r["matchup"]), None)
        if home is None or away is None:
            continue
        pairs.append({
            "home_pts": int(home["pts"] or 0),
            "away_pts": int(away["pts"] or 0),
            "home_win": 1 if home["wl"] == "W" else 0,
        })
    return pairs


def _synthesize_states(pairs: list[dict], snapshots_per_game: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """
    For each completed game, create `snapshots_per_game` synthetic game-state rows
    by proportionally distributing the final score across time.

    This approximates what the score diff looked like at evenly spaced moments
    during the game. It's a reasonable proxy for training a live win probability
    model without needing per-possession play-by-play data.
    """
    X_rows, y_rows = [], []

    for p in pairs:
        home_final = p["home_pts"]
        away_final = p["away_pts"]
        home_win   = p["home_win"]

        for i in range(1, snapshots_per_game + 1):
            # Fraction of game elapsed at this snapshot (e.g. 0.125, 0.25 … 1.0)
            frac_elapsed = i / snapshots_per_game
            seconds_remaining = int(REGULATION_SECONDS * (1 - frac_elapsed))

            # Proportional score at this point in game (linear approximation)
            home_score = round(home_final * frac_elapsed)
            away_score = round(away_final * frac_elapsed)
            score_diff = home_score - away_score

            X_rows.append([score_diff, seconds_remaining])
            y_rows.append(home_win)

    return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)


def train(seasons: list[str] | None = None):
    if seasons is None:
        seasons = ["2022-23", "2023-24", "2024-25"]

    print("Fetching game logs…")
    rows  = _fetch_game_logs(seasons)
    print(f"  {len(rows)} team-game rows fetched.")

    pairs = _pair_games(rows)
    print(f"  {len(pairs)} completed games paired.")

    X, y = _synthesize_states(pairs)
    print(f"  {len(X)} training rows generated.")

    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(max_iter=1000)),
    ])
    model.fit(X, y)

    # Quick accuracy sanity check
    acc = model.score(X, y)
    print(f"  Training accuracy: {acc:.3f}  (train-set only)")

    joblib.dump(model, MODEL_PATH)
    print(f"  Model saved → {MODEL_PATH}")


if __name__ == "__main__":
    train()
```

**Step 2: Run the training**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python train_win_probability.py
```
Expected output:
```
Fetching game logs…
  Fetching 2022-23…
  Fetching 2023-24…
  Fetching 2024-25…
  XXXX team-game rows fetched.
  XXXX completed games paired.
  XXXXX training rows generated.
  Training accuracy: 0.XXX
  Model saved → .../backend/win_prob_model.pkl
```
Training accuracy should be somewhere in the 0.68–0.78 range. `win_prob_model.pkl` file appears in `backend/`.

**Step 3: Commit**

```bash
git add backend/train_win_probability.py backend/win_prob_model.pkl
git commit -m "feat: add win probability training script and trained model artifact"
```

---

## Task 7: Create `win_probability.py`

**Files:**
- Create: `backend/win_probability.py`

**Step 1: Write the inference module**

```python
# backend/win_probability.py
"""
Load the trained win probability model and expose a single predict() function.
Falls back to a calibrated sigmoid heuristic if the model file is missing.
"""

import os
import math
import numpy as np

MODEL_PATH    = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
_model        = None
_model_loaded = False

REGULATION_SECONDS = 48 * 60  # 2880


def _load():
    global _model, _model_loaded
    if not _model_loaded:
        if os.path.exists(MODEL_PATH):
            import joblib
            _model = joblib.load(MODEL_PATH)
        _model_loaded = True
    return _model


def _clock_to_seconds_remaining(period: int, clock: str) -> int:
    """
    Convert live game state to total seconds remaining in regulation.
    period: 1-4 (overtime treated as 0 seconds remaining for model purposes)
    clock:  "MM:SS" string normalised by live_games.py
    """
    if period <= 0 or period > 4:
        return 0

    # Parse MM:SS
    try:
        parts = clock.split(":")
        mins  = int(parts[0])
        secs  = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        mins, secs = 0, 0

    seconds_left_in_period   = mins * 60 + secs
    periods_remaining_after  = 4 - period          # complete quarters still to play
    return seconds_left_in_period + periods_remaining_after * 12 * 60


def predict(home_score: int, away_score: int, period: int, clock: str) -> tuple[float, float]:
    """
    Returns (home_win_probability, away_win_probability) as floats 0–1.
    """
    score_diff        = home_score - away_score
    seconds_remaining = _clock_to_seconds_remaining(period, clock)

    model = _load()
    if model is not None:
        X     = np.array([[score_diff, seconds_remaining]], dtype=float)
        proba = model.predict_proba(X)[0]
        # classes_: [0 = away wins, 1 = home wins]
        home_prob = float(proba[1])
    else:
        # Sigmoid fallback: calibrated so a 10-pt lead with 2 min left ≈ 90%
        if seconds_remaining <= 0:
            home_prob = 1.0 if score_diff > 0 else (0.5 if score_diff == 0 else 0.0)
        else:
            # Normalize score diff by expected scoring variance remaining
            z         = score_diff / (0.0091 * seconds_remaining + 1.8)
            home_prob = 1 / (1 + math.exp(-z * 1.5))

    # Clamp and return
    home_prob = max(0.01, min(0.99, home_prob))
    return round(home_prob, 4), round(1 - home_prob, 4)
```

**Step 2: Write a unit test**

Create `backend/tests/test_win_probability.py`:

```python
"""Unit tests for win_probability.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import win_probability as wp


class TestClockToSeconds:

    def test_start_of_q1(self):
        assert wp._clock_to_seconds_remaining(1, "12:00") == 2880

    def test_halftime_start_q3(self):
        # Start of Q3 = 24 min left in game
        assert wp._clock_to_seconds_remaining(3, "12:00") == 24 * 60

    def test_start_of_q4(self):
        assert wp._clock_to_seconds_remaining(4, "12:00") == 720

    def test_end_of_game(self):
        assert wp._clock_to_seconds_remaining(4, "00:00") == 0

    def test_overtime_returns_zero(self):
        assert wp._clock_to_seconds_remaining(5, "05:00") == 0


class TestPredict:

    def test_returns_tuple_of_two_floats(self):
        h, a = wp.predict(80, 70, 4, "02:00")
        assert isinstance(h, float)
        assert isinstance(a, float)

    def test_probabilities_sum_to_one(self):
        h, a = wp.predict(80, 70, 4, "02:00")
        assert abs(h + a - 1.0) < 0.001

    def test_leading_team_has_higher_probability(self):
        h, a = wp.predict(90, 80, 4, "01:00")
        assert h > a

    def test_trailing_team_has_lower_probability(self):
        h, a = wp.predict(70, 90, 4, "01:00")
        assert h < a

    def test_early_game_close_score_near_fifty_fifty(self):
        # Score 0-0 at start should be close to home advantage ~55-60%
        h, a = wp.predict(0, 0, 1, "12:00")
        assert 0.50 <= h <= 0.70

    def test_probabilities_clamped_above_zero(self):
        h, a = wp.predict(200, 0, 4, "00:01")
        assert h > 0.01
        assert a > 0.01
```

**Step 3: Run the tests**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/test_win_probability.py -v
```
Expected: all 8 tests pass.

**Step 4: Commit**

```bash
git add backend/win_probability.py backend/tests/test_win_probability.py
git commit -m "feat: add win_probability inference module with unit tests"
```

---

## Task 8: Add Backend Routes

**Files:**
- Modify: `backend/main.py`

**Step 1: Add imports at the top of main.py**

After the existing imports block, add:
```python
import live_games
import win_probability
import live_cache
```

**Step 2: Add routes**

Add these two endpoints **after** the existing `/teams/{team_abbr}/schedule` endpoint (at the bottom of the file, before any closing code):

```python
# ==========================================
# ENDPOINT: Live games (no probabilities)
# GET /games/live
# ==========================================
@app.get("/games/live")
def get_live_games():
    cached = live_cache.get("live_games")
    if cached is not None:
        return cached

    games = live_games.fetch_live_games()
    # Strip probability fields — these aren't computed here
    result = [
        {
            "game_id":    g["game_id"],
            "status":     g["status"],
            "period":     g["period"],
            "clock":      g["clock"],
            "home_team":  {k: v for k, v in g["home_team"].items()},
            "away_team":  {k: v for k, v in g["away_team"].items()},
            "last_updated": g["last_updated"],
        }
        for g in games
    ]
    live_cache.set("live_games", result, ttl=20)
    return result


# ==========================================
# ENDPOINT: Live games with win probability
# GET /games/live/probabilities
# ==========================================
@app.get("/games/live/probabilities")
def get_live_probabilities():
    cached = live_cache.get("live_probabilities")
    if cached is not None:
        return cached

    games = live_games.fetch_live_games()

    result = []
    for g in games:
        home_score = g["home_team"]["score"]
        away_score = g["away_team"]["score"]
        period     = g["period"]
        clock      = g["clock"]

        home_prob, away_prob = win_probability.predict(home_score, away_score, period, clock)

        result.append({
            "game_id": g["game_id"],
            "status":  g["status"],
            "period":  period,
            "clock":   clock,
            "home_team": {
                **g["home_team"],
                "win_probability": home_prob,
            },
            "away_team": {
                **g["away_team"],
                "win_probability": away_prob,
            },
            "last_updated": g["last_updated"],
            "model_type": "logistic",
        })

    live_cache.set("live_probabilities", result, ttl=20)
    return result
```

**Step 3: Add backend tests for the new routes**

Create `backend/tests/test_live_api.py`:

```python
"""
Integration tests for /games/live and /games/live/probabilities.
Uses the existing TestClient fixture from conftest.py.
nba_api calls are monkeypatched so tests run offline.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache


# ── Fixtures ───────────────────────────────────────────────────────────────────

FAKE_GAMES = [
    {
        "game_id":   "0022500001",
        "status":    "Live",
        "period":    3,
        "clock":     "05:30",
        "home_team": {"abbr": "LAL", "name": "Lakers", "score": 78},
        "away_team": {"abbr": "BOS", "name": "Celtics", "score": 74},
        "last_updated": "2026-03-09T20:00:00Z",
    }
]


@pytest.fixture(autouse=True)
def patch_live_games(monkeypatch):
    """Replace fetch_live_games with a deterministic fake."""
    import live_games
    monkeypatch.setattr(live_games, "fetch_live_games", lambda: FAKE_GAMES)
    live_cache.clear()
    yield
    live_cache.clear()


# ── /games/live ────────────────────────────────────────────────────────────────

class TestGetLiveGames:

    def test_returns_200(self, client):
        assert client.get("/games/live").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/live").json()
        assert isinstance(data, list)

    def test_game_has_expected_fields(self, client):
        game = client.get("/games/live").json()[0]
        assert "game_id"    in game
        assert "home_team"  in game
        assert "away_team"  in game
        assert "period"     in game
        assert "clock"      in game

    def test_returns_empty_list_when_no_live_games(self, client, monkeypatch):
        import live_games
        monkeypatch.setattr(live_games, "fetch_live_games", lambda: [])
        live_cache.clear()
        data = client.get("/games/live").json()
        assert data == []


# ── /games/live/probabilities ──────────────────────────────────────────────────

class TestGetLiveProbabilities:

    def test_returns_200(self, client):
        assert client.get("/games/live/probabilities").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/live/probabilities").json()
        assert isinstance(data, list)

    def test_probabilities_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "win_probability" in game["home_team"]
        assert "win_probability" in game["away_team"]

    def test_probabilities_sum_to_one(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        total = game["home_team"]["win_probability"] + game["away_team"]["win_probability"]
        assert abs(total - 1.0) < 0.01

    def test_home_team_leading_has_higher_probability(self, client):
        # LAL leads 78-74 in Q3 in fake data
        game = client.get("/games/live/probabilities").json()[0]
        assert game["home_team"]["win_probability"] > game["away_team"]["win_probability"]

    def test_model_type_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "model_type" in game
```

**Step 4: Run all backend tests**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
pytest tests/ -v
```
Expected: all tests pass (including new live API tests).

**Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_live_api.py
git commit -m "feat: add /games/live and /games/live/probabilities endpoints with tests"
```

---

## Task 9: Create `WinProbabilityBar.jsx`

**Files:**
- Create: `frontend/src/components/WinProbabilityBar.jsx`

**Step 1: Write the component**

```jsx
// frontend/src/components/WinProbabilityBar.jsx
/**
 * Horizontal probability bar showing home vs away win probability.
 * Props:
 *   homeProb  – float 0–1
 *   awayProb  – float 0–1
 *   homeAbbr  – string e.g. "LAL"
 *   awayAbbr  – string e.g. "BOS"
 */
export default function WinProbabilityBar({ homeProb, awayProb, homeAbbr, awayAbbr }) {
  const homePct = Math.round(homeProb * 100);
  const awayPct = Math.round(awayProb * 100);

  return (
    <div style={{ width: '100%' }}>
      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--text-secondary)', marginBottom: 5,
        textTransform: 'uppercase',
      }}>
        <span style={{ color: homePct > 50 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
          {homeAbbr} {homePct}%
        </span>
        <span style={{ color: awayPct > 50 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
          {awayPct}% {awayAbbr}
        </span>
      </div>

      {/* Bar */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 4,
        overflow: 'hidden', background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: `${homePct}%`,
          background: homePct > awayPct
            ? 'linear-gradient(90deg, var(--cyan) 0%, rgba(34,211,238,0.6) 100%)'
            : 'rgba(34,211,238,0.25)',
          transition: 'width 0.6s ease',
          borderRadius: '4px 0 0 4px',
        }} />
        <div style={{
          width: `${awayPct}%`,
          background: awayPct > homePct
            ? 'linear-gradient(90deg, rgba(249,115,22,0.6) 0%, var(--orange) 100%)'
            : 'rgba(249,115,22,0.25)',
          transition: 'width 0.6s ease',
          borderRadius: '0 4px 4px 0',
        }} />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/WinProbabilityBar.jsx
git commit -m "feat: add WinProbabilityBar component"
```

---

## Task 10: Create `LiveGameCard.jsx`

**Files:**
- Create: `frontend/src/components/LiveGameCard.jsx`

**Step 1: Write the component**

```jsx
// frontend/src/components/LiveGameCard.jsx
import WinProbabilityBar from './WinProbabilityBar';

const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

export default function LiveGameCard({ game, selected, onClick }) {
  const { home_team: home, away_team: away, period, clock } = game;
  const periodLabel = PERIOD_LABEL[period] ?? `OT${period - 4}`;

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
      {/* Period + clock header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
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
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}>
          {periodLabel} · {clock}
        </span>
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {/* Away team */}
        <div style={{ textAlign: 'left', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {away.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1,
            color: away.score > home.score ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {away.score}
          </div>
        </div>

        {/* VS divider */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</div>

        {/* Home team */}
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {home.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1,
            color: home.score > away.score ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {home.score}
          </div>
        </div>
      </div>

      {/* Win probability bar */}
      {home.win_probability != null && (
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

**Step 2: Commit**

```bash
git add frontend/src/components/LiveGameCard.jsx
git commit -m "feat: add LiveGameCard component"
```

---

## Task 11: Create `LiveWinProbability.jsx`

**Files:**
- Create: `frontend/src/components/LiveWinProbability.jsx`

**Step 1: Write the component**

```jsx
// frontend/src/components/LiveWinProbability.jsx
import { useState, useEffect, useRef } from 'react';
import LiveGameCard from './LiveGameCard';
import { getLiveGamesWithProbabilities } from '../api';

const POLL_INTERVAL_MS = 25_000;

export default function LiveWinProbability() {
  const [games,        setGames       ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [error,        setError       ] = useState(null);
  const [lastUpdated,  setLastUpdated ] = useState(null);
  const [selectedId,   setSelectedId  ] = useState(null);
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

  useEffect(() => {
    fetchGames();
    intervalRef.current = setInterval(fetchGames, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div>
      {/* Header */}
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

        {/* Live pulse indicator */}
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

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching live games…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
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

      {/* Game grid */}
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
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/LiveWinProbability.jsx
git commit -m "feat: add LiveWinProbability main container with polling"
```

---

## Task 12: Update `api.js`

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Add the two new API helpers**

Append to the end of `api.js`:

```js
export async function getLiveGames() {
  const res = await fetch(`${BASE_URL}/games/live`);
  if (!res.ok) throw new Error('Failed to fetch live games');
  return res.json();
}

export async function getLiveGamesWithProbabilities() {
  const res = await fetch(`${BASE_URL}/games/live/probabilities`);
  if (!res.ok) throw new Error('Failed to fetch live probabilities');
  return res.json();
}
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add getLiveGames and getLiveGamesWithProbabilities to api.js"
```

---

## Task 13: Wire Live Tab into `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add import**

Add to the imports at the top of `App.jsx`:
```jsx
import LiveWinProbability from './components/LiveWinProbability';
```

**Step 2: Replace the Live placeholder in the render block**

Change:
```jsx
{activeTab === 'Live' && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading Live…</div>}
```
To:
```jsx
{activeTab === 'Live' && <LiveWinProbability />}
```

Note: the Live tab does **not** pass `season` — live data is always current and season-independent.

**Step 3: Build the frontend**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build 2>&1 | tail -10
```
Expected: build succeeds with no errors.

**Step 4: Final end-to-end smoke test (manual)**

1. Start the backend: `cd backend && uvicorn main:app --reload --port 8000`
2. Start the frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Click the **Live** tab (second tab)
5. Verify: loading spinner appears briefly, then either game cards or the empty-state message
6. Verify: page refreshes every 25 seconds (check Network tab in DevTools)

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire LiveWinProbability into Live tab in App.jsx"
```

---

## Final Checklist

- [ ] `_regress`, trajectory endpoint, season-preview endpoint removed from backend
- [ ] `PlayerTrajectory.jsx` and `SeasonOutlook.jsx` deleted
- [ ] Tab order: Team Search → **Live** → Roster → Top Scorers → Team Comparer → Playoffs
- [ ] `win_prob_model.pkl` generated and committed
- [ ] `/games/live` returns 200 with correct shape
- [ ] `/games/live/probabilities` returns probabilities that sum to 1
- [ ] All backend tests pass (`pytest tests/ -v`)
- [ ] Frontend builds without errors
- [ ] Live tab shows game cards (or graceful empty state)
- [ ] Page auto-refreshes every 25 seconds
