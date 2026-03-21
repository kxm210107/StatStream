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

`win_pct_diff` adds team-strength context without requiring real-time roster or lineup data. It is already available in `_win_pct` at every live inference call site.

When `win_pct` is unavailable for a team (e.g., early in the season, or team abbreviation not yet in the standings dict), both `home_win_pct` and `away_win_pct` default to `0.5`, making `win_pct_diff = 0.0`. This is an explicit neutral assumption, not an error condition.

---

## Data Collection

- **Source:** `nba_api.stats.endpoints.playbyplayv2.PlayByPlayV2` (historical stats endpoint — not the live endpoint used elsewhere in the codebase)
- **Seasons:** 2022-23, 2023-24, 2024-25 (~3,690 completed games)
- **Snapshots:** Every made scoring play (2pt, 3pt, free throw) within each game — approximately 150–200 snapshots per game, yielding ~600,000 total rows
- **Label:** `1` if the home team won the game, `0` otherwise
- **Win%:** Team cumulative win% before each game, sourced from `leaguegamelog` standings matched by game date
- **2024-25 season:** `LeagueGameLog` only returns rows with a non-null `WL` column, so only completed games are included regardless of whether the season is still in progress

### Rate Limiting

`nba_api` stats endpoints require a delay between requests to avoid HTTP 429 responses. The trainer must sleep **0.6 seconds** between each `PlayByPlayV2` call. At ~3,690 games, total data collection runtime is approximately **60–90 minutes**. Progress is checkpointed to a local file (`backend/pbp_cache.json`) so a partial run can be resumed without refetching completed games.

---

## Train/Test Split

Split **by game ID**, not by snapshot. All snapshots from a given game belong entirely to one partition. This prevents data leakage (a model that sees 3rd-quarter snapshots of a game cannot memorize the outcome from other snapshots of the same game in a different partition).

- **70% of games** → base training set (fit the logistic regression)
- **10% of games** → calibration set (fit the Platt scaling layer; never seen by the base model)
- **20% of games** → holdout test set (never seen during training or calibration; used only for AUC + Brier evaluation)

The test set is saved to `backend/win_prob_test_set.npz` using `np.savez(X_test=..., y_test=...)` so `evaluate_win_probability.py` can reload it independently of retraining.

---

## Model Architecture

```
Pipeline([
    ("scaler", StandardScaler()),
    ("clf", CalibratedClassifierCV(
        LogisticRegression(max_iter=1000),
        method='sigmoid',
        cv='prefit'   # calibrate on a dedicated calibration split, not cross-validation
    ))
])
```

Using `cv='prefit'` means the `LogisticRegression` is first fit on the training set, then a separate calibration split (10% of training games, held out before fitting the base model) is used to fit the Platt scaling layer. This avoids reintroducing snapshot-level leakage that `cv=5` would cause when folds are drawn by row rather than by game.

`CalibratedClassifierCV` with Platt scaling directly optimizes Brier score, ensuring that when the model outputs 70%, the home team actually wins approximately 70% of the time. This is critical because users read the probability number literally on the UI.

---

## Evaluation

Metrics computed on the holdout test set and saved to `backend/model_metrics.json`:

- **AUC-ROC** — discriminative ability. Target: ≥ 0.85
- **Brier score** — calibration quality. Target: ≤ 0.15 (0.25 = random, 0.0 = perfect)

`model_metrics.json` format:
```json
{
  "auc": 0.xxx,
  "brier": 0.xxx,
  "seasons": ["2022-23", "2023-24", "2024-25"],
  "n_games": 3690,
  "trained_at": "2026-03-20T00:00:00Z"
}
```

This file is **backend-only** — it is not exposed via any API endpoint. It is a local artifact for verifying model quality after training.

---

## Files Changed

### `backend/train_win_probability.py` — Rewrite
- Replace `_synthesize_states()` with real `PlayByPlayV2` collection
- Add `win_pct_diff` feature
- Add game-level train/test split (80% train, 10% calibration, 10% test split by game ID — or equivalently, 80/20 with a calibration split carved from train)
- Replace bare `LogisticRegression` with `CalibratedClassifierCV(cv='prefit')` pipeline
- Checkpoint progress to `pbp_cache.json` (caches derived feature rows: `score_diff`, `seconds_remaining`, `win_pct_diff`, `label`, `game_id`); sleep 0.6s between API calls
- Save `win_prob_model.pkl`, `win_prob_test_set.npz`, and `model_metrics.json`
- Add `pbp_cache.json`, `win_prob_test_set.npz`, and `model_metrics.json` to `.gitignore` (local artifacts only)
- Print AUC + Brier score on completion

### `backend/win_probability.py` — Update
- Add `home_win_pct=0.5, away_win_pct=0.5` params to `predict()`
- Compute `win_pct_diff = home_win_pct - away_win_pct` and pass as third feature to model
- Remove "ML model bypassed" comment; model now used in production
- Sigmoid fallback retained for missing-pkl case only
- Fallback sigmoid uses only `score_diff` and `seconds_remaining` (unchanged behavior when pkl absent)

### `backend/main.py` — Update (two call sites)
- **Line ~939 (live):** pass `home_win_pct=_win_pct.get(home_abbr, 0.5)` and `away_win_pct=_win_pct.get(away_abbr, 0.5)` to `predict()`
- **Line ~945 (backfill loop):** team abbreviations are available from the enclosing game object `g`; pass the same `_win_pct` values. If a team abbreviation is not in `_win_pct`, defaults to `0.5` (win_pct_diff=0.0)

### `backend/tests/test_win_probability.py` — Update
- Fix `test_overtime_returns_zero`: rename to `test_overtime_returns_seconds_remaining` and update assertion to `== 300` (period=5, clock="05:00" → 5×60=300 seconds)
- Update `predict()` call signatures — existing tests pass unchanged via the new optional-param defaults

### New: `backend/evaluate_win_probability.py`
- Standalone script: loads `win_prob_model.pkl` + `win_prob_test_set.npz`, prints AUC and Brier score
- Can be re-run at any time after retraining or when adding new season data

### `backend/win_prob_model.pkl` — Regenerated
- New format: 3-feature pipeline with calibration layer
- Old pkl is incompatible and will be overwritten on first training run

### New: `backend/win_prob_test_set.npz`
- Persists `X_test` and `y_test` arrays for use by `evaluate_win_probability.py`
- Format: `np.savez('win_prob_test_set.npz', X_test=X_test, y_test=y_test)`

### New: `backend/model_metrics.json`
- Persists AUC and Brier score from most recent training run
- Backend-only, not exposed via API

### New: `backend/pbp_cache.json`
- Checkpoint file for play-by-play collection; maps `game_id → list[snapshot]`
- Allows the trainer to resume a partial run without refetching completed games

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
4. `model_metrics.json`, `win_prob_test_set.npz`, and `win_prob_model.pkl` saved to `backend/`
5. All existing backend tests pass
6. `test_overtime_returns_zero` renamed and corrected to assert `== 300`
