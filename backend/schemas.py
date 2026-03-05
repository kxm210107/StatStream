# backend/schemas.py
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
