# Live Game Stats Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tabbed live box score stats (Win Probability / Team Stats / Roster) to the expanded LiveGameCard in the Live tab.

**Architecture:** A new `backend/boxscore.py` module fetches live box score data from `nba_api.live.nba.endpoints.boxscore.BoxScore` per game_id with a 5s cache. The data is appended as a `box_score` field on each live game object returned by `GET /games/live/probabilities`. The frontend `LiveGameCard.jsx` gains a tab bar (only shown when a live game is selected) that switches between the existing WinProbabilityChart and two new components: `TeamStatsPanel.jsx` (full team box score) and `RosterPanel.jsx` (player rows sorted by minutes).

**Tech Stack:** Python / FastAPI / nba_api (backend); React / inline styles / CSS vars (frontend, no new dependencies)

---

## Chunk 1: Backend — boxscore module + endpoint extension

### Task 1: Create `backend/boxscore.py`

**Files:**
- Create: `backend/boxscore.py`
- Create: `backend/tests/test_boxscore.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_boxscore.py`:

```python
"""Tests for backend/boxscore.py — patched so no real NBA API calls are made."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache


# ── Fake NBA API response ──────────────────────────────────────────────────────

def _fake_bs_data():
    """Minimal shape matching nba_api BoxScore .get_dict() output."""
    return {
        "game": {
            "homeTeam": {
                "teamTricode": "LAL",
                "statistics": {
                    "fieldGoalsMade": 38, "fieldGoalsAttempted": 85,
                    "fieldGoalsPercentage": 44.7,
                    "threePointersMade": 12, "threePointersAttempted": 31,
                    "threePointersPercentage": 38.7,
                    "freeThrowsMade": 18, "freeThrowsAttempted": 22,
                    "freeThrowsPercentage": 81.8,
                    "reboundsTotal": 42, "assists": 24,
                    "steals": 7, "blocks": 4, "turnovers": 11, "points": 106,
                },
                "players": [
                    {
                        "name": "LeBron James", "nameI": "L. James",
                        "jerseyNum": "23", "position": "F", "starter": "1",
                        "statistics": {
                            "minutesCalculated": "PT34M21.00S",
                            "points": 28, "reboundsTotal": 8, "assists": 5,
                            "steals": 2, "blocks": 1,
                            "fieldGoalsMade": 11, "fieldGoalsAttempted": 22,
                            "threePointersMade": 3, "threePointersAttempted": 8,
                            "freeThrowsMade": 3, "freeThrowsAttempted": 4,
                            "turnovers": 2,
                        },
                    },
                ],
            },
            "awayTeam": {
                "teamTricode": "BOS",
                "statistics": {
                    "fieldGoalsMade": 35, "fieldGoalsAttempted": 80,
                    "fieldGoalsPercentage": 43.8,
                    "threePointersMade": 10, "threePointersAttempted": 28,
                    "threePointersPercentage": 35.7,
                    "freeThrowsMade": 20, "freeThrowsAttempted": 24,
                    "freeThrowsPercentage": 83.3,
                    "reboundsTotal": 40, "assists": 22,
                    "steals": 5, "blocks": 3, "turnovers": 13, "points": 100,
                },
                "players": [],
            },
        }
    }


class FakeBoxScore:
    def __init__(self, game_id):
        self._data = _fake_bs_data()

    def get_dict(self):
        return self._data


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    live_cache.clear()
    yield
    live_cache.clear()


class TestFetchLiveBoxscore:

    def test_returns_dict_with_home_and_away(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert result is not None
        assert "home" in result
        assert "away" in result

    def test_home_team_stats_present(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        ts = result["home"]["team_stats"]
        assert ts["pts"] == 106
        assert ts["ast"] == 24
        assert ts["reb"] == 42

    def test_home_team_stats_shooting(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        ts = result["home"]["team_stats"]
        assert ts["fgm"] == 38
        assert ts["fga"] == 85
        assert abs(ts["fg_pct"] - 44.7) < 0.1

    def test_players_list_present(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert isinstance(result["home"]["players"], list)
        assert len(result["home"]["players"]) == 1

    def test_player_fields(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        p = result["home"]["players"][0]
        assert p["name"] == "LeBron James"
        assert p["pts"] == 28
        assert p["starter"] is True
        assert p["min"] == "34:21"

    def test_returns_none_on_api_error(self, monkeypatch):
        import boxscore as bs_module
        def boom(game_id):
            raise RuntimeError("API down")
        monkeypatch.setattr(bs_module, "_BoxScore", boom)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert result is None

    def test_caches_result(self, monkeypatch):
        import boxscore as bs_module
        call_count = {"n": 0}
        class CountingFakeBS(FakeBoxScore):
            def __init__(self, game_id):
                call_count["n"] += 1
                super().__init__(game_id)
        monkeypatch.setattr(bs_module, "_BoxScore", CountingFakeBS)
        bs_module.fetch_live_boxscore("0022500001")
        bs_module.fetch_live_boxscore("0022500001")
        assert call_count["n"] == 1  # second call hits cache
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_boxscore.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'boxscore'`

