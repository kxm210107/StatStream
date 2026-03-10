# backend/game_tracker.py
"""
In-memory per-game state for live win probability tracking.
Stores probability history (full game arc) and queues new scoring plays
for the next API response.
"""
import time
from dataclasses import dataclass, field

REGULATION_SECONDS = 2880  # 48 min × 60
_PLAY_TTL_SECONDS = 15  # discard plays older than this on drain


@dataclass
class _GameState:
    prob_history: list = field(default_factory=list)   # [{elapsed_sec, home_prob}]
    last_action_number: int = 0
    _pending_plays: list = field(default_factory=list)  # drained on each read
    backfilled: bool = False


_states: dict[str, _GameState] = {}


def _get(game_id: str) -> _GameState:
    if game_id not in _states:
        _states[game_id] = _GameState()
    return _states[game_id]


def elapsed_sec(period: int, clock: str) -> int:
    """Return total regulation seconds elapsed from period + MM:SS clock."""
    if period <= 0:
        return 0
    try:
        parts = clock.split(":")
        mins = int(parts[0])
        secs = int(parts[1]) if len(parts) > 1 else 0
        sec_left = mins * 60 + secs
    except Exception:
        sec_left = 720
    completed = min(period - 1, 4) * 720
    elapsed = completed + max(0, 720 - sec_left)
    return min(elapsed, REGULATION_SECONDS)


def record_prob(game_id: str, period: int, clock: str, home_prob: float) -> None:
    """Append a probability snapshot for a live game."""
    state = _get(game_id)
    e = elapsed_sec(period, clock)
    # Avoid duplicate snapshots at same elapsed second
    if state.prob_history and state.prob_history[-1]["elapsed_sec"] == e:
        state.prob_history[-1]["home_prob"] = home_prob
        return
    state.prob_history.append({"elapsed_sec": e, "home_prob": home_prob})
    # Cap at 576 entries (~48 min at one point per 5s)
    if len(state.prob_history) > 576:
        state.prob_history = state.prob_history[-576:]


def get_prob_history(game_id: str) -> list:
    return list(_get(game_id).prob_history)


def get_last_action_number(game_id: str) -> int:
    return _get(game_id).last_action_number


def add_scoring_plays(game_id: str, plays: list, last_action_number: int) -> None:
    """Queue new scoring plays and advance the last-seen action counter."""
    state = _get(game_id)
    now = time.time()
    state._pending_plays.extend({**p, "queued_at": now} for p in plays)
    state.last_action_number = max(state.last_action_number, last_action_number)


def drain_new_plays(game_id: str) -> list:
    """Return and clear pending scoring plays, dropping stale ones."""
    state = _get(game_id)
    cutoff = time.time() - _PLAY_TTL_SECONDS
    plays = [p for p in state._pending_plays if p.get("queued_at", 0) >= cutoff]
    state._pending_plays.clear()
    return plays


def is_backfilled(game_id: str) -> bool:
    return _get(game_id).backfilled


def mark_backfilled(game_id: str) -> None:
    _get(game_id).backfilled = True


def clear_all() -> None:
    """Flush all state (test helper)."""
    _states.clear()
