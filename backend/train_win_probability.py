# backend/train_win_probability.py
"""
Train a logistic regression win probability model.

Features (at a simulated game state):
  - score_diff: home_score - away_score
  - seconds_remaining: total seconds left in the game (2880 = start, 0 = end)

Label:
  - 1 if home team won, 0 otherwise

Run once before starting the server:
    cd backend
    python train_win_probability.py
"""

import os
import numpy as np
import joblib
from nba_api.stats.endpoints import leaguegamelog

MODEL_PATH = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
REGULATION_SECONDS = 48 * 60  # 2880


def _fetch_game_logs(seasons: list[str]) -> list[dict]:
    """Fetch completed game rows for the given seasons."""
    rows = []
    for season in seasons:
        print(f"  Fetching {season}...")
        try:
            logs = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
            ).get_dict()
            headers = logs["resultSets"][0]["headers"]
            data    = logs["resultSets"][0]["rowSet"]
            idx     = {h: i for i, h in enumerate(headers)}
            for row in data:
                rows.append({
                    "team_id":    row[idx["TEAM_ID"]],
                    "game_id":    row[idx["GAME_ID"]],
                    "wl":         row[idx["WL"]],
                    "pts":        row[idx["PTS"]],
                    "matchup":    row[idx["MATCHUP"]],
                })
        except Exception as e:
            print(f"  Warning: {e}")
    return rows


def _pair_games(rows: list[dict]) -> list[dict]:
    """
    Pair home and away rows by game_id.
    Home team matchup contains "vs." (home), away contains "@".
    """
    by_game: dict[str, list] = {}
    for r in rows:
        by_game.setdefault(r["game_id"], []).append(r)

    pairs = []
    for game_id, game_rows in by_game.items():
        if len(game_rows) != 2:
            continue
        home = next((r for r in game_rows if "vs." in r["matchup"]), None)
        away = next((r for r in game_rows if " @ "  in r["matchup"]), None)
        if home is None or away is None:
            continue
        pairs.append({
            "home_pts": int(home["pts"] or 0),
            "away_pts": int(away["pts"] or 0),
            "home_win": 1 if home["wl"] == "W" else 0,
        })
    return pairs


def _synthesize_states(pairs: list[dict], snapshots_per_game: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """
    For each completed game, create `snapshots_per_game` synthetic game-state rows
    by proportionally distributing the final score across time.
    """
    X_rows, y_rows = [], []

    for p in pairs:
        home_final = p["home_pts"]
        away_final = p["away_pts"]
        home_win   = p["home_win"]

        for i in range(1, snapshots_per_game + 1):
            frac_elapsed = i / snapshots_per_game
            seconds_remaining = int(REGULATION_SECONDS * (1 - frac_elapsed))

            home_score = round(home_final * frac_elapsed)
            away_score = round(away_final * frac_elapsed)
            score_diff = home_score - away_score

            X_rows.append([score_diff, seconds_remaining])
            y_rows.append(home_win)

    return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)


def train(seasons: list[str] | None = None):
    if seasons is None:
        seasons = ["2022-23", "2023-24", "2024-25"]

    print("Fetching game logs...")
    rows  = _fetch_game_logs(seasons)
    print(f"  {len(rows)} team-game rows fetched.")

    pairs = _pair_games(rows)
    print(f"  {len(pairs)} completed games paired.")

    X, y = _synthesize_states(pairs)
    print(f"  {len(X)} training rows generated.")

    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(max_iter=1000)),
    ])
    model.fit(X, y)

    acc = model.score(X, y)
    print(f"  Training accuracy: {acc:.3f}")

    joblib.dump(model, MODEL_PATH)
    print(f"  Model saved -> {MODEL_PATH}")


if __name__ == "__main__":
    train()