- [ ] **Step 3: Create `backend/boxscore.py`**

```python
# backend/boxscore.py
"""
Fetches live box score data from nba_api for a single game.
Returns normalised home/away team stats and player stats.
Returns None on any error (graceful degradation).
"""
try:
    from nba_api.live.nba.endpoints.boxscore import BoxScore as _BoxScore
except ImportError:
    _BoxScore = None  # type: ignore

import live_cache


def _parse_minutes(min_str: str) -> str:
    """Convert 'PT34M21.00S' -> '34:21'. Returns '--' on failure."""
    if not min_str or not min_str.startswith("PT"):
        return "--"
    try:
        rest = min_str[2:]
        m, rest2 = rest.split("M")
        s = rest2.rstrip("S").split(".")[0]
        return f"{int(m):02d}:{int(s):02d}"
    except Exception:
        return "--"


def _normalize_team(team_data: dict) -> dict:
    """Extract and normalize team stats + player list from raw NBA API team dict."""
    stats = team_data.get("statistics", {})

    team_stats = {
        "fgm":     int(stats.get("fieldGoalsMade", 0) or 0),
        "fga":     int(stats.get("fieldGoalsAttempted", 0) or 0),
        "fg_pct":  round(float(stats.get("fieldGoalsPercentage", 0.0) or 0.0), 1),
        "fg3m":    int(stats.get("threePointersMade", 0) or 0),
        "fg3a":    int(stats.get("threePointersAttempted", 0) or 0),
        "fg3_pct": round(float(stats.get("threePointersPercentage", 0.0) or 0.0), 1),
        "ftm":     int(stats.get("freeThrowsMade", 0) or 0),
        "fta":     int(stats.get("freeThrowsAttempted", 0) or 0),
        "ft_pct":  round(float(stats.get("freeThrowsPercentage", 0.0) or 0.0), 1),
        "reb":     int(stats.get("reboundsTotal", 0) or 0),
        "ast":     int(stats.get("assists", 0) or 0),
        "stl":     int(stats.get("steals", 0) or 0),
        "blk":     int(stats.get("blocks", 0) or 0),
        "to":      int(stats.get("turnovers", 0) or 0),
        "pts":     int(stats.get("points", 0) or 0),
    }

    players = []
    for p in team_data.get("players", []):
        ps = p.get("statistics", {})
        min_str = _parse_minutes(ps.get("minutesCalculated", ""))
        players.append({
            "name":     p.get("name", ""),
            "jersey":   p.get("jerseyNum", ""),
            "position": p.get("position", ""),
            "starter":  p.get("starter", "0") == "1",
            "min":      min_str,
            "pts":  int(ps.get("points", 0) or 0),
            "reb":  int(ps.get("reboundsTotal", 0) or 0),
            "ast":  int(ps.get("assists", 0) or 0),
            "stl":  int(ps.get("steals", 0) or 0),
            "blk":  int(ps.get("blocks", 0) or 0),
            "fgm":  int(ps.get("fieldGoalsMade", 0) or 0),
            "fga":  int(ps.get("fieldGoalsAttempted", 0) or 0),
            "fg3m": int(ps.get("threePointersMade", 0) or 0),
            "fg3a": int(ps.get("threePointersAttempted", 0) or 0),
            "ftm":  int(ps.get("freeThrowsMade", 0) or 0),
            "fta":  int(ps.get("freeThrowsAttempted", 0) or 0),
            "to":   int(ps.get("turnovers", 0) or 0),
        })

    # Sort: starters first, then by minutes descending
    def _sort_key(p):
        not_starter = 0 if p["starter"] else 1
        min_parts = p["min"].split(":") if ":" in p["min"] else ["0", "0"]
        try:
            total_sec = int(min_parts[0]) * 60 + int(min_parts[1])
        except ValueError:
            total_sec = 0
        return (not_starter, -total_sec)

    players.sort(key=_sort_key)

    return {"team_stats": team_stats, "players": players}


def fetch_live_boxscore(game_id: str) -> dict | None:
    """
    Fetch live box score for a game. Returns dict with 'home' and 'away' keys,
    each containing 'team_stats' (dict) and 'players' (list).
    Returns None on any error.
    Cached per game_id with 5s TTL.
    """
    cache_key = f"boxscore_{game_id}"
    cached = live_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        if _BoxScore is None:
            return None
        bs = _BoxScore(game_id=game_id)
        data = bs.get_dict()
        game = data.get("game", {})
        result = {
            "home": _normalize_team(game.get("homeTeam", {})),
            "away": _normalize_team(game.get("awayTeam", {})),
        }
        live_cache.set(cache_key, result, ttl=5)
        return result
    except Exception:
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_boxscore.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add backend/boxscore.py backend/tests/test_boxscore.py
git commit -m "feat: add live box score fetcher with cache"
```

