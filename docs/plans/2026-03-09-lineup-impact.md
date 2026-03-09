# Lineup Impact Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Lineup Impact" tab (3rd position) to StatStream showing sortable lineup combinations for any NBA team with minutes, +/-, OffRtg, DefRtg, NetRtg.

**Architecture:** Thin wrapper around `LeagueDashLineups` NBA API endpoint (two calls: Base + Advanced measure types) merged on GROUP_ID. Backend normalizes to `LineupResponse` schema. Frontend renders a sortable table in a new `LineupImpact` tab.

**Tech Stack:** Python/FastAPI/nba_api on backend; React + Vite on frontend. Tests use pytest + FastAPI TestClient + monkeypatch.

---

### Task 1: Add Lineup Schemas to `schemas.py`

**Files:**
- Modify: `backend/schemas.py`
- Test: `backend/tests/test_lineup_schemas.py` (create)

**Step 1: Write the failing test**

Create `backend/tests/test_lineup_schemas.py`:

```python
"""Tests for lineup-related Pydantic schemas."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from schemas import LineupSummary, LineupResponse

FAKE_LINEUP = {
    "lineup_id": "atl_0001",
    "players": ["Trae Young", "Dyson Daniels", "Jalen Johnson", "Zaccharie Risacher", "Onyeka Okongwu"],
    "minutes": 142.6,
    "points_for": 318,
    "points_against": 287,
    "plus_minus": 31,
    "off_rating": 118.4,
    "def_rating": 106.8,
    "net_rating": 11.6,
}

def test_lineup_summary_accepts_valid_data():
    summary = LineupSummary(**FAKE_LINEUP)
    assert summary.lineup_id == "atl_0001"
    assert len(summary.players) == 5
    assert summary.net_rating == 11.6

def test_lineup_summary_plus_minus():
    summary = LineupSummary(**FAKE_LINEUP)
    assert summary.plus_minus == summary.points_for - summary.points_against

def test_lineup_response_wraps_lineups():
    response = LineupResponse(team="ATL", season="2025-26", lineups=[FAKE_LINEUP])
    assert response.team == "ATL"
    assert len(response.lineups) == 1
    assert response.lineups[0].players[0] == "Trae Young"
```

**Step 2: Run to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_schemas.py -v
```

Expected: `ImportError: cannot import name 'LineupSummary' from 'schemas'`

**Step 3: Add schemas to `backend/schemas.py`**

Append to the end of the file:

```python
# ── Lineup Impact schemas ──────────────────────────────────────────────────────

class LineupSummary(BaseModel):
    lineup_id:      str
    players:        list[str]
    minutes:        float
    points_for:     int
    points_against: int
    plus_minus:     int
    off_rating:     float
    def_rating:     float
    net_rating:     float

