# backend/live_games.py
"""
Fetches currently live NBA games from nba_api and normalises them
into the internal LiveGame shape (no win probability logic here).

Final games are retained for FINAL_WINDOW_HOURS (13h) after they finish,
then dropped so the Live tab doesn't show stale results forever.
"""

import datetime
from nba_api.live.nba.endpoints import scoreboard

FINAL_WINDOW_HOURS = 13

# game_id -> datetime (UTC) when the game was first seen as Final
_final_times: dict[str, datetime.datetime] = {}


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


def _record_final(game_id: str, now: datetime.datetime) -> None:
    """Record the first time we see a game as Final."""
    if game_id not in _final_times:
        _final_times[game_id] = now


def _within_window(game_id: str, now: datetime.datetime) -> bool:
    """Return True if the game finished less than FINAL_WINDOW_HOURS ago."""
    finished_at = _final_times.get(game_id)
    if finished_at is None:
        return False
    return (now - finished_at).total_seconds() < FINAL_WINDOW_HOURS * 3600


def clear_final_times() -> None:
    """Flush final-times tracker (for testing)."""
    _final_times.clear()


def fetch_live_games() -> list[dict]:
    """
    Return a list of dicts representing games currently in progress or recently finished.
    Each dict matches the LiveGame schema (without win_probability fields).
    Final games are included for up to FINAL_WINDOW_HOURS after they finish.
    """
    try:
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
        live = []
        now  = datetime.datetime.utcnow()
        now_iso = now.isoformat() + "Z"

        today_str = datetime.date.today().isoformat()

        for g in games:
            game_status = g.get("gameStatus", 1)  # 1=scheduled, 2=live, 3=final
            game_id = g.get("gameId", "")

            home = g.get("homeTeam", {})
            away = g.get("awayTeam", {})

            if game_status == 3:
                _record_final(game_id, now)
                if not _within_window(game_id, now):
                    continue  # too old, drop it
                live.append({
                    "game_id": game_id,
                    "status":  "Final",
                    "period":  g.get("period", 4),
                    "clock":   "--",
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
                    "last_updated": now_iso,
                })
            elif game_status == 1:
                live.append({
                    "game_id": game_id,
                    "status":  "Upcoming",
                    "date":    today_str,
                    "time":    g.get("gameStatusText", ""),
                    "period":  0,
                    "clock":   "--",
                    "home_team": {
                        "abbr":  home.get("teamTricode", ""),
                        "name":  home.get("teamName", ""),
                        "score": 0,
                    },
                    "away_team": {
                        "abbr":  away.get("teamTricode", ""),
                        "name":  away.get("teamName", ""),
                        "score": 0,
                    },
                    "last_updated": now_iso,
                })
            else:
                live.append({
                    "game_id": game_id,
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
                    "last_updated": now_iso,
                })

        return live
    except Exception:
        return []