---

### Task 2: Extend `/games/live/probabilities` to include box_score

**Files:**
- Modify: `backend/main.py` (around line 1131–1152, the `entry` dict construction)
- Modify: `backend/tests/test_live_api.py` (add new test class)

- [ ] **Step 1: Write the failing test**

Add to the end of `backend/tests/test_live_api.py`:

```python
class TestLiveProbabilitiesBoxScore:

    def test_box_score_field_present(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: {
            "home": {"team_stats": {"pts": 78}, "players": []},
            "away": {"team_stats": {"pts": 74}, "players": []},
        })
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert "box_score" in game

    def test_box_score_has_home_and_away(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: {
            "home": {"team_stats": {"pts": 78}, "players": []},
            "away": {"team_stats": {"pts": 74}, "players": []},
        })
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert "home" in game["box_score"]
        assert "away" in game["box_score"]

    def test_box_score_null_when_fetch_fails(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: None)
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert game["box_score"] is None

    def test_upcoming_games_have_no_box_score(self, client, monkeypatch):
        import live_games
        monkeypatch.setattr(live_games, "fetch_live_games", lambda: [{
            "game_id": "0022500099",
            "status": "Upcoming",
            "date": "2026-03-12",
            "time": "7:30 pm ET",
            "period": 0, "clock": "--",
            "home_team": {"abbr": "LAL", "name": "Lakers", "score": 0},
            "away_team": {"abbr": "BOS", "name": "Celtics", "score": 0},
            "last_updated": "2026-03-12T00:00:00Z",
        }])
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert game.get("box_score") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_live_api.py::TestLiveProbabilitiesBoxScore -v
```

Expected: FAIL — `box_score` key not found in response

- [ ] **Step 3: Add `import boxscore` and box_score logic to `main.py`**

At the top of `backend/main.py`, add this import alongside the other live-game imports (search for `import live_games` to find the right location):

```python
import boxscore as boxscore_module
```