class LineupResponse(BaseModel):
    team:    str
    season:  str
    lineups: list[LineupSummary]
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_schemas.py -v
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add backend/schemas.py backend/tests/test_lineup_schemas.py
git commit -m "feat: add LineupSummary and LineupResponse schemas"
```

---

### Task 2: Create `lineup_data.py`

**Files:**
- Create: `backend/lineup_data.py`
- Test: `backend/tests/test_lineup_data.py` (create)

**Step 1: Write the failing test**

Create `backend/tests/test_lineup_data.py`:

```python
"""Tests for lineup_data.py — NBA API wrapper and normalization."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pandas as pd


# ── Fake API response helpers ──────────────────────────────────────────────────

def _make_base_df():
    return pd.DataFrame([
        {
            "GROUP_ID":   "atl_0001",
            "GROUP_NAME": "Trae Young - Dyson Daniels - Jalen Johnson - Zaccharie Risacher - Onyeka Okongwu",
            "MIN":        142.6,
            "PTS":        318,
            "PLUS_MINUS": 31,
        },
        {
            "GROUP_ID":   "atl_0002",
            "GROUP_NAME": "Trae Young - Vit Krejci - Jalen Johnson - Zaccharie Risacher - Onyeka Okongwu",
            "MIN":        55.3,
            "PTS":        120,
            "PLUS_MINUS": -8,
        },
    ])

def _make_adv_df():
    return pd.DataFrame([
        {"GROUP_ID": "atl_0001", "OFF_RATING": 118.4, "DEF_RATING": 106.8, "NET_RATING": 11.6},
        {"GROUP_ID": "atl_0002", "OFF_RATING": 105.1, "DEF_RATING": 112.0, "NET_RATING": -6.9},
    ])


class FakeLeagueDashLineups:
    def __init__(self, measure_type_simple_nullable="Base", **kwargs):
        self._measure = measure_type_simple_nullable

    def get_data_frames(self):
        if self._measure == "Base":
            return [_make_base_df()]
        return [_make_adv_df()]


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestGetTeamId:
    def test_known_abbreviation_returns_int(self):
        from lineup_data import get_team_id
        team_id = get_team_id("ATL")
        assert isinstance(team_id, int)
        assert team_id > 0

    def test_case_insensitive(self):
        from lineup_data import get_team_id
        assert get_team_id("atl") == get_team_id("ATL")

    def test_unknown_abbreviation_raises(self):
        from lineup_data import get_team_id
        with pytest.raises(ValueError, match="Unknown team abbreviation"):
            get_team_id("XYZ")


class TestFetchLineupRows:
    @pytest.fixture(autouse=True)
    def patch_api(self, monkeypatch):
        import lineup_data
        monkeypatch.setattr(lineup_data, "LeagueDashLineups", FakeLeagueDashLineups)

    def test_returns_list(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        assert isinstance(rows, list)

    def test_returns_two_rows(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        assert len(rows) == 2

    def test_row_has_all_required_fields(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        for field in ("lineup_id", "players", "minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"):
            assert field in row, f"Missing field: {field}"

    def test_players_is_list_of_strings(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        assert isinstance(row["players"], list)
        assert all(isinstance(p, str) for p in row["players"])
        assert len(row["players"]) == 5

    def test_points_against_derived_correctly(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        row = rows[0]
        assert row["points_against"] == row["points_for"] - row["plus_minus"]

    def test_ratings_are_floats(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        assert isinstance(row["off_rating"], float)
        assert isinstance(row["def_rating"], float)
        assert isinstance(row["net_rating"], float)
```

**Step 2: Run to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_data.py -v
```

Expected: `ModuleNotFoundError: No module named 'lineup_data'`

**Step 3: Create `backend/lineup_data.py`**

```python
# backend/lineup_data.py
"""
Fetches and normalizes NBA lineup data using LeagueDashLineups.

