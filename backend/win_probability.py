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
    Convert live game state to total seconds remaining.
    period: 1-4 regulation, 5+ overtime (each OT period is 5 minutes).
    clock:  "MM:SS" string normalised by live_games.py
    """
    if period <= 0:
        return 0

    try:
        parts = clock.split(":")
        mins  = int(parts[0])
        secs  = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        mins, secs = 0, 0

    seconds_left_in_period = mins * 60 + secs

    if period > 4:
        # OT: return only the time left in the current OT period
        return seconds_left_in_period

    periods_remaining_after = 4 - period          # complete quarters still to play
    return seconds_left_in_period + periods_remaining_after * 12 * 60


def predict(
    home_score: int,
    away_score: int,
    period: int,
    clock: str,
    home_win_pct: float = 0.5,
    away_win_pct: float = 0.5,
) -> tuple[float, float]:
    """
    Returns (home_win_probability, away_win_probability) as floats 0-1.
    Uses the trained ML model when available; falls back to sigmoid heuristic
    if the model file is missing (sigmoid uses only score_diff and seconds_remaining).
    """
    score_diff        = home_score - away_score
    seconds_remaining = _clock_to_seconds_remaining(period, clock)

    if seconds_remaining <= 0:
        home_prob = 1.0 if score_diff > 0 else (0.5 if score_diff == 0 else 0.0)
        home_prob = max(0.01, min(0.99, home_prob))
        return round(home_prob, 4), round(1 - home_prob, 4)

    model = _load()
    if model is not None:
        win_pct_diff = home_win_pct - away_win_pct
        X = np.array([[score_diff, seconds_remaining, win_pct_diff]])
        home_prob = float(model.predict_proba(X)[0][1])
    else:
        z         = score_diff / (0.0091 * seconds_remaining + 1.8)
        home_prob = 1 / (1 + math.exp(-z * 1.5))

    home_prob = max(0.01, min(0.99, home_prob))
    return round(home_prob, 4), round(1 - home_prob, 4)


# NBA home teams win ~58% historically → +0.08 boost over a neutral 0.50 baseline
_HOME_COURT_BOOST = 0.08


def pregame_predict(home_win_pct: float, away_win_pct: float) -> tuple[float, float]:
    """
    Returns (home_win_probability, away_win_probability) for a not-yet-started game.
    Uses the Log5 formula (Bill James) with a home-court advantage boost.
    """
    h = max(0.01, min(0.99, home_win_pct + _HOME_COURT_BOOST))
    a = max(0.01, min(0.99, away_win_pct))
    denom = h + a - 2 * h * a
    home_prob = (h - h * a) / denom if denom != 0 else 0.5
    home_prob = max(0.01, min(0.99, home_prob))
    return round(home_prob, 4), round(1 - home_prob, 4)
