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
