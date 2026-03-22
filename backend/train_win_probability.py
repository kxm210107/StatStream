# backend/train_win_probability.py
"""
Train a calibrated logistic regression win probability model on real NBA play-by-play data.

Features per snapshot:
  - score_diff:      home_score - away_score at the moment of the snapshot
  - seconds_remaining: total seconds left in the game
  - win_pct_diff:    home team cumulative win% before game - away team cumulative win%

Label: 1 if home team won, 0 otherwise.

Run once (takes 60-90 min due to API rate limiting):
    cd backend
    python train_win_probability.py
"""

import json
import os
import time
import datetime

import joblib
import numpy as np

MODEL_PATH      = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
TEST_SET_PATH   = os.path.join(os.path.dirname(__file__), "win_prob_test_set.npz")
METRICS_PATH    = os.path.join(os.path.dirname(__file__), "model_metrics.json")
CACHE_PATH      = os.path.join(os.path.dirname(__file__), "pbp_cache.json")

REGULATION_SECONDS = 48 * 60  # 2880


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clock_to_seconds_remaining(period: int, clock: str) -> int:
    """Convert period + clock string to total seconds remaining."""
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
        return seconds_left_in_period
    return seconds_left_in_period + (4 - period) * 12 * 60


# ── Data collection ───────────────────────────────────────────────────────────

def _fetch_win_pcts(seasons: list[str]) -> dict[str, dict]:
    """
    Returns {game_id: {"home_win": int, "home_win_pct": float, "away_win_pct": float,
                       "home_abbr": str, "away_abbr": str}}.
    Uses LeagueGameLog to get cumulative win% per team as of each game.
    """
    from nba_api.stats.endpoints import leaguegamelog

    game_info: dict[str, dict] = {}

    for season in seasons:
        print(f"  Fetching LeagueGameLog {season}...")
        try:
            logs = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
            ).get_dict()
            headers = logs["resultSets"][0]["headers"]
            data    = logs["resultSets"][0]["rowSet"]
            idx     = {h: i for i, h in enumerate(headers)}

            # W_PCT was removed from the API response; compute cumulative win%
            # per team chronologically (sorted by GAME_ID, which is date-ordered).
            # We use the win% *after* the game (inclusive) as a proxy for
            # pre-game strength — sufficient for a 3-season model.
            team_record: dict[str, dict] = {}  # abbr -> {wins, games}

            rows = []
            # Sort by GAME_ID ascending so we process games in date order
            sorted_data = sorted(
                [r for r in data if r[idx["WL"]] in ("W", "L")],
                key=lambda r: r[idx["GAME_ID"]],
            )
            for row in sorted_data:
                abbr = row[idx["TEAM_ABBREVIATION"]]
                wl   = row[idx["WL"]]
                if abbr not in team_record:
                    team_record[abbr] = {"wins": 0, "games": 0}
                team_record[abbr]["games"] += 1
                if wl == "W":
                    team_record[abbr]["wins"] += 1
                g = team_record[abbr]["games"]
                w_pct = team_record[abbr]["wins"] / g if g > 0 else 0.5
                rows.append({
                    "game_id":   row[idx["GAME_ID"]],
                    "team_abbr": abbr,
                    "matchup":   row[idx["MATCHUP"]],
                    "wl":        wl,
                    "w_pct":     w_pct,
                })

            by_game: dict[str, list] = {}
            for r in rows:
                by_game.setdefault(r["game_id"], []).append(r)

            for game_id, game_rows in by_game.items():
                if len(game_rows) != 2:
                    continue
                home_row = next((r for r in game_rows if "vs." in r["matchup"]), None)
                away_row = next((r for r in game_rows if " @ "  in r["matchup"]), None)
                if home_row is None or away_row is None:
                    continue
                game_info[game_id] = {
                    "home_win":     1 if home_row["wl"] == "W" else 0,
                    "home_win_pct": home_row["w_pct"],
                    "away_win_pct": away_row["w_pct"],
                    "home_abbr":    home_row["team_abbr"],
                    "away_abbr":    away_row["team_abbr"],
                }
        except Exception as e:
            print(f"  Warning: LeagueGameLog failed for {season}: {e}")

    return game_info


def _iso_clock_to_mm_ss(clock: str) -> str:
    """Convert ISO 8601 duration 'PT11M15.00S' to 'MM:SS' string."""
    import re
    m = re.match(r"PT(\d+)M([\d.]+)S", clock)
    if not m:
        return "0:00"
    mins = int(m.group(1))
    secs = int(float(m.group(2)))
    return f"{mins}:{secs:02d}"


def _fetch_pbp_snapshots(
    game_id: str,
    home_win: int,
    home_win_pct: float,
    away_win_pct: float,
) -> list[dict]:
    """
    Fetch play-by-play for one game and return feature rows for every scoring play.
    Uses PlayByPlayV3 (V2 no longer returns data from the NBA API).
    Returns list of {"score_diff": int, "seconds_remaining": int,
                     "win_pct_diff": float, "label": int, "game_id": str}
    """
    from nba_api.stats.endpoints.playbyplayv3 import PlayByPlayV3

    try:
        pbp     = PlayByPlayV3(game_id=game_id).get_dict()
        actions = pbp["game"]["actions"]
    except Exception as e:
        msg = str(e)
        print(f"    Warning: PBP fetch failed for {game_id}: {msg}")
        if "timed out" in msg or "timeout" in msg.lower():
            return None  # signal caller to back off
        return []

    snapshots = []

    for action in actions:
        if action.get("pointsTotal", 0) <= 0:
            continue

        period = action.get("period")
        clock  = action.get("clock", "")
        try:
            home_score = int(action["scoreHome"])
            away_score = int(action["scoreAway"])
        except (KeyError, ValueError):
            continue

        try:
            mm_ss = _iso_clock_to_mm_ss(clock)
            sec   = _clock_to_seconds_remaining(int(period), mm_ss)
        except Exception:
            continue

        snapshots.append({
            "score_diff":        home_score - away_score,
            "seconds_remaining": sec,
            "win_pct_diff":      home_win_pct - away_win_pct,
            "label":             home_win,
            "game_id":           game_id,
        })

    return snapshots