Two API calls are made per request (Base + Advanced measure types) and merged
on GROUP_ID to assemble the full set of lineup metrics.
"""

from nba_api.stats.endpoints import leaguedashlineups as _ep
from nba_api.stats.static import teams as _nba_teams

LeagueDashLineups = _ep.LeagueDashLineups   # exposed for monkeypatching in tests


def get_team_id(abbr: str) -> int:
    """Return the NBA team ID for a team abbreviation like 'ATL'."""
    matches = _nba_teams.find_teams_by_abbreviation(abbr.upper())
    if not matches:
        raise ValueError(f"Unknown team abbreviation: {abbr!r}")
    return int(matches[0]["id"])


def fetch_lineup_rows(team_abbr: str, season: str) -> list[dict]:
    """
    Fetch all 5-man lineup rows for a team/season from the NBA API.

    Returns a list of dicts with keys:
        lineup_id, players, minutes, points_for, points_against,
        plus_minus, off_rating, def_rating, net_rating
    """
    team_id = get_team_id(team_abbr)

    base = LeagueDashLineups(
        season=season,
        team_id_nullable=team_id,
        measure_type_simple_nullable="Base",
        per_mode_simple="Totals",
    )
    base_df = base.get_data_frames()[0]

    adv = LeagueDashLineups(
        season=season,
        team_id_nullable=team_id,
        measure_type_simple_nullable="Advanced",
        per_mode_simple="Totals",
    )
    adv_df = adv.get_data_frames()[0]

    merged = base_df[["GROUP_ID", "GROUP_NAME", "MIN", "PTS", "PLUS_MINUS"]].merge(
        adv_df[["GROUP_ID", "OFF_RATING", "DEF_RATING", "NET_RATING"]],
        on="GROUP_ID",
        how="inner",
    )

    rows = []
    for _, row in merged.iterrows():
        pts = int(row["PTS"])
        pm  = int(row["PLUS_MINUS"])
        players = [p.strip() for p in str(row["GROUP_NAME"]).split(" - ")]
        rows.append({
            "lineup_id":      row["GROUP_ID"],
            "players":        players,
            "minutes":        float(row["MIN"]),
            "points_for":     pts,
            "points_against": pts - pm,
            "plus_minus":     pm,
            "off_rating":     float(row["OFF_RATING"]),
            "def_rating":     float(row["DEF_RATING"]),
            "net_rating":     float(row["NET_RATING"]),
        })
    return rows
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_data.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add backend/lineup_data.py backend/tests/test_lineup_data.py
git commit -m "feat: add lineup_data.py — NBA API wrapper for LeagueDashLineups"
```

---

### Task 3: Create `lineup_impact.py`

**Files:**
- Create: `backend/lineup_impact.py`
- Test: `backend/tests/test_lineup_impact.py` (create)

**Step 1: Write the failing test**

Create `backend/tests/test_lineup_impact.py`:

```python
"""Tests for lineup_impact.py — filtering, sorting, and aggregation."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

FAKE_ROWS = [
    {"lineup_id": "l1", "players": ["A","B","C","D","E"], "minutes": 200.0, "points_for": 400, "points_against": 360, "plus_minus": 40, "off_rating": 120.0, "def_rating": 108.0, "net_rating": 12.0},
    {"lineup_id": "l2", "players": ["A","B","C","D","F"], "minutes": 80.0,  "points_for": 150, "points_against": 140, "plus_minus": 10, "off_rating": 110.0, "def_rating": 103.0, "net_rating": 7.0},
    {"lineup_id": "l3", "players": ["A","B","C","D","G"], "minutes": 10.0,  "points_for": 20,  "points_against": 25,  "plus_minus": -5, "off_rating": 95.0,  "def_rating": 115.0, "net_rating": -20.0},
]


@pytest.fixture(autouse=True)
def patch_fetch(monkeypatch):
    import lineup_impact
    monkeypatch.setattr(lineup_impact, "fetch_lineup_rows", lambda abbr, season: FAKE_ROWS)


