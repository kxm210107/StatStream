# Play-by-Play Live Updates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace 25-second polling with 5-second play-by-play updates — storing per-game win probability history in the backend, detecting made field goals from the NBA play-by-play API, and animating +2/+3 badges on the scoring team in the UI.

**Architecture:** Backend accumulates per-game probability history in memory (so mid-game page loads get the full arc) and tracks the last play seen per game to detect new scoring events incrementally. The existing `/games/live/probabilities` endpoint is extended to include `prob_history` and `new_scoring_plays` in each game's payload. Frontend polls every 5 seconds instead of 25.

**Tech Stack:** FastAPI · nba_api (live scoreboard + playbyplay) · pytest · React · Recharts · CSS keyframe animations

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/game_tracker.py` | **Create** | In-memory per-game state: prob history + scoring play queue |
| `backend/play_by_play.py` | **Create** | Fetch new scoring plays from NBA play-by-play API |
| `backend/tests/test_game_tracker.py` | **Create** | Unit tests for game_tracker |
| `backend/tests/test_play_by_play.py` | **Create** | Unit tests for play_by_play (mocked NBA API) |
| `backend/main.py` | **Modify** | Integrate tracker + play-by-play into `/games/live/probabilities`; reduce cache TTL to 5s |
| `backend/tests/test_live_api.py` | **Modify** | Add tests for new response fields (`prob_history`, `new_scoring_plays`) |
| `frontend/src/components/WinProbabilityChart.jsx` | **Modify** | Accept `prob_history` (backend shape), elapsed_sec x-axis, quarter markers |
| `frontend/src/components/LiveGameCard.jsx` | **Modify** | Accept `new_scoring_plays`; add ScoreFlash animation component |
| `frontend/src/components/LiveWinProbability.jsx` | **Modify** | Poll every 5s; remove client-side history tracking; pass backend fields to cards |

---

## Task 1: Create `backend/game_tracker.py`

**Files:**
- Create: `backend/game_tracker.py`
- Create: `backend/tests/test_game_tracker.py`

This module holds all mutable live-game state. It is intentionally kept separate from the API layer so it can be tested in isolation.

### Data shapes

```python
# prob_history entry
{"elapsed_sec": int, "home_prob": float}

# scoring play entry
{"action_number": int, "team_abbr": str, "points": int, "description": str}
```

`elapsed_sec` = total regulation seconds elapsed (0 at tip-off, 2880 at end of Q4).
Formula: `elapsed = (period - 1) * 720 + (720 - seconds_left_in_period)` capped to [0, 2880].

### Implementation

```python
# backend/game_tracker.py
"""
In-memory per-game state for live win probability tracking.
Stores probability history (full game arc) and queues new scoring plays
for the next API response.
"""
from dataclasses import dataclass, field

REGULATION_SECONDS = 2880  # 48 min × 60


@dataclass
class _GameState:
    prob_history: list = field(default_factory=list)   # [{elapsed_sec, home_prob}]
    last_action_number: int = 0
    _pending_plays: list = field(default_factory=list)  # drained on each read


_states: dict[str, _GameState] = {}


def _get(game_id: str) -> _GameState:
    if game_id not in _states:
        _states[game_id] = _GameState()
    return _states[game_id]


def elapsed_sec(period: int, clock: str) -> int:
    """Return total regulation seconds elapsed from period + MM:SS clock."""
    if period <= 0:
        return 0
    try:
        parts = clock.split(":")
        mins = int(parts[0])
        secs = int(parts[1]) if len(parts) > 1 else 0
        sec_left = mins * 60 + secs
    except Exception:
        sec_left = 0
    completed = min(period - 1, 4) * 720
    elapsed = completed + max(0, 720 - sec_left)
    return min(elapsed, REGULATION_SECONDS)


