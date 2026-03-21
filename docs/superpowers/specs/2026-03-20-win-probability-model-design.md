# Win Probability Model — Real Play-by-Play Training

**Date:** 2026-03-20
**Status:** Approved

---

## Problem

The current win probability model (`win_prob_model.pkl`) is trained on synthetic data — final scores are linearly distributed across time to generate snapshots. This does not reflect real game dynamics (runs, comebacks, momentum). As a result, the ML model produces overconfident predictions and is bypassed entirely in production in favor of a hand-tuned sigmoid heuristic. No accuracy metrics (AUC, Brier score) are measured or stored.

---

## Goal

Replace the synthetic training pipeline with real play-by-play snapshots from 3 seasons of NBA data. Train a calibrated logistic regression model with a third feature (team strength). Measure and persist AUC-ROC and Brier score on a held-out test set. Replace the sigmoid heuristic in inference with the trained model.

---

## Features

Three features per snapshot:

| Feature | Description |
|---|---|
| `score_diff` | `home_score − away_score` at the moment of the snapshot |
| `seconds_remaining` | Total seconds left in the game (computed from period + clock) |
| `win_pct_diff` | Home team's cumulative win% before the game − away team's cumulative win% |

`win_pct_diff` adds team-strength context without requiring real-time roster or lineup data. It is already available in `_win_pct` at every inference call site.

---

## Data Collection

- **Source:** `nba_api.stats.endpoints.playbyplay` (historical endpoint)
- **Seasons:** 2022-23, 2023-24, 2024-25 (~3,690 games)
- **Snapshots:** Every made scoring play (2pt, 3pt, free throw) within each game — approximately 150–200 snapshots per game, yielding ~600,000 total rows
- **Label:** `1` if the home team won the game, `0` otherwise
- **Win%:** Team cumulative win% before each game, sourced from `leaguegamelog` standings matched by game date

---

## Train/Test Split

Split **by game ID**, not by snapshot. All snapshots from a given game belong entirely to either the train set or the test set. This prevents data leakage (a model that sees 3rd-quarter snapshots of a game cannot memorize the outcome from other snapshots of the same game in the training set).

- **80% of games** → training set
- **20% of games** → holdout test set (never seen during training or calibration)

---

## Model Architecture

```
LogisticRegression(max_iter=1000)
    wrapped in
CalibratedClassifierCV(method='sigmoid', cv=5)
    wrapped in
Pipeline([StandardScaler, CalibratedClassifierCV])
```

`CalibratedClassifierCV` with Platt scaling directly optimizes Brier score, ensuring that when the model outputs 70%, the home team actually wins approximately 70% of the time. This is critical because users read the probability number literally on the UI.

---

## Evaluation

Metrics computed on the holdout test set and saved to `backend/model_metrics.json`:

- **AUC-ROC** — discriminative ability. Target: ≥ 0.85
- **Brier score** — calibration quality. Target: ≤ 0.15 (0.25 = random, 0.0 = perfect)

The evaluation script (`backend/evaluate_win_probability.py`) is standalone and can be re-run at any time against the saved test set.

---

## Files Changed

### `backend/train_win_probability.py` — Rewrite
- Replace `_synthesize_states()` with real play-by-play collection
- Add `win_pct_diff` feature
- Add game-level train/test split (80/20)
- Replace `LogisticRegression` with `CalibratedClassifierCV` pipeline
- Save `model_metrics.json` alongside `win_prob_model.pkl`
- Print AUC + Brier score on completion

### `backend/win_probability.py` — Update
- Add `home_win_pct=0.5, away_win_pct=0.5` params to `predict()`
- Pass `win_pct_diff` as third feature to model
- Remove "ML model bypassed" comment; model now used in production
- Sigmoid fallback retained for missing-pkl case only

### `backend/main.py` — Update (two call sites)
- Line ~939: pass `home_win_pct` and `away_win_pct` from `_win_pct` to `predict()`
- Line ~945 (backfill loop): pass team win percentages so historical probability chart is consistent with live predictions

### `backend/tests/test_win_probability.py` — Update
- Fix `test_overtime_returns_zero`: OT now returns actual seconds remaining (was fixed in a prior session; test is now stale)
- Update `predict()` call signatures to use new optional params (existing tests keep passing via defaults)

### New: `backend/evaluate_win_probability.py`
- Standalone script: loads pkl + saved test set, prints AUC and Brier score
- Usable for re-evaluation after retraining on new seasons

### `backend/win_prob_model.pkl` — Regenerated
- New format: 3-feature pipeline with calibration layer
- Old pkl is incompatible and will be overwritten

### New: `backend/model_metrics.json`
- Persists AUC and Brier score from most recent training run
- Format: `{"auc": 0.xxx, "brier": 0.xxx, "seasons": [...], "n_games": N, "trained_at": "ISO-8601"}`

---

## Output Compatibility

No breaking changes to any API or frontend:

- `predict()` return type: `tuple[float, float]` — unchanged
- Value range: clamped `[0.01, 0.99]` — unchanged
- Game-over case (`seconds_remaining <= 0`): returns 1.0/0.0 — unchanged
- `pregame_predict()` — unchanged
- API response schema — unchanged
- Sigmoid heuristic retained as fallback if pkl is missing

---

## Success Criteria

1. Training completes without error on 3 seasons of real play-by-play data
2. AUC-ROC ≥ 0.85 on holdout test set
3. Brier score ≤ 0.15 on holdout test set
4. `model_metrics.json` saved alongside pkl
5. All existing backend tests pass
6. `test_overtime_returns_zero` updated to reflect correct OT behavior
