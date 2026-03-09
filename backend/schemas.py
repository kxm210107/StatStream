# backend/schemas.py
from typing import Optional
from pydantic import BaseModel, ConfigDict

class PlayerStatSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id:    int
    season:       str
    player_name:  str
    team:         str
    pts_per_game: float
    reb_per_game: float
    ast_per_game: float
    position:     Optional[str] = None

class LeagueAverages(BaseModel):
    avg_pts: float
    avg_reb: float
    avg_ast: float

class TeamStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    team:            str
    avg_pts:         float
    avg_reb:         float
    avg_ast:         float
    player_count:    int
    score:           float
    win_probability: float

class CompareResult(BaseModel):
    team1:      TeamStats
    team2:      TeamStats
    home_team:  str
    model_type: str   # 'ml' or 'weighted'

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
    clock:        str          # normalised to "MM:SS"
    last_updated: str          # ISO-8601 UTC

class LiveGameWithProbability(LiveGame):
    model_type: str = "logistic"

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