def record_prob(game_id: str, period: int, clock: str, home_prob: float) -> None:
    """Append a probability snapshot for a live game."""
    state = _get(game_id)
    e = elapsed_sec(period, clock)
    # Avoid duplicate snapshots at same elapsed second
    if state.prob_history and state.prob_history[-1]["elapsed_sec"] == e:
        state.prob_history[-1]["home_prob"] = home_prob
        return
    state.prob_history.append({"elapsed_sec": e, "home_prob": home_prob})
    # Cap at 576 entries (~48 min at one point per 5s)
    if len(state.prob_history) > 576:
        state.prob_history = state.prob_history[-576:]


def get_prob_history(game_id: str) -> list:
    return list(_get(game_id).prob_history)


def get_last_action_number(game_id: str) -> int:
    return _get(game_id).last_action_number


def add_scoring_plays(game_id: str, plays: list, last_action_number: int) -> None:
    """Queue new scoring plays and advance the last-seen action counter."""
    state = _get(game_id)
    state._pending_plays.extend(plays)
    state.last_action_number = max(state.last_action_number, last_action_number)


def drain_new_plays(game_id: str) -> list:
    """Return and clear the pending scoring plays."""
    state = _get(game_id)
    plays = list(state._pending_plays)
    state._pending_plays.clear()
    return plays


def clear_all() -> None:
    """Flush all state (test helper)."""
    _states.clear()
```

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_game_tracker.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import game_tracker


@pytest.fixture(autouse=True)
def reset():
    game_tracker.clear_all()
    yield
    game_tracker.clear_all()


class TestElapsedSec:
    def test_start_of_q1(self):
        assert game_tracker.elapsed_sec(1, "12:00") == 0

    def test_end_of_q1(self):
        assert game_tracker.elapsed_sec(1, "00:00") == 720

    def test_start_of_q2(self):
        assert game_tracker.elapsed_sec(2, "12:00") == 720

    def test_mid_q3(self):
        # Q3 started, 5:30 left → elapsed = 2*720 + (720 - 330) = 1440 + 390 = 1830
        assert game_tracker.elapsed_sec(3, "05:30") == 1830

    def test_end_of_regulation(self):
        assert game_tracker.elapsed_sec(4, "00:00") == 2880

    def test_ot_capped(self):
        assert game_tracker.elapsed_sec(5, "05:00") == 2880

    def test_invalid_clock(self):
        assert game_tracker.elapsed_sec(2, "--") == 720  # completed Q1


class TestRecordProb:
    def test_appends_entry(self):
        game_tracker.record_prob("g1", 2, "06:00", 0.6)
        history = game_tracker.get_prob_history("g1")
        assert len(history) == 1
        assert history[0]["home_prob"] == 0.6

    def test_deduplicates_same_elapsed(self):
        game_tracker.record_prob("g1", 2, "06:00", 0.6)
        game_tracker.record_prob("g1", 2, "06:00", 0.62)  # same elapsed, different prob
        history = game_tracker.get_prob_history("g1")
        assert len(history) == 1
        assert history[0]["home_prob"] == 0.62  # updated in place

    def test_multiple_games_isolated(self):
        game_tracker.record_prob("g1", 1, "10:00", 0.5)
        game_tracker.record_prob("g2", 1, "10:00", 0.7)
        assert game_tracker.get_prob_history("g1")[0]["home_prob"] == 0.5
        assert game_tracker.get_prob_history("g2")[0]["home_prob"] == 0.7


class TestScoringPlays:
    def test_drain_returns_plays(self):
        plays = [{"action_number": 5, "team_abbr": "LAL", "points": 3, "description": "3pt"}]
        game_tracker.add_scoring_plays("g1", plays, last_action_number=5)
        drained = game_tracker.drain_new_plays("g1")
        assert len(drained) == 1
        assert drained[0]["team_abbr"] == "LAL"

    def test_drain_clears_queue(self):
        game_tracker.add_scoring_plays("g1", [{"action_number": 1}], 1)
        game_tracker.drain_new_plays("g1")
        assert game_tracker.drain_new_plays("g1") == []

    def test_last_action_number_advances(self):
        game_tracker.add_scoring_plays("g1", [], last_action_number=42)
        assert game_tracker.get_last_action_number("g1") == 42

    def test_last_action_number_never_goes_back(self):
        game_tracker.add_scoring_plays("g1", [], last_action_number=42)
        game_tracker.add_scoring_plays("g1", [], last_action_number=10)
        assert game_tracker.get_last_action_number("g1") == 42
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_game_tracker.py -v
```
Expected: `ModuleNotFoundError: No module named 'game_tracker'`

