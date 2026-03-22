# Plan: Player Search Tab (Roster Redesign) + DB Stats Expansion
**Date:** 2026-03-22
**Status:** Ready for execution

## Goal
Redesign the Roster tab into a Player Search section with rich per-player analytics and side-by-side comparison (up to 2 players). Expand the `player_stats` DB table to store comprehensive stats beyond PTS/REB/AST.

---

## Discovered APIs & Patterns (Phase 0 Research)

### Backend
- `backend/models.py`: `PlayerStat` has 8 columns — player_id, season, player_name, team, pts_per_game, reb_per_game, ast_per_game, position
- `backend/schemas.py`: `PlayerStatSchema` mirrors model; all new fields must be `Optional[float] = None`
- `backend/seed_season.py`: Uses `leaguedashplayerstats.LeagueDashPlayerStats(season=season, per_mode_detailed="PerGame")` → `get_data_frames()[0]`. NBA API columns: PLAYER_ID, PLAYER_NAME, TEAM_ABBREVIATION, PTS, REB, AST, BLK, STL, TOV, FG_PCT, FG3_PCT, FT_PCT, PLUS_MINUS, GP, MIN
- `backend/scripts/load_players.py`: `load_season()` manually selects columns — needs updating to include new ones
- `backend/live_cache.py`: `get(key: str)`, `set(key: str, value: Any, ttl: int = 20)` — use `ttl=300` for game logs
- Advanced stats from NBA API: call `LeagueDashPlayerStats(..., measure_type_detailed_defense='Advanced')` → provides TS_PCT, NET_RATING

### Frontend
- `frontend/src/utils/teamLogos.js`:
  - `getPlayerHeadshotUrl(playerId)` → `https://cdn.nba.com/headshots/nba/latest/260x190/{playerId}.png` (already exists!)
  - `getTeamLogoUrl(abbr)` → NBA CDN SVG
  - `getTeamColor(abbr)` → hex color or `var(--accent)`
- Recharts in use: `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`, `LabelList` (from `TopScorers.jsx`) — copy this pattern
- `TeamDashboard.jsx` visual patterns: `var(--bg-card-2)`, `var(--border-light)`, `var(--text-muted)`, `var(--stat-pts)`, `var(--stat-reb)`, `var(--stat-ast)`, monospace values at 28px/900 weight

### Anti-Patterns to Avoid
- Do NOT use `measure_type_detailed_defense` — correct param is `measure_type_detailed_defense` for defense or just pass `MeasureType='Advanced'` as keyword — verify exact kwarg against nba_api source before calling
- Do NOT construct headshot URLs manually — use existing `getPlayerHeadshotUrl(playerId)` from teamLogos.js
- Do NOT import recharts components that aren't already in the bundle — stick to what TopScorers.jsx uses

---

## Phase 1: DB Schema Expansion (Backend)

### Files to Change
1. `backend/models.py`
2. `backend/schemas.py`
3. `backend/seed_season.py`
4. `backend/scripts/load_players.py`

### Tasks

#### `backend/models.py`
Add the following nullable Float columns to `PlayerStat` after the existing `position` column:
```python
gp            = Column(Float, nullable=True)   # games played
min_per_game  = Column(Float, nullable=True)   # minutes per game
blk_per_game  = Column(Float, nullable=True)
stl_per_game  = Column(Float, nullable=True)
tov_per_game  = Column(Float, nullable=True)
fg_pct        = Column(Float, nullable=True)   # field goal %
fg3_pct       = Column(Float, nullable=True)   # 3-point %
ft_pct        = Column(Float, nullable=True)   # free throw %
plus_minus    = Column(Float, nullable=True)
ts_pct        = Column(Float, nullable=True)   # true shooting % (from advanced)
net_rating    = Column(Float, nullable=True)   # (from advanced)
```