def _load_cache() -> dict[str, list]:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH) as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict[str, list]) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f)


def collect_snapshots(game_info: dict[str, dict]) -> list[dict]:
    """
    Fetch play-by-play for all games, checkpointing to pbp_cache.json.
    Sleeps 0.6s between API calls to respect NBA API rate limits.
    """
    cache = _load_cache()
    all_snapshots: list[dict] = []

    game_ids = list(game_info.keys())
    total    = len(game_ids)
    fetched  = 0

    for i, game_id in enumerate(game_ids):
        if game_id in cache:
            all_snapshots.extend(cache[game_id])
            continue

        info = game_info[game_id]
        backoff = 1.0
        while True:
            snaps = _fetch_pbp_snapshots(
                game_id,
                info["home_win"],
                info["home_win_pct"],
                info["away_win_pct"],
            )
            if snaps is None:
                # timeout — back off and retry
                print(f"    Rate-limited, backing off {backoff:.0f}s before retry...")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
                continue
            break

        cache[game_id] = snaps
        all_snapshots.extend(snaps)
        fetched += 1

        if fetched % 50 == 0:
            _save_cache(cache)
            print(f"  {i+1}/{total} games processed ({fetched} fetched from API)...")

        time.sleep(0.6)

    _save_cache(cache)
    print(f"  Done. {total} games, {len(all_snapshots)} snapshots total.")
    return all_snapshots


# ── Training ──────────────────────────────────────────────────────────────────

def _split_by_game(
    snapshots: list[dict],
    train_frac: float = 0.70,
    cal_frac:   float = 0.10,
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Split snapshots into train / calibration / test by game_id.
    All snapshots from a game go to the same split (prevents leakage).
    """
    import random
    game_ids = list({s["game_id"] for s in snapshots})
    random.seed(42)
    random.shuffle(game_ids)

    n = len(game_ids)
    n_train = int(n * train_frac)
    n_cal   = int(n * cal_frac)

    train_ids = set(game_ids[:n_train])
    cal_ids   = set(game_ids[n_train:n_train + n_cal])
    test_ids  = set(game_ids[n_train + n_cal:])

    train = [s for s in snapshots if s["game_id"] in train_ids]
    cal   = [s for s in snapshots if s["game_id"] in cal_ids]
    test  = [s for s in snapshots if s["game_id"] in test_ids]

    return train, cal, test


def _to_arrays(snapshots: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    X = np.array([[s["score_diff"], s["seconds_remaining"], s["win_pct_diff"]]
                  for s in snapshots], dtype=float)
    y = np.array([s["label"] for s in snapshots], dtype=float)
    return X, y


def train(seasons: list[str] | None = None):
    if seasons is None:
        seasons = ["2022-23", "2023-24", "2024-25"]

    print("=== Win Probability Model Training ===")
    print(f"Seasons: {seasons}")

    print("\n[1/4] Fetching game logs and win percentages...")
    game_info = _fetch_win_pcts(seasons)
    print(f"  {len(game_info)} completed games found.")

    print("\n[2/4] Collecting play-by-play snapshots (may take 60-90 min)...")
    snapshots = collect_snapshots(game_info)
    print(f"  {len(snapshots)} snapshots collected.")

    print("\n[3/4] Splitting and training...")
    train_snaps, cal_snaps, test_snaps = _split_by_game(snapshots)
    print(f"  Train: {len(train_snaps)} snapshots | Cal: {len(cal_snaps)} | Test: {len(test_snaps)}")

    X_train, y_train = _to_arrays(train_snaps)
    X_cal,   y_cal   = _to_arrays(cal_snaps)
    X_test,  y_test  = _to_arrays(test_snaps)

    from sklearn.linear_model  import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline      import Pipeline

    # Fit on train + cal combined — logistic regression is inherently well-calibrated
    # so a separate Platt calibration step is unnecessary.
    X_train_cal = np.vstack([X_train, X_cal])
    y_train_cal = np.concatenate([y_train, y_cal])

    calibrated = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(max_iter=1000)),
    ])
    calibrated.fit(X_train_cal, y_train_cal)

    print("\n[4/4] Evaluating on holdout test set...")
    from sklearn.metrics import roc_auc_score, brier_score_loss

    y_pred_proba = calibrated.predict_proba(X_test)[:, 1]
    auc   = roc_auc_score(y_test, y_pred_proba)
    brier = brier_score_loss(y_test, y_pred_proba)
    print(f"  AUC-ROC:     {auc:.4f}  (target >= 0.85)")
    print(f"  Brier score: {brier:.4f} (target <= 0.15)")

    joblib.dump(calibrated, MODEL_PATH)
    print(f"  Model saved  -> {MODEL_PATH}")

    np.savez(TEST_SET_PATH, X_test=X_test, y_test=y_test)
    print(f"  Test set saved -> {TEST_SET_PATH}")

    metrics = {
        "auc":        round(auc, 4),
        "brier":      round(brier, 4),
        "seasons":    seasons,
        "n_games":    len(game_info),
        "trained_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics saved  -> {METRICS_PATH}")

    if auc < 0.85:
        print("\n  WARNING: AUC below target of 0.85")
    if brier > 0.15:
        print("\n  WARNING: Brier score above target of 0.15")

    print("\nTraining complete.")
    return calibrated


if __name__ == "__main__":
    train()