- [ ] **Step 3: Write `backend/game_tracker.py`** (code above)

- [ ] **Step 4: Run tests to confirm pass**

```bash
python -m pytest tests/test_game_tracker.py -v
```
Expected: all 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/game_tracker.py backend/tests/test_game_tracker.py
git commit -m "feat: add game_tracker module for per-game probability history"
```

---

## Task 2: Create `backend/play_by_play.py`

**Files:**
- Create: `backend/play_by_play.py`
- Create: `backend/tests/test_play_by_play.py`

Fetches incremental scoring plays from the NBA live play-by-play API.

### Implementation

```python
# backend/play_by_play.py
"""
Fetches new scoring plays (made 2pt/3pt field goals) for a live game
from nba_api.live.nba.endpoints.playbyplay.
Returns only plays with action_number > since_action_number.
"""
try:
    from nba_api.live.nba.endpoints import playbyplay  # module-level so tests can patch it
except ImportError:
    playbyplay = None  # type: ignore


def fetch_scoring_plays(game_id: str, since_action_number: int) -> tuple[list[dict], int]:
    """
    Returns (scoring_plays, max_action_number_seen).

    scoring_plays: list of dicts with keys:
        action_number: int
        team_abbr: str
        points: int   (2 or 3)
        description: str

    max_action_number_seen: highest action_number in the response
    (use to advance the tracker's last_action_number even if no scoring plays).
    """
    try:
        if playbyplay is None:
            return [], since_action_number
        pbp = playbyplay.PlayByPlay(game_id=game_id)
        actions = pbp.actions.get_dict()
    except Exception:
        return [], since_action_number

    max_seen = since_action_number
    plays = []

    for action in actions:
        num = int(action.get("actionNumber", 0))
        if num > max_seen:
            max_seen = num
        if num <= since_action_number:
            continue  # already processed

        action_type = action.get("actionType", "").lower()
        shot_result = action.get("shotResult", "").lower()

        if action_type not in ("2pt", "3pt"):
            continue
        if shot_result != "made":
            continue

        points = 3 if action_type == "3pt" else 2
        plays.append({
            "action_number": num,
            "team_abbr":     action.get("teamTricode", ""),
            "points":        points,
            "description":   action.get("description", ""),
        })

    return plays, max_seen
```

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_play_by_play.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock


FAKE_ACTIONS = [
    {"actionNumber": 1,  "actionType": "jumpball",  "shotResult": "",      "teamTricode": "LAL", "description": "Jump ball"},
    {"actionNumber": 5,  "actionType": "2pt",        "shotResult": "Made",  "teamTricode": "LAL", "description": "LeBron 2pt"},
    {"actionNumber": 8,  "actionType": "3pt",        "shotResult": "Made",  "teamTricode": "BOS", "description": "Tatum 3pt"},
    {"actionNumber": 10, "actionType": "2pt",        "shotResult": "Missed","teamTricode": "LAL", "description": "Missed 2"},
    {"actionNumber": 12, "actionType": "freethrow",  "shotResult": "Made",  "teamTricode": "BOS", "description": "FT"},
]


def make_mock_pbp(actions):
    mock = MagicMock()
    mock.actions.get_dict.return_value = actions
    return mock


class TestFetchScoringPlays:
    def test_returns_made_field_goals_only(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        # jumpball, missed 2pt, and freethrow excluded; 2pt Made + 3pt Made included
        assert len(plays) == 2
        assert plays[0]["points"] == 2
        assert plays[1]["points"] == 3

    def test_filters_by_since_action_number(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=6)
        # only action 8 qualifies (action 5 <= 6)
        assert len(plays) == 1
        assert plays[0]["action_number"] == 8

    def test_returns_max_action_number(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            _, max_num = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        assert max_num == 12

    def test_returns_empty_on_api_error(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.side_effect = Exception("timeout")
            plays, max_num = play_by_play.fetch_scoring_plays("g1", since_action_number=5)
        assert plays == []
        assert max_num == 5  # unchanged

    def test_team_abbr_and_description_preserved(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        assert plays[0]["team_abbr"] == "LAL"
        assert "LeBron" in plays[0]["description"]
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python -m pytest tests/test_play_by_play.py -v
```
Expected: `ModuleNotFoundError: No module named 'play_by_play'`