#### `backend/schemas.py`
Add matching optional fields to `PlayerStatSchema`:
```python
gp:            Optional[float] = None
min_per_game:  Optional[float] = None
blk_per_game:  Optional[float] = None
stl_per_game:  Optional[float] = None
tov_per_game:  Optional[float] = None
fg_pct:        Optional[float] = None
fg3_pct:       Optional[float] = None
ft_pct:        Optional[float] = None
plus_minus:    Optional[float] = None
ts_pct:        Optional[float] = None
net_rating:    Optional[float] = None
```
Ensure `from typing import Optional` is imported.

#### `backend/seed_season.py`
Rewrite `seed_season()` to:
1. Fetch base stats (existing call — `per_mode_detailed="PerGame"`)
2. Fetch advanced stats: `leaguedashplayerstats.LeagueDashPlayerStats(season=season, per_mode_detailed="PerGame", measure_type_detailed_defense="Advanced")` — verify exact kwarg name first by checking nba_api source or trying `MeasureType` kwarg. The advanced DataFrame includes: TS_PCT, NET_RATING (and others we don't need).
3. Merge the two DataFrames on PLAYER_ID (inner or left join).
4. Upsert all new fields alongside existing ones. Map:
   - `BLK` → `blk_per_game`
   - `STL` → `stl_per_game`
   - `TOV` → `tov_per_game`
   - `FG_PCT` → `fg_pct`
   - `FG3_PCT` → `fg3_pct`
   - `FT_PCT` → `ft_pct`
   - `PLUS_MINUS` → `plus_minus`
   - `GP` → `gp`
   - `MIN` → `min_per_game`
   - `TS_PCT` → `ts_pct` (from advanced df)
   - `NET_RATING` → `net_rating` (from advanced df)
5. Wrap advanced fetch in try/except — if it fails, seed base stats only (graceful fallback).

#### `backend/scripts/load_players.py`
Update `load_season()` to select and map the new columns (mirror seed_season.py logic). Update the column selection line:
```python
df = df[["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "PTS", "REB", "AST",
         "BLK", "STL", "TOV", "FG_PCT", "FG3_PCT", "FT_PCT", "PLUS_MINUS", "GP", "MIN"]]
```
And map them into `PlayerStat(...)` accordingly. Advanced stats (ts_pct, net_rating) can be omitted here or also fetched — simpler to omit (they'll be null until seed_season.py runs).

### Verification
- `grep -n "blk_per_game\|ts_pct\|net_rating" backend/models.py` → should show new columns
- `grep -n "blk_per_game\|ts_pct" backend/schemas.py` → should show Optional fields
- `python -c "import sys; sys.path.insert(0,'backend'); import models; print([c.name for c in models.PlayerStat.__table__.columns])"` → should list all 19 columns

---

## Phase 2: Backend API Updates

### Files to Change
1. `backend/main.py`
2. `backend/tests/test_api.py`

### Tasks

#### `backend/main.py` — New Endpoint 1: Player Search Autocomplete
Add before or after the existing `/players/top/scorers` route:

```python
@app.get("/players/search", response_model=List[schemas.PlayerStatSchema])
def search_players(q: str = "", season: str = "2024-25", db: Session = Depends(get_db)):
    """Case-insensitive player name search for autocomplete. Returns up to 10 matches."""
    if not q or len(q.strip()) < 2:
        return []
    return (
        db.query(models.PlayerStat)
        .filter(
            models.PlayerStat.season == season,
            models.PlayerStat.player_name.ilike(f"%{q.strip()}%"),
        )
        .order_by(models.PlayerStat.pts_per_game.desc())
        .limit(10)
        .all()
    )
```

#### `backend/main.py` — New Endpoint 2: Player Game Log
Add a new endpoint for fetching a player's last 10 games. Use `live_cache` with 300s TTL:

```python
@app.get("/players/{player_id}/gamelog")
def get_player_gamelog(player_id: int, season: str = "2024-25"):
    """Fetch last 10 games for a player from NBA API. Cached for 5 minutes."""
    import live_cache
    cache_key = f"gamelog:{player_id}:{season}"
    cached = live_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        from nba_api.stats.endpoints import playergamelog
        log = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        df = log.get_data_frames()[0].head(10)
        games = []
        for _, row in df.iterrows():
            games.append({
                "date":      row.get("GAME_DATE", ""),
                "opponent":  row.get("MATCHUP", ""),
                "result":    row.get("WL", ""),
                "pts":       float(row.get("PTS", 0) or 0),
                "reb":       float(row.get("REB", 0) or 0),
                "ast":       float(row.get("AST", 0) or 0),
                "stl":       float(row.get("STL", 0) or 0),
                "blk":       float(row.get("BLK", 0) or 0),
                "fg_pct":    float(row.get("FG_PCT", 0) or 0),
            })
        live_cache.set(cache_key, games, ttl=300)
        return games
    except Exception:
        return []
```

#### `backend/tests/test_api.py` — Add TestPlayerSearch
Add a new test class after `TestTopScorers`:

```python
class TestPlayerSearch:

    def test_returns_200(self, client):
        assert client.get("/players/search?q=LeBron&season=2024-25").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/players/search?q=LeBron&season=2024-25").json()
        assert isinstance(data, list)

    def test_finds_lebron(self, client):
        data = client.get("/players/search?q=LeBron&season=2024-25").json()
        assert len(data) >= 1
        assert data[0]["player_name"] == "LeBron James"

    def test_empty_query_returns_empty(self, client):
        data = client.get("/players/search?q=&season=2024-25").json()
        assert data == []

    def test_short_query_returns_empty(self, client):
        data = client.get("/players/search?q=L&season=2024-25").json()
        assert data == []

    def test_partial_name_match(self, client):
        data = client.get("/players/search?q=james&season=2024-25").json()
        names = [p["player_name"] for p in data]
        assert "LeBron James" in names

    def test_wrong_season_returns_empty(self, client):
        data = client.get("/players/search?q=LeBron&season=1900-01").json()
        assert data == []
```

### Verification
- `curl "http://localhost:8000/players/search?q=luka&season=2024-25"` → returns list with Luka
- `curl "http://localhost:8000/players/1/gamelog?season=2024-25"` → returns list of game dicts (or empty if NBA API unavailable in test)
- Run `pytest backend/tests/test_api.py::TestPlayerSearch -v` → all pass

---

## Phase 3: Season Dropdown Scoping (Frontend)

### Files to Change
1. `frontend/src/App.jsx`

### Task
In `App.jsx`, find the season `<select>` dropdown block (lines ~100-130). Wrap it with a conditional so it only renders when the active tab needs it:

```jsx
{/* Season dropdown — only show for tabs that use historical season data */}
{!['Team Search', 'Live', 'Roster'].includes(activeTab) && (
  <div style={{ position: 'relative', marginLeft: 4 }}>
    <select ... >
      {seasons.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
    <span ...>▼</span>
  </div>
)}
```

The `activeSeason` state remains unchanged — those tabs still receive it as a prop (they'll use the most recent season regardless of whether the dropdown is visible).

### Verification
- In browser: switching to Team Search, Live, or Roster tab hides the dropdown
- Switching to Top Scorers, Team Comparer, or Playoffs shows the dropdown
- Season state still works correctly for tabs that use it

---

## Phase 4: Frontend API Functions

### Files to Change
1. `frontend/src/api.js`

### Tasks
Add two new exported async functions after the existing player functions:

```javascript
export async function searchPlayers(q, season = '2024-25') {
  const res = await fetch(`${BASE_URL}/players/search?q=${encodeURIComponent(q)}&season=${season}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function fetchPlayerGameLog(playerId, season = '2024-25') {
  const res = await fetch(`${BASE_URL}/players/${playerId}/gamelog?season=${season}`);
  if (!res.ok) return [];
  return res.json();
}
```

### Verification
- `grep "searchPlayers\|fetchPlayerGameLog" frontend/src/api.js` → both functions present

---

## Phase 5: PlayerCard Component (New)

### Files to Create
1. `frontend/src/components/PlayerCard.jsx`

### Design Reference
Copy visual patterns from:
- `frontend/src/components/TeamDashboard.jsx` — StatCard layout, color vars, table styling
- `frontend/src/components/TopScorers.jsx` — BarChart with `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`, `LabelList`
- `frontend/src/utils/teamLogos.js` — `getPlayerHeadshotUrl(playerId)`, `getTeamLogoUrl(abbr)`, `getTeamColor(abbr)`

### Props
```jsx
// player: PlayerStatSchema object (all fields from DB including new ones)
// season: string (passed from parent)
// onRemove: () => void (called when X button clicked)
export default function PlayerCard({ player, season, onRemove })
```

### Layout Structure
```
┌─────────────────────────────────────────┐
│ [X]                                     │  ← X button top-right, onClick=onRemove
│ [headshot] [Name]  [TEAM] [POS]         │  ← header row
│                                         │
│ PTS  REB  AST  BLK  STL  TOV           │  ← core stats row (colored)
│                                         │
│ FG%  ████████░░  44.2%                 │  ← shooting splits with progress bars
│ 3P%  █████░░░░░  36.1%                 │
│ FT%  ████████░░  81.5%                 │
│                                         │
│ TS%: 58.2%   NET RTG: +3.1   +/-: +4.2│  ← advanced stats row
│                                         │
│ [Bar Chart — PTS/REB/AST vs league avg] │
│                                         │
│ RECENT GAMES (last 10)                  │
│ Date  Opp  W/L  PTS REB AST STL BLK   │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Implementation Details
- **Headshot**: `<img src={getPlayerHeadshotUrl(player.player_id)} onError={...fallback to initials div}>`
  - 80x80px, border-radius 50%, border `2px solid ${getTeamColor(player.team)}`
- **Core stats**: 6 stat bubbles in a flex row. Colors: PTS=`#22D3EE`, REB=`#4ADE80`, AST=`#F97316`, BLK=`#A78BFA`, STL=`#F43F5E`, TOV=`#94A3B8`
- **Shooting progress bars**: `<div style={{background:'rgba(255,255,255,0.08)', borderRadius:4, height:6, width:'100%'}}><div style={{width:`${pct*100}%`, background:color, borderRadius:4, height:'100%'}} /></div>`
- **Bar chart**: Use `BarChart` from recharts. Data: `[{name:'PTS',value:player.pts_per_game},{name:'REB',value:player.reb_per_game},{name:'AST',value:player.ast_per_game}]`. Copy exact recharts import from TopScorers.jsx.
- **Game log**: Fetch with `fetchPlayerGameLog(player.player_id, season)` in a `useEffect`. Show a small spinner while loading. Table columns: Date / Opp / W-L / PTS / REB / AST / STL / BLK / FG%
- **W result coloring**: "W" → `#4ADE80`, "L" → `#F87171`
- Card container: `background: 'var(--bg-card-2)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 24, position: 'relative'`

### Verification
- Component renders without errors when given a player object with null optional fields
- X button calls onRemove
- Headshot falls back to initials div on 404
- Game log table appears after fetch

---

## Phase 6: PlayerProfileSearch Component + Roster Tab Wiring

### Files to Create
1. `frontend/src/components/PlayerProfileSearch.jsx`

### Files to Change
1. `frontend/src/components/PlayerTable.jsx` — add `onPlayerClick` prop
2. `frontend/src/App.jsx` — swap Roster tab component + import

### Task A: Update `PlayerTable.jsx`
Add optional `onPlayerClick` prop to the component signature:
```jsx
export default function PlayerTable({ season = '2024-25', onPlayerClick = null })
```

In the `<tr>` for each player row, add:
```jsx
onClick={() => onPlayerClick && onPlayerClick(p)}
style={{
  ...existing styles,
  cursor: onPlayerClick ? 'pointer' : 'default',
}}
```

No other changes to PlayerTable.

### Task B: Create `PlayerProfileSearch.jsx`

```jsx
// frontend/src/components/PlayerProfileSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { searchPlayers } from '../api';
import PlayerCard from './PlayerCard';
import PlayerTable from './PlayerTable';

export default function PlayerProfileSearch({ season }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState([]); // up to 2 PlayerStat objects
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlayers(val.trim(), season);
        setSuggestions(results);
        setDropdownOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const addPlayer = (player) => {
    setDropdownOpen(false);
    setQuery('');
    setSuggestions([]);
    setSelected(prev => {
      if (prev.find(p => p.player_id === player.player_id)) return prev;
      if (prev.length >= 2) return [prev[1], player]; // replace oldest
      return [...prev, player];
    });
  };

  const removePlayer = (playerId) => {
    setSelected(prev => prev.filter(p => p.player_id !== playerId));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Player Search
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Search any NBA player · Add up to 2 to compare
        </p>
      </div>

      {/* Search bar with autocomplete dropdown */}
      <div ref={wrapRef} style={{ position: 'relative', maxWidth: 440, marginBottom: 24 }}>
        {/* ... input with search icon, suggestions dropdown ... */}
        {/* Copy input + dropdown pattern from PlayerSearch.jsx */}
      </div>

      {/* Comparison area — 1 or 2 PlayerCards side by side */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
          {selected.map(player => (
            <div key={player.player_id} style={{ flex: 1, minWidth: 300 }}>
              <PlayerCard
                player={player}
                season={season}
                onRemove={() => removePlayer(player.player_id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Top-50 table — clicking a row adds to comparison */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                     textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Top 50 Players
        </h3>
        <PlayerTable season={season} onPlayerClick={addPlayer} />
      </div>
    </div>
  );
}
```

For the autocomplete dropdown, copy the exact dropdown pattern (div with `className="slide-down"`) from `frontend/src/components/PlayerSearch.jsx` lines 190-234. Adapt it to show player name + team abbreviation instead of team name.

### Task C: Update `App.jsx`
1. Add import: `import PlayerProfileSearch from './components/PlayerProfileSearch';`
2. Remove import: `import PlayerTable from './components/PlayerTable';` (PlayerTable is now used internally by PlayerProfileSearch)
3. Change the Roster tab render line from:
   ```jsx
   {activeSeason && activeTab === 'Roster' && <PlayerTable season={activeSeason} />}
   ```
   to:
   ```jsx
   {activeSeason && activeTab === 'Roster' && <PlayerProfileSearch season={activeSeason} />}
   ```

### Verification
- Roster tab shows Player Search header + search bar + Top-50 table
- Typing 2+ chars in search shows dropdown suggestions
- Clicking suggestion adds player card below search bar
- Clicking row in top-50 table adds player to comparison
- Adding 2 players shows them side by side
- X on a card removes it
- Adding a 3rd player (via table click) replaces the oldest card

---

## Phase 7: Final Verification

### Checks
1. `cd backend && pytest tests/ -v` — all existing tests pass, new TestPlayerSearch tests pass
2. `grep -n "blk_per_game\|ts_pct\|net_rating" backend/models.py backend/schemas.py` — all 11 new fields present in both
3. `grep -n "searchPlayers\|fetchPlayerGameLog" frontend/src/api.js` — both present
4. `grep -n "PlayerProfileSearch" frontend/src/App.jsx` — import and usage present
5. `grep -n "onPlayerClick" frontend/src/components/PlayerTable.jsx` — prop added
6. `grep -n "getPlayerHeadshotUrl" frontend/src/components/PlayerCard.jsx` — using existing util (not constructing URL manually)
7. Browser test: Roster tab fully functional end-to-end

### Anti-Pattern Guards
- No `measure_type_detailed_defense` used without verifying exact kwarg — must confirm from nba_api source or use try/except
- No manual headshot URL construction — uses `getPlayerHeadshotUrl()` from teamLogos.js
- No recharts components imported that weren't already in the project
- Existing `/players`, `/players/top/scorers`, `/players/team/{team_abbr}` endpoints unchanged
- `PlayerTable` still works standalone (onPlayerClick is optional/null by default)
