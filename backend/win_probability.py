# backend/win_probability.py
"""
Load the trained win probability model and expose a single predict() function.
Falls back to a calibrated sigmoid heuristic if the model file is missing.
"""

import os
import math
import numpy as np

MODEL_PATH    = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
_model        = None
_model_loaded = False

REGULATION_SECONDS = 48 * 60  # 2880


def _load():
    global _model, _model_loaded
    if not _model_loaded:
        if os.path.exists(MODEL_PATH):
            import joblib
            _model = joblib.load(MODEL_PATH)
        _model_loaded = True
    return _model


def _clock_to_seconds_remaining(period: int, clock: str) -> int:
    """
    Convert live game state to total seconds remaining in regulation.
    period: 1-4 (overtime treated as 0 seconds remaining for model purposes)
    clock:  "MM:SS" string normalised by live_games.py
    """
    if period <= 0 or period > 4:
        return 0

    # Parse MM:SS
    try:
        parts = clock.split(":")
        mins  = int(parts[0])
        secs  = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        mins, secs = 0, 0

    seconds_left_in_period   = mins * 60 + secs
    periods_remaining_after  = 4 - period          # complete quarters still to play
    return seconds_left_in_period + periods_remaining_after * 12 * 60


def predict(home_score: int, away_score: int, period: int, clock: str) -> tuple[float, float]:
    """
    Returns (home_win_probability, away_win_probability) as floats 0-1.
    """
    score_diff        = home_score - away_score
    seconds_remaining = _clock_to_seconds_remaining(period, clock)

    model = _load()
    if model is not None:
        X     = np.array([[score_diff, seconds_remaining]], dtype=float)
        proba = model.predict_proba(X)[0]
        # classes_: [0 = away wins, 1 = home wins]
        home_prob = float(proba[1])
    else:
        # Sigmoid fallback: calibrated so a 10-pt lead with 2 min left ~= 90%
        if seconds_remaining <= 0:
            home_prob = 1.0 if score_diff > 0 else (0.5 if score_diff == 0 else 0.0)
        else:
            z         = score_diff / (0.0091 * seconds_remaining + 1.8)
            home_prob = 1 / (1 + math.exp(-z * 1.5))

    # Clamp and return
    home_prob = max(0.01, min(0.99, home_prob))
    return round(home_prob, 4), round(1 - home_prob, 4)