class TestGetLineupSummaries:

    def test_returns_dict_with_expected_keys(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26")
        assert "team" in result
        assert "season" in result
        assert "lineups" in result

    def test_team_and_season_echoed(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("atl", "2025-26")
        assert result["team"] == "ATL"
        assert result["season"] == "2025-26"

    def test_min_minutes_filters_out_low_usage(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=50.0)
        ids = [r["lineup_id"] for r in result["lineups"]]
        assert "l3" not in ids   # 10 min — below threshold

    def test_no_filter_returns_all(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0)
        assert len(result["lineups"]) == 3

    def test_default_sort_is_net_rating_descending(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0)
        net_ratings = [r["net_rating"] for r in result["lineups"]]
        assert net_ratings == sorted(net_ratings, reverse=True)

    def test_sort_by_minutes(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, sort_by="minutes")
        minutes = [r["minutes"] for r in result["lineups"]]
        assert minutes == sorted(minutes, reverse=True)

    def test_limit_truncates_results(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, limit=2)
        assert len(result["lineups"]) == 2

    def test_invalid_sort_by_falls_back_to_net_rating(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, sort_by="bananas")
        net_ratings = [r["net_rating"] for r in result["lineups"]]
        assert net_ratings == sorted(net_ratings, reverse=True)
```

**Step 2: Run to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_impact.py -v
```

Expected: `ModuleNotFoundError: No module named 'lineup_impact'`

**Step 3: Create `backend/lineup_impact.py`**

```python
# backend/lineup_impact.py
"""
Aggregates lineup data into sorted, filtered summaries.

All metric computation stays here; lineup_data.py owns the raw NBA API fetch.
"""

from lineup_data import fetch_lineup_rows

_SORTABLE = {"minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"}


def get_lineup_summaries(
    team_abbr: str,
    season:    str,
    min_minutes: float = 20.0,
    sort_by:     str   = "net_rating",
    limit:       int   = 20,
) -> dict:
    """
    Return filtered, sorted lineup summaries for a team/season.

    Args:
        team_abbr:   NBA team abbreviation, e.g. "ATL"
        season:      Season string, e.g. "2025-26"
        min_minutes: Minimum total minutes for a lineup to be included
        sort_by:     Field name to sort by (descending); falls back to net_rating
        limit:       Maximum number of lineups to return

    Returns:
        {"team": str, "season": str, "lineups": [LineupSummary dicts]}
    """
    if sort_by not in _SORTABLE:
        sort_by = "net_rating"

    rows = fetch_lineup_rows(team_abbr, season)
    filtered = [r for r in rows if r["minutes"] >= min_minutes]
    sorted_rows = sorted(filtered, key=lambda r: r[sort_by], reverse=True)

    return {
        "team":    team_abbr.upper(),
        "season":  season,
        "lineups": sorted_rows[:limit],
    }
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_impact.py -v
```

Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add backend/lineup_impact.py backend/tests/test_lineup_impact.py
git commit -m "feat: add lineup_impact.py — filter, sort, and aggregate lineup summaries"
```

---

### Task 4: Add Route to `main.py`

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_lineup_api.py` (create)

**Step 1: Write the failing test**

Create `backend/tests/test_lineup_api.py`:

```python
"""Tests for GET /teams/{abbr}/lineups endpoint."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

FAKE_RESPONSE = {
    "team": "ATL",
    "season": "2025-26",
    "lineups": [
        {
            "lineup_id": "atl_0001",
            "players": ["Trae Young", "Dyson Daniels", "Jalen Johnson", "Zaccharie Risacher", "Onyeka Okongwu"],
            "minutes": 142.6,
            "points_for": 318,
            "points_against": 287,
            "plus_minus": 31,
            "off_rating": 118.4,
            "def_rating": 106.8,
            "net_rating": 11.6,
        }
    ],
}


@pytest.fixture(autouse=True)
def patch_lineup_summaries(monkeypatch):
    import lineup_impact
    monkeypatch.setattr(lineup_impact, "get_lineup_summaries", lambda *a, **kw: FAKE_RESPONSE)


class TestGetTeamLineups:

    def test_returns_200(self, client):
        res = client.get("/teams/ATL/lineups")
        assert res.status_code == 200

    def test_response_has_team_and_season(self, client):
        data = client.get("/teams/ATL/lineups").json()
        assert data["team"] == "ATL"
        assert "season" in data

    def test_response_has_lineups_list(self, client):
        data = client.get("/teams/ATL/lineups").json()
        assert isinstance(data["lineups"], list)

    def test_lineup_has_all_metric_fields(self, client):
        lineup = client.get("/teams/ATL/lineups").json()["lineups"][0]
        for field in ("lineup_id", "players", "minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"):
            assert field in lineup

    def test_players_is_list(self, client):
        lineup = client.get("/teams/ATL/lineups").json()["lineups"][0]
        assert isinstance(lineup["players"], list)


class TestGetTeamLineupsErrorHandling:

    @pytest.fixture(autouse=True)
    def patch_with_error(self, monkeypatch):
        import lineup_impact
        def _boom(*a, **kw):
            raise ValueError("Unknown team abbreviation: 'XYZ'")
        monkeypatch.setattr(lineup_impact, "get_lineup_summaries", _boom)

    def test_unknown_team_returns_404(self, client):
        res = client.get("/teams/XYZ/lineups")
        assert res.status_code == 404
```

**Step 2: Run to verify it fails**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_api.py -v
```

Expected: `FAIL — 404 Not Found` (route doesn't exist yet)

**Step 3: Add route to `backend/main.py`**

First, add the import near the top of main.py (after the existing imports, before the route definitions). Find the line where other module imports are and add:

```python
import lineup_impact
```

Then add the route (place it after the existing `/teams/{team_abbr}/dashboard` route):

```python
@app.get("/teams/{abbr}/lineups", response_model=schemas.LineupResponse)
async def get_team_lineups(
    abbr:        str,
    season:      str   = "2025-26",
    min_minutes: float = 20.0,
    sort_by:     str   = "net_rating",
    limit:       int   = 20,
):
    try:
        data = lineup_impact.get_lineup_summaries(
            team_abbr=abbr,
            season=season,
            min_minutes=min_minutes,
            sort_by=sort_by,
            limit=limit,
        )
        return data
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch lineup data: {exc}")
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/test_lineup_api.py -v
```

Expected: All 6 tests PASS

**Step 5: Run the full backend test suite to confirm no regressions**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/ -v
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_lineup_api.py
git commit -m "feat: add GET /teams/{abbr}/lineups route"
```

---

### Task 5: Add API Helper to `api.js`

**Files:**
- Modify: `frontend/src/api.js`

**Step 1: Append to `frontend/src/api.js`**

Add this function at the end of the file:

```js
export async function getTeamLineups(teamAbbr, { season = '2025-26', minMinutes = 20, limit = 20, sortBy = 'net_rating' } = {}) {
  const params = new URLSearchParams({ season, min_minutes: minMinutes, limit, sort_by: sortBy });
  const res = await fetch(`${BASE_URL}/teams/${teamAbbr}/lineups?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch lineups for ${teamAbbr}`);
  return res.json();
}
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add getTeamLineups API helper"
```

---

### Task 6: Create `LineupTable.jsx`

**Files:**
- Create: `frontend/src/components/LineupTable.jsx`

**Step 1: Create the component**

Create `frontend/src/components/LineupTable.jsx`:

```jsx
import { useState } from 'react';

const COLUMNS = [
  { key: 'players',        label: 'Lineup',     sortable: false, width: '35%' },
  { key: 'minutes',        label: 'MIN',         sortable: true,  width: '9%',  fmt: v => v.toFixed(1) },
  { key: 'points_for',     label: 'PTS+',        sortable: true,  width: '8%' },
  { key: 'points_against', label: 'PTS-',        sortable: true,  width: '8%' },
  { key: 'plus_minus',     label: '+/-',         sortable: true,  width: '8%',  signed: true },
  { key: 'off_rating',     label: 'OffRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1) },
  { key: 'def_rating',     label: 'DefRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1) },
  { key: 'net_rating',     label: 'NetRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1), highlight: true },
];

function fmt(col, value) {
  if (col.fmt) return col.fmt(value);
  return value;
}

function colorForRating(value) {
  if (value > 5)  return '#4ADE80';
  if (value > 0)  return '#A3E635';
  if (value < -5) return '#F87171';
  if (value < 0)  return '#FCA5A5';
  return 'var(--text-secondary)';
}

export default function LineupTable({ lineups, sortBy, onSort }) {
  if (!lineups || lineups.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
        No lineups found for this filter.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  padding: '8px 10px',
                  textAlign: col.key === 'players' ? 'left' : 'right',
                  color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => col.sortable && onSort(col.key)}
              >
                {col.label}{col.sortable && sortBy === col.key ? ' ▼' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineups.map((lineup, i) => (
            <tr
              key={lineup.lineup_id}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              {COLUMNS.map(col => {
                const value = lineup[col.key];
                const isPlayers = col.key === 'players';
                const isNetRtg  = col.highlight;
                const isSigned  = col.signed;

                let displayColor = 'var(--text-secondary)';
                if (isNetRtg) displayColor = colorForRating(value);
                if (isSigned) displayColor = value > 0 ? '#4ADE80' : value < 0 ? '#F87171' : 'var(--text-secondary)';

                return (
                  <td
                    key={col.key}
                    style={{
                      padding: '10px 10px',
                      textAlign: isPlayers ? 'left' : 'right',
                      color: isPlayers ? 'var(--text-secondary)' : displayColor,
                      fontWeight: isNetRtg ? 700 : 400,
                      verticalAlign: 'middle',
                    }}
                  >
                    {isPlayers ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                        {value.map((name, j) => (
                          <span key={j} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {name}{j < value.length - 1 ? ' ·' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>
                        {isSigned && value > 0 ? '+' : ''}
                        {fmt(col, value)}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/LineupTable.jsx
git commit -m "feat: add LineupTable component with sortable columns"
```

---

### Task 7: Create `LineupImpact.jsx`

**Files:**
- Create: `frontend/src/components/LineupImpact.jsx`

**Step 1: Create the component**

Create `frontend/src/components/LineupImpact.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { getTeamLineups } from '../api';
import LineupTable from './LineupTable';

const TEAMS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS',
];

export default function LineupImpact({ season = '2025-26' }) {
  const [team,       setTeam      ] = useState('ATL');
  const [minMinutes, setMinMinutes] = useState(20);
  const [sortBy,     setSortBy    ] = useState('net_rating');
  const [lineups,    setLineups   ] = useState([]);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState(null);

  const loadLineups = useCallback(() => {
    setLoading(true);
    setError(null);
    getTeamLineups(team, { season, minMinutes, sortBy })
      .then(data => setLineups(data.lineups))
      .catch(err  => setError(err.message))
      .finally(()  => setLoading(false));
  }, [team, season, minMinutes, sortBy]);

  useEffect(() => { loadLineups(); }, [loadLineups]);

  function handleSort(field) {
    setSortBy(field);
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {/* Team selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Team
          </label>
          <select
            value={team}
            onChange={e => setTeam(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              colorScheme: 'dark',
              outline: 'none',
            }}
          >
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Min minutes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Min Minutes
          </label>
          <input
            type="number"
            min={0}
            max={500}
            step={10}
            value={minMinutes}
            onChange={e => setMinMinutes(Number(e.target.value))}
            style={{
              width: 80,
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              colorScheme: 'dark',
              outline: 'none',
            }}
          />
        </div>

        {/* Season badge */}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {season} Season
        </div>
      </div>

      {/* ── Heading ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          {team} — 5-Man Lineups
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Sorted by {sortBy.replace(/_/g, ' ')} · Min {minMinutes} min
        </p>
      </div>

      {/* ── States ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#F87171',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <LineupTable lineups={lineups} sortBy={sortBy} onSort={handleSort} />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/LineupImpact.jsx
git commit -m "feat: add LineupImpact component with team selector and min-minutes filter"
```

---

### Task 8: Wire as 3rd Tab in `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add import at the top of `App.jsx`**

After the existing imports (around line 10), add:

```js
import LineupImpact from './components/LineupImpact';
```

Also add `BarChart2` to the lucide import line. The current line is:
```js
import { LayoutGrid, Trophy, Search, Zap, Award, Activity } from 'lucide-react';
```
Change to:
```js
import { LayoutGrid, Trophy, Search, Zap, Award, Activity, BarChart2 } from 'lucide-react';
```

**Step 2: Insert the tab at position 3 in the TABS array**

Current TABS array (lines 16–23):
```js
const TABS = [
  { id: 'Team Search',   label: 'Team Search',   icon: <Search     size={16} strokeWidth={2.5} /> },
  { id: 'Live',          label: 'Live',           icon: <Activity   size={16} strokeWidth={2.5} /> },
  { id: 'Roster',        label: 'Roster',         icon: <LayoutGrid size={16} strokeWidth={2.5} /> },
  { id: 'Top Scorers',   label: 'Top Scorers',    icon: <Trophy     size={16} strokeWidth={2.5} /> },
  { id: 'Team Comparer', label: 'Team Comparer',  icon: <Zap        size={16} strokeWidth={2.5} /> },
  { id: 'Playoffs',      label: 'Playoffs',       icon: <Award      size={16} strokeWidth={2.5} /> },
];
```

Replace with:
```js
const TABS = [
  { id: 'Team Search',    label: 'Team Search',    icon: <Search     size={16} strokeWidth={2.5} /> },
  { id: 'Live',           label: 'Live',            icon: <Activity   size={16} strokeWidth={2.5} /> },
  { id: 'Lineups',        label: 'Lineups',         icon: <BarChart2  size={16} strokeWidth={2.5} /> },
  { id: 'Roster',         label: 'Roster',          icon: <LayoutGrid size={16} strokeWidth={2.5} /> },
  { id: 'Top Scorers',    label: 'Top Scorers',     icon: <Trophy     size={16} strokeWidth={2.5} /> },
  { id: 'Team Comparer',  label: 'Team Comparer',   icon: <Zap        size={16} strokeWidth={2.5} /> },
  { id: 'Playoffs',       label: 'Playoffs',        icon: <Award      size={16} strokeWidth={2.5} /> },
];
```

**Step 3: Add the Lineups tab render in the content panel**

In the `<div className="fade-in">` block (around line 153–161), add one line after the Live tab render:

Find:
```jsx
          {activeTab === 'Live' && <LiveWinProbability />}
          {activeSeason && activeTab === 'Playoffs'      && <PlayoffSimulator season={activeSeason} />}
```

Replace with:
```jsx
          {activeTab === 'Live'    && <LiveWinProbability />}
          {activeSeason && activeTab === 'Lineups'   && <LineupImpact    season={activeSeason} />}
          {activeSeason && activeTab === 'Playoffs'  && <PlayoffSimulator season={activeSeason} />}
```

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add Lineups as 3rd tab in App.jsx"
```

---

### Task 9: Build and Verify

**Step 1: Run the full backend test suite**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/backend
python -m pytest tests/ -v
```

Expected: All tests PASS (no regressions)

**Step 2: Build the frontend**

```bash
cd /Users/kevjumba/PycharmProjects/StatStream/frontend
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Smoke test the backend route manually**

With the backend running (`uvicorn main:app --reload` from the `backend/` directory), test:

```bash
curl "http://localhost:8000/teams/ATL/lineups?season=2025-26&min_minutes=50" | python3 -m json.tool | head -40
```

Expected: JSON response with `team`, `season`, and `lineups` array containing lineup objects.

**Step 4: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "feat: lineup impact analysis — complete MVP implementation"
```

---

## Summary of Files Changed

| File | Action |
|------|--------|
| `backend/schemas.py` | Add `LineupSummary`, `LineupResponse` |
| `backend/lineup_data.py` | Create — NBA API wrapper |
| `backend/lineup_impact.py` | Create — filter/sort logic |
| `backend/main.py` | Add `GET /teams/{abbr}/lineups` route + import |
| `backend/tests/test_lineup_schemas.py` | Create |
| `backend/tests/test_lineup_data.py` | Create |
| `backend/tests/test_lineup_impact.py` | Create |
| `backend/tests/test_lineup_api.py` | Create |
| `frontend/src/api.js` | Add `getTeamLineups` helper |
| `frontend/src/components/LineupTable.jsx` | Create |
| `frontend/src/components/LineupImpact.jsx` | Create |
| `frontend/src/App.jsx` | Add Lineups tab (3rd position) |