- [ ] **Step 3: Write `backend/play_by_play.py`** (code above)

- [ ] **Step 4: Run tests to confirm pass**

```bash
python -m pytest tests/test_play_by_play.py -v
```
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/play_by_play.py backend/tests/test_play_by_play.py
git commit -m "feat: add play_by_play module to fetch incremental scoring events"
```

---

## Task 3: Integrate into `backend/main.py`

**Files:**
- Modify: `backend/main.py` (the `/games/live/probabilities` endpoint)
- Modify: `backend/tests/test_live_api.py` (add tests for new fields)

### Changes to `/games/live/probabilities`

1. Import `game_tracker` and `play_by_play` at top of file (alongside existing imports)
2. Reduce cache TTL from 20s → 5s on this endpoint
3. For each **live** game (not upcoming), after computing `home_prob`/`away_prob`:
   - Call `game_tracker.record_prob(game_id, period, clock, home_prob)`
   - Fetch new scoring plays: `plays, max_num = play_by_play.fetch_scoring_plays(game_id, game_tracker.get_last_action_number(game_id))` — wrap in its own `live_cache` call with 5s TTL using key `f"pbp_{game_id}"`
   - Call `game_tracker.add_scoring_plays(game_id, plays, max_num)`
4. Add to each game's response entry:
   - `"prob_history": game_tracker.get_prob_history(game_id)` (always, for live games)
   - `"new_scoring_plays": game_tracker.drain_new_plays(game_id)` (always, for live games)
5. Upcoming games get `"prob_history": []` and `"new_scoring_plays": []`

### Play-by-play caching (inside the endpoint, before calling play_by_play):

```python
pbp_cache_key = f"pbp_{game_id}"
cached_plays = live_cache.get(pbp_cache_key)
if cached_plays is not None:
    plays, max_num = cached_plays
else:
    plays, max_num = play_by_play.fetch_scoring_plays(
        game_id, game_tracker.get_last_action_number(game_id)
    )
    live_cache.set(pbp_cache_key, (plays, max_num), ttl=5)
