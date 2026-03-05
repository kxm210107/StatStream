# backend/predictor.py
"""
Loads the trained scikit-learn model and exposes a single predict() function.
Falls back to the original weighted formula if model.pkl hasn't been trained yet.
"""

import os
import math

import numpy as np

_model        = None
_model_loaded = False
MODEL_PATH    = os.path.join(os.path.dirname(__file__), "model.pkl")


def model_available() -> bool:
    return os.path.exists(MODEL_PATH)


def _load_model():
    global _model, _model_loaded
    if not _model_loaded:
        if os.path.exists(MODEL_PATH):
            import joblib
            _model = joblib.load(MODEL_PATH)
        _model_loaded = True
    return _model


def predict(
    home_avg_pts: float, home_avg_reb: float, home_avg_ast: float,
    away_avg_pts: float, away_avg_reb: float, away_avg_ast: float,
) -> tuple[float, float, str]:
    """
    Returns (home_win_pct, away_win_pct, model_type).
    model_type is 'ml' when the trained model is used, 'weighted' otherwise.

    Features fed to the model are stat differences (home − away).
    The model's intercept captures the ~60% baseline home advantage from training data.
    """
    model = _load_model()

    if model is not None:
        X = np.array([[
            home_avg_pts - away_avg_pts,
            home_avg_reb - away_avg_reb,
            home_avg_ast - away_avg_ast,
        ]])
        # classes_: [0 = away wins, 1 = home wins]
        proba      = model.predict_proba(X)[0]
        home_prob  = float(proba[1])
        return round(home_prob * 100, 1), round((1 - home_prob) * 100, 1), "ml"

    # ── Weighted-formula fallback ─────────────────────────────────────────────
    # Quality score for each team (no home bonus baked in here)
    score_home = (home_avg_pts * 0.5) + (home_avg_ast * 0.3) + (home_avg_reb * 0.2)
    score_away = (away_avg_pts * 0.5) + (away_avg_ast * 0.3) + (away_avg_reb * 0.2)
    quality_diff = score_home - score_away

    # Home-court advantage expressed as a log-odds constant.
    # Historical NBA home win rate ≈ 60%  →  log(60/40) ≈ 0.405
    HOME_COURT_LOGIT = math.log(60.0 / 40.0)

    # Quality scale: calibrated so the full spread of team quality (~3 pts in
    # the top-8-rotation metric) translates to roughly a ±15 pp swing,
    # meaning the best team at home beats the worst team away ≈ 70 %.
    QUALITY_SCALE = 0.19

    logit = HOME_COURT_LOGIT + quality_diff * QUALITY_SCALE
    p     = 1 / (1 + math.exp(-logit))
    return round(p * 100, 1), round((1 - p) * 100, 1), "weighted"
