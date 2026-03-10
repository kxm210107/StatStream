"""
Compatibility shim: LeagueSchedule wraps ScheduleLeagueV2 and renames columns
to the legacy names expected by StatStream's /games/upcoming endpoint.
"""
import pandas as pd
from nba_api.stats.endpoints.scheduleleaguev2 import ScheduleLeagueV2


_COLUMN_MAP = {
    "gameId":                   "GAME_ID",
    "gameDateEst":              "GAME_DATE_EST",
    "gameStatusText":           "GAME_STATUS_TEXT",
    "homeTeam_teamId":          "HOME_TEAM_ID",
    "homeTeam_teamTricode":     "HOME_TEAM_ABBREVIATION",
    "homeTeam_teamName":        "HOME_TEAM_NAME",
    "awayTeam_teamId":          "VISITOR_TEAM_ID",
    "awayTeam_teamTricode":     "VISITOR_TEAM_ABBREVIATION",
    "awayTeam_teamName":        "VISITOR_TEAM_NAME",
}


class LeagueSchedule:
    """Thin wrapper around ScheduleLeagueV2 with legacy-style column names."""

    # game_type "2" = regular season; NBA game IDs encode game type at position 2
    # e.g. "0022500001" -> position 2 = '2' (regular season)

    def __init__(self, league_id="00", season_year="2024-25", game_type="2", **kwargs):
        self._game_type = game_type
        self._inner = ScheduleLeagueV2(
            league_id=league_id,
            season=season_year,
        )

    def get_data_frames(self):
        df = self._inner.get_data_frames()[0]
        df = df.rename(columns=_COLUMN_MAP)
        if self._game_type and "GAME_ID" in df.columns:
            df = df[df["GAME_ID"].astype(str).str[2] == self._game_type]
        return [df]