Then in the `get_live_probabilities()` function, find the `entry` dict (around line 1131) and add the `box_score` key.

For live games (inside the `else` block, after `new_scoring_plays = game_tracker.drain_new_plays(game_id)`), add:

```python
            box_score = boxscore_module.fetch_live_boxscore(game_id)
```

Then in the `entry` dict construction, add the new field at the end:

```python
        entry = {
            "game_id": game_id,
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
            "model_type": "pregame_log5" if is_upcoming else "logistic",
            "prob_history": prob_history,
            "new_scoring_plays": new_scoring_plays,
            "box_score": None if is_upcoming else box_score,
        }
```

Note: `box_score` is defined in the `else` (live) block; for upcoming games `is_upcoming=True` so the ternary returns `None` without referencing the variable.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_live_api.py -v
```

Expected: All tests PASS (including previously-passing tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add backend/main.py backend/tests/test_live_api.py
git commit -m "feat: include box_score in live probabilities response"
```

---

## Chunk 2: Frontend — TeamStatsPanel and RosterPanel components

### Task 3: Create `frontend/src/components/TeamStatsPanel.jsx`

**Files:**
- Create: `frontend/src/components/TeamStatsPanel.jsx`

This component receives `homeStats`, `awayStats`, `homeAbbr`, `awayAbbr` props. Each `*Stats` is the `team_stats` object from `box_score.home.team_stats`.

- [ ] **Step 1: Create `frontend/src/components/TeamStatsPanel.jsx`**

```jsx
// frontend/src/components/TeamStatsPanel.jsx
import { getTeamColor } from '../utils/teamLogos';

function fmt(made, att, pct) {
  return `${made}/${att} (${pct}%)`;
}

const ROWS = [
  { label: 'FG',  key: 'shooting_fg'  },
  { label: '3PT', key: 'shooting_3pt' },
  { label: 'FT',  key: 'shooting_ft'  },
  { label: 'REB', key: 'reb'  },
  { label: 'AST', key: 'ast'  },
  { label: 'STL', key: 'stl'  },
  { label: 'BLK', key: 'blk'  },
  { label: 'TO',  key: 'to'   },
  { label: 'PTS', key: 'pts'  },
];

function buildRows(s) {
  return {
    shooting_fg:  fmt(s.fgm, s.fga, s.fg_pct),
    shooting_3pt: fmt(s.fg3m, s.fg3a, s.fg3_pct),
    shooting_ft:  fmt(s.ftm, s.fta, s.ft_pct),
    reb: s.reb,
    ast: s.ast,
    stl: s.stl,
    blk: s.blk,
    to:  s.to,
    pts: s.pts,
  };
}

export default function TeamStatsPanel({ homeStats, awayStats, homeAbbr, awayAbbr }) {
  if (!homeStats || !awayStats) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Stats unavailable
      </div>
    );
  }

  const homeRows = buildRows(homeStats);
  const awayRows = buildRows(awayStats);
  const homeColor = getTeamColor(homeAbbr);
  const awayColor = getTeamColor(awayAbbr);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 13, fontFamily: 'var(--font-mono)',
      }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, color: awayColor || 'var(--text-primary)', textAlign: 'left' }}>
              {awayAbbr}
            </th>
            <th style={{ ...thStyle, color: 'var(--text-muted)', textAlign: 'center', width: 60 }}>
              —
            </th>
            <th style={{ ...thStyle, color: homeColor || 'var(--text-primary)', textAlign: 'right' }}>
              {homeAbbr}
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, key }) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-primary)' }}>
                {awayRows[key]}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {label}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>
                {homeRows[key]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-light)',
};

const tdStyle = {
  padding: '9px 12px',
};
```

- [ ] **Step 2: Verify it renders without error**

Start the frontend dev server and navigate to a live game card.
```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run dev
```
The component will be tested visually in Task 5 when integrated.