game_tracker.add_scoring_plays(game_id, plays, max_num)
```

### New tests in `test_live_api.py`

Add a new class at the bottom:

```python
class TestLiveProbabilitiesNewFields:

    def test_prob_history_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "prob_history" in game

    def test_prob_history_is_list(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert isinstance(game["prob_history"], list)

    def test_new_scoring_plays_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "new_scoring_plays" in game

    def test_new_scoring_plays_is_list(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert isinstance(game["new_scoring_plays"], list)

    def test_prob_history_accumulates_across_calls(self, client):
        import live_cache
        live_cache.clear()
        client.get("/games/live/probabilities")
        live_cache.clear()  # force second fetch
        client.get("/games/live/probabilities")
        game = client.get("/games/live/probabilities").json()[0]
        # After 3 calls (with cache busting) history should have entries
        assert len(game["prob_history"]) >= 1
```

- [ ] **Step 1: Write the 5 new tests** in `test_live_api.py`

- [ ] **Step 2: Run to confirm they fail**

```bash
python -m pytest tests/test_live_api.py::TestLiveProbabilitiesNewFields -v
```
Expected: FAIL — fields not yet in response

- [ ] **Step 3: Modify `backend/main.py`**

In the imports section at top:
```python
import game_tracker
import play_by_play
```

Replace the body of `get_live_probabilities()` with the updated logic (keep existing structure, add tracker/pbp calls and new fields as described above). Change `live_cache.set(..., ttl=20)` to `ttl=5`.

- [ ] **Step 4: Also patch play_by_play in the test fixture**

In `test_live_api.py`, update the `patch_live_games` fixture to also mock `play_by_play.fetch_scoring_plays` (so tests don't hit the real NBA API):

```python
@pytest.fixture(autouse=True)
def patch_live_games(monkeypatch):
    import live_games
    import play_by_play
    import game_tracker
    monkeypatch.setattr(live_games, "fetch_live_games", lambda: FAKE_GAMES)
    monkeypatch.setattr(play_by_play, "fetch_scoring_plays", lambda gid, since: ([], since))
    game_tracker.clear_all()
    live_cache.clear()
    yield
    game_tracker.clear_all()
    live_cache.clear()
```

- [ ] **Step 5: Run all live API tests**

```bash
python -m pytest tests/test_live_api.py -v
```
Expected: all tests PASS

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
python -m pytest -v
```
Expected: all existing tests still PASS

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_live_api.py
git commit -m "feat: extend live probabilities endpoint with prob_history and scoring plays (5s TTL)"
```

---

## Task 4: Update `WinProbabilityChart.jsx`

**Files:**
- Modify: `frontend/src/components/WinProbabilityChart.jsx`

The chart now receives `prob_history` from the backend (shape: `[{elapsed_sec, home_prob}]`) instead of the client-tracked `history` (shape: `[{time, homeProb}]`). Update prop name and x-axis.

### Changes

1. Rename prop from `history` to `prob_history`
2. Map data: `prob_history.map(p => ({ x: p.elapsed_sec, y: Math.round(p.home_prob * 100) }))`
3. Guard: show placeholder when `prob_history.length < 2`
4. `XAxis`: `dataKey="x"`, `hide={false}`, show quarter ticks at [720, 1440, 2160, 2880], format as "Q1"/"Q2"/"Q3"/"Q4", 10px font
5. `Line`: `dataKey="y"`
6. Update `ReferenceLine` and `YAxis` — no changes needed
7. Remove the absolute-positioned team labels (x-axis now provides context) — or keep them, either is fine

**Quarter tick formatter:**
```jsx
const QUARTER_LABELS = { 720: "Q1", 1440: "Q2", 2160: "Q3", 2880: "Q4" };
const formatXTick = (val) => QUARTER_LABELS[val] ?? "";
```

**XAxis config:**
```jsx
<XAxis
  dataKey="x"
  type="number"
  domain={[0, 2880]}
  ticks={[720, 1440, 2160, 2880]}
  tickFormatter={formatXTick}
  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
  axisLine={false}
  tickLine={false}
/>
```

**Note on tests:** This is a pure prop-rename + visual config change. There are no backend-testable behaviors. Manual verification (dev server) is the appropriate validation here.

- [ ] **Step 1: Read the current file**
- [ ] **Step 2: Apply changes** — prop rename, data mapping, x-axis config
- [ ] **Step 3: Verify it renders** — start the dev server and check the Live tab (or review code manually)
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/WinProbabilityChart.jsx
git commit -m "feat: update WinProbabilityChart to use backend prob_history with game-time x-axis"
```

---

## Task 5: Add score animation to `LiveGameCard.jsx`

**Files:**
- Modify: `frontend/src/components/LiveGameCard.jsx`

Add a `ScoreFlash` component that floats "+2" or "+3" upward and fades out when a scoring play is received for a team.

### ScoreFlash component

```jsx
import { useState, useEffect } from 'react';

function ScoreFlash({ plays, teamAbbr, side }) {
  // plays: new_scoring_plays array from backend
  // teamAbbr: e.g. "LAL"
  // side: "left" | "right" (which side of the card)
  const [flashes, setFlashes] = useState([]);

  useEffect(() => {
    const mine = plays.filter(p => p.team_abbr === teamAbbr);
    if (mine.length === 0) return;
    const newFlashes = mine.map((p, i) => ({
      id: `${p.action_number}-${i}`,
      points: p.points,
    }));
    setFlashes(prev => [...prev, ...newFlashes]);
    // auto-remove after animation completes (1.8s)
    const timer = setTimeout(() => {
      setFlashes(prev => prev.filter(f => !newFlashes.find(n => n.id === f.id)));
    }, 1800);
    return () => clearTimeout(timer);
  }, [plays]);   // re-run when plays array changes (new reference = new poll)

  if (flashes.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      [side === 'left' ? 'left' : 'right']: 20,
      top: 0,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {flashes.map(f => (
        <span
          key={f.id}
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 900,
            color: '#4ADE80',
            animation: 'scoreFloat 1.8s ease-out forwards',
            letterSpacing: '0.05em',
          }}
        >
          +{f.points}
        </span>
      ))}
    </div>
  );
}
```

Add keyframe to `frontend/src/index.css`:
```css
@keyframes scoreFloat {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-48px); }
}
```

### Wire into LiveGameCard

1. Accept `new_scoring_plays = []` prop (add to destructuring)
2. Wrap the main card content div with `position: 'relative'` (it likely already has styles — just add `position: 'relative'` to the outer div)
3. Add `<ScoreFlash plays={new_scoring_plays} teamAbbr={away.abbr} side="left" />` before the away team block
4. Add `<ScoreFlash plays={new_scoring_plays} teamAbbr={home.abbr} side="right" />` before the home team block

**Note:** Do NOT rename the `history` prop to `prob_history` in `LiveGameCard` yet — that rename happens in Task 6 along with the `LiveWinProbability` changes. Task 5 only adds `ScoreFlash` and the `new_scoring_plays` prop.

- [ ] **Step 1: Add `@keyframes scoreFloat` to `frontend/src/index.css`**
- [ ] **Step 2: Read `LiveGameCard.jsx`** to understand current structure
- [ ] **Step 3: Add `ScoreFlash` component and `new_scoring_plays` prop** (do not rename `history`)
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LiveGameCard.jsx frontend/src/index.css
git commit -m "feat: add +2/+3 score flash animation when a team scores"
```

---

## Task 6: Update `LiveWinProbability.jsx`

**Files:**
- Modify: `frontend/src/components/LiveWinProbability.jsx`

### Changes

1. Change `POLL_INTERVAL_MS` from `25_000` to `5_000`
2. Remove client-side history tracking: delete `historyRef`, `historyVersion`, and the accumulation block in `fetchGames`
3. Pass backend-provided fields to each live `<LiveGameCard>`:
   - `history={game.prob_history ?? []}` (feeds WinProbabilityChart)
   - `new_scoring_plays={game.new_scoring_plays ?? []}`

Rename the `history` prop on `LiveGameCard` to `prob_history` throughout to match the backend field name and the chart's prop (updated in Task 4):
- `LiveWinProbability` passes `prob_history={game.prob_history ?? []}`
- `LiveGameCard` accepts `prob_history = []` and passes `prob_history={prob_history}` to `WinProbabilityChart`

- [ ] **Step 1: Read the current `LiveWinProbability.jsx`**
- [ ] **Step 2: Change `POLL_INTERVAL_MS` to 5000**
- [ ] **Step 3: Update the "refreshes every 25s" display string** in the JSX to `"refreshes every 5s"`
- [ ] **Step 4: Remove historyRef, historyVersion, and the accumulation block**
- [ ] **Step 5: Update `<LiveGameCard>` props** — pass `prob_history={game.prob_history ?? []}` and `new_scoring_plays={game.new_scoring_plays ?? []}`
- [ ] **Step 6: Update `LiveGameCard.jsx`** — rename `history` → `prob_history` in its function signature and in the `WinProbabilityChart` call (this is the deferred rename from Task 5)
- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/LiveWinProbability.jsx frontend/src/components/LiveGameCard.jsx
git commit -m "feat: poll every 5s, wire backend prob_history and new_scoring_plays to live cards"
```

---

## Done

After all 6 tasks:
- Backend stores full-game probability history from tip-off
- NBA play-by-play API is checked every 5s for new scoring events
- Frontend polls every 5 seconds
- Score animations (+2/+3) appear on the scoring team when a made field goal is detected
- Chart x-axis shows game time elapsed with Q1–Q4 markers
