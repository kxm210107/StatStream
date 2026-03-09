# backend/live_games.py
"""
Fetches currently live NBA games from nba_api and normalises them
into the internal LiveGame shape (no win probability logic here).
"""

import datetime
from nba_api.live.nba.endpoints import scoreboard


def _parse_clock(clock_str: str) -> str:
    """
    Convert nba_api clock format "PT08M42.00S" -> "08:42".
    Returns "--" if not in expected format.
    """
    if not clock_str or not clock_str.startswith("PT"):
        return "--"
    try:
        rest = clock_str[2:]                   # "08M42.00S"
        m, rest2 = rest.split("M")
        s = rest2.rstrip("S").split(".")[0]
        return f"{int(m):02d}:{int(s):02d}"
    except Exception:
        return "--"


def fetch_live_games() -> list[dict]:
    """
    Return a list of dicts representing games currently in progress.
    Each dict matches the LiveGame schema (without win_probability fields).
    """
    try:
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
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
                    "score": int(home.get("score", 0) or 0),
                },
                "away_team": {
                    "abbr":  away.get("teamTricode", ""),
                    "name":  away.get("teamName", ""),
                    "score": int(away.get("score", 0) or 0),
                },
                "last_updated": now,
            })

        return live
    except Exception:
        return []