- [ ] **Step 3: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add frontend/src/components/TeamStatsPanel.jsx
git commit -m "feat: add TeamStatsPanel component for live box score display"
```

---

### Task 4: Create `frontend/src/components/RosterPanel.jsx`

**Files:**
- Create: `frontend/src/components/RosterPanel.jsx`

Receives `homePlayers`, `awayPlayers`, `homeAbbr`, `awayAbbr` props. Each `*Players` is the `players` array from `box_score.home.players` (already sorted starters-first by the backend).

- [ ] **Step 1: Create `frontend/src/components/RosterPanel.jsx`**

```jsx
// frontend/src/components/RosterPanel.jsx
import { getTeamColor } from '../utils/teamLogos';

const COLS = [
  { label: '#',   key: 'jersey',  align: 'left',  width: 28 },
  { label: 'Player', key: 'name', align: 'left',  flex: 1   },
  { label: 'Pos', key: 'position',align: 'center',width: 36 },
  { label: 'Min', key: 'min',     align: 'center',width: 48 },
  { label: 'Pts', key: 'pts',     align: 'center',width: 36 },
  { label: 'Reb', key: 'reb',     align: 'center',width: 36 },
  { label: 'Ast', key: 'ast',     align: 'center',width: 36 },
  { label: 'Stl', key: 'stl',     align: 'center',width: 36 },
  { label: 'Blk', key: 'blk',     align: 'center',width: 36 },
  { label: 'FG',  key: 'fg',      align: 'center',width: 64 },
  { label: '3P',  key: 'fg3',     align: 'center',width: 52 },
  { label: 'FT',  key: 'ft',      align: 'center',width: 52 },
  { label: 'TO',  key: 'to',      align: 'center',width: 36 },
];

function playerRow(p) {
  return {
    ...p,
    fg:  `${p.fgm}/${p.fga}`,
    fg3: `${p.fg3m}/${p.fg3a}`,
    ft:  `${p.ftm}/${p.fta}`,
  };
}

