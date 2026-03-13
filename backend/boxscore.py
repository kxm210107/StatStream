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
