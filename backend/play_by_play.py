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


def _parse_clock(clock_str: str) -> str:
    """Convert PT08M42.00S → 08:42."""
    if not clock_str or not clock_str.startswith("PT"):
        return "00:00"
    try:
        rest = clock_str[2:]
        m, rest2 = rest.split("M")
        s = rest2.rstrip("S").split(".")[0]
        return f"{int(m):02d}:{int(s):02d}"
    except Exception:
        return "00:00"


def fetch_full_game_history(game_id: str) -> list[dict]:
    """
    Fetch all made 2pt/3pt scoring plays from the beginning of a game.
    Used to backfill win-probability history when the backend first sees a live game.

    Each play includes: action_number, team_abbr, points, period, clock (MM:SS),
    score_home, score_away.  Returns [] on any error.
    """
    try:
        if playbyplay is None:
            return []
        pbp = playbyplay.PlayByPlay(game_id=game_id)
        actions = pbp.actions.get_dict()
    except Exception:
        return []

    plays = []
    for action in actions:
        action_type = action.get("actionType", "").lower()
        shot_result = action.get("shotResult", "").lower()
        if action_type in ("2pt", "3pt") and shot_result == "made":
            points = 3 if action_type == "3pt" else 2
        elif action_type == "freethrow" and shot_result == "made":
            points = 1
        else:
            continue
        plays.append({
            "action_number": int(action.get("actionNumber", 0)),
            "team_abbr":     action.get("teamTricode", ""),
            "points":        points,
            "period":        int(action.get("period", 1)),
            "clock":         _parse_clock(action.get("clock", "")),
            "score_home":    int(action.get("scoreHome", 0) or 0),
            "score_away":    int(action.get("scoreAway", 0) or 0),
        })
    return plays


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
            continue

        action_type = action.get("actionType", "").lower()
        shot_result = action.get("shotResult", "").lower()

        if action_type in ("2pt", "3pt") and shot_result == "made":
            points = 3 if action_type == "3pt" else 2
        elif action_type == "freethrow" and shot_result == "made":
            points = 1
        else:
            continue

        plays.append({
            "action_number": num,
            "team_abbr":     action.get("teamTricode", ""),
            "points":        points,
            "description":   action.get("description", ""),
        })

    return plays, max_seen