function TeamTable({ players, abbr }) {
  const color = getTeamColor(abbr);
  if (!players || players.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
        No player data
      </div>
    );
  }
  const rows = players.map(playerRow);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: color || 'var(--text-primary)',
        marginBottom: 8,
      }}>
        {abbr}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 12, fontFamily: 'var(--font-mono)',
        }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} style={{
                  padding: '6px 8px',
                  textAlign: col.align,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-light)',
                  whiteSpace: 'nowrap',
                  width: col.width,
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid var(--border-light)',
                opacity: p.min === '--' || p.min === '00:00' ? 0.4 : 1,
              }}>
                {COLS.map(col => (
                  <td key={col.key} style={{
                    padding: '7px 8px',
                    textAlign: col.align,
                    color: col.key === 'name'
                      ? (p.starter ? 'var(--text-primary)' : 'var(--text-secondary)')
                      : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    fontWeight: col.key === 'name' && p.starter ? 500 : 400,
                  }}>
                    {p[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RosterPanel({ homePlayers, awayPlayers, homeAbbr, awayAbbr }) {
  if (!homePlayers && !awayPlayers) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Roster stats unavailable
      </div>
    );
  }

  return (
    <div>
      <TeamTable players={awayPlayers} abbr={awayAbbr} />
      <TeamTable players={homePlayers} abbr={homeAbbr} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add frontend/src/components/RosterPanel.jsx
git commit -m "feat: add RosterPanel component for live player box scores"
```

---

## Chunk 3: Frontend — Tab integration in LiveGameCard

### Task 5: Add tab bar to `LiveGameCard.jsx`

**Files:**
- Modify: `frontend/src/components/LiveGameCard.jsx`

- [ ] **Step 1: Add imports and tab state to `LiveGameCard.jsx`**

At the top of `frontend/src/components/LiveGameCard.jsx`, add the two new component imports after the existing imports:

```js
import TeamStatsPanel from './TeamStatsPanel';
import RosterPanel from './RosterPanel';
```

Inside the `LiveGameCard` component function body, add tab state after the existing variable declarations (after the `isTomorrow` line):

```js
  const [activeTab, setActiveTab] = useState('probability');
```

- [ ] **Step 2: Update the function signature to accept `box_score`**

Change the function signature from:

```js
export default function LiveGameCard({ game, selected, onClick, prob_history = [], new_scoring_plays = [] }) {
```

to:

```js
export default function LiveGameCard({ game, selected, onClick, prob_history = [], new_scoring_plays = [], box_score = null }) {
```

- [ ] **Step 3: Add the tab bar and tab content panels**

Replace the existing expanded section (the comment `{/* Win probability chart — shown when live game is selected */}` and its `{selected && isLive && ...}` block) with the tab bar + panels:

**Old code to replace:**
```jsx
      {/* Win probability chart — shown when live game is selected */}
      {selected && isLive && (
        <div style={{ marginTop: 20 }}>
          <WinProbabilityChart
            prob_history={prob_history}
            homeAbbr={home.abbr}
            awayAbbr={away.abbr}
            homeColor={getTeamColor(home.abbr)}
            awayColor={getTeamColor(away.abbr)}
          />
        </div>
      )}
```

**New code:**
```jsx
      {/* Expanded panel — tabs shown when live game is selected */}
      {selected && isLive && (
        <div style={{ marginTop: 20 }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 16,
            borderBottom: '1px solid var(--border-light)', paddingBottom: 0,
          }}>
            {[
              { id: 'probability', label: 'Win Probability' },
              ...(box_score ? [
                { id: 'team',   label: 'Team Stats' },
                { id: 'roster', label: 'Roster'     },
              ] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={e => { e.stopPropagation(); setActiveTab(tab.id); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 14px',
                  fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 400,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.id
                    ? '2px solid var(--cyan)'
                    : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'probability' && (
            <WinProbabilityChart
              prob_history={prob_history}
              homeAbbr={home.abbr}
              awayAbbr={away.abbr}
              homeColor={getTeamColor(home.abbr)}
              awayColor={getTeamColor(away.abbr)}
            />
          )}
          {activeTab === 'team' && box_score && (
            <TeamStatsPanel
              homeStats={box_score.home?.team_stats}
              awayStats={box_score.away?.team_stats}
              homeAbbr={home.abbr}
              awayAbbr={away.abbr}
            />
          )}
          {activeTab === 'roster' && box_score && (
            <RosterPanel
              homePlayers={box_score.home?.players}
              awayPlayers={box_score.away?.players}
              homeAbbr={home.abbr}
              awayAbbr={away.abbr}
            />
          )}
        </div>
      )}
```

- [ ] **Step 4: Pass `box_score` from `LiveWinProbability.jsx` to `LiveGameCard`**

In `frontend/src/components/LiveWinProbability.jsx`, find the `<LiveGameCard` usage (around line 124) and add the `box_score` prop:

```jsx
                <LiveGameCard
                  game={game}
                  selected={selectedId === game.game_id}
                  onClick={() => setSelectedId(id => id === game.game_id ? null : game.game_id)}
                  prob_history={game.prob_history ?? []}
                  new_scoring_plays={game.new_scoring_plays ?? []}
                  box_score={game.box_score ?? null}
                />
```

- [ ] **Step 5: Verify in browser**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run dev
```

Navigate to the Live tab. Click a live game card. Verify:
- Tab bar appears with "Win Probability", "Team Stats", "Roster"
- Win Probability tab shows the existing chart
- Team Stats tab shows a two-column table with FG/3PT/FT/REB/AST/STL/BLK/TO/PTS
- Roster tab shows two stacked player tables (away team on top, home team below)
- Clicking a tab does NOT toggle the card collapsed (stopPropagation works)
- If `box_score` is null, only "Win Probability" tab appears

- [ ] **Step 6: Commit**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream
git add frontend/src/components/LiveGameCard.jsx frontend/src/components/LiveWinProbability.jsx
git commit -m "feat: add tabbed live game stats (Win Probability / Team Stats / Roster)"
```
