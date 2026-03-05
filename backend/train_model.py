#!/usr/bin/env python3
"""
StatStream — ML Win-Probability Trainer
========================================
Run this script ONCE to train the logistic regression model.

  cd /Users/kevjumba/PycharmProjects/StatStream
  pip install scikit-learn joblib          # if not already installed
  python backend/train_model.py

What it does
------------
1. Fetches per-game player stats for 9 historical NBA seasons via
   LeagueDashPlayerStats, then groups by TEAM_ID to compute each team's
   average-player PPG / RPG / APG.  This is the SAME computation used by
   the live /teams/compare endpoint, so training and inference are on
   identical scales (train-serve consistency).
2. Fetches every game result for those seasons via nba_api LeagueGameLog.
3. For each game builds a feature row:
     [home_avg_pts − away_avg_pts, home_avg_reb − away_avg_reb, home_avg_ast − away_avg_ast]
   and a label: 1 = home team won, 0 = away team won.
4. Trains a scikit-learn Pipeline (StandardScaler → LogisticRegression).
   The intercept captures the natural ~60 % home-court advantage.
5. Reports 5-fold cross-validation accuracy and feature coefficients.
6. Saves the fitted pipeline to backend/model.pkl.

Expected output
---------------
  ~15 000 training samples
  CV Accuracy: 0.644 ± 0.008   (typical range 0.62 – 0.68)
  Feature importances shown for pts / reb / ast diff

Expected runtime: 10 – 20 minutes (API rate limiting).
"""

import os
import sys
import time

import numpy  as np
import pandas as pd

from sklearn.linear_model  import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline      import Pipeline
from sklearn.model_selection import cross_val_score, StratifiedKFold
import joblib

from nba_api.stats.endpoints import leaguegamelog, leaguedashplayerstats

# Must match ROTATION_SIZE in main.py — top N scorers used to represent each team.
ROTATION_SIZE = 8

# ── Seasons used for training (NOT the current season — that's what we predict) ──
TRAINING_SEASONS = [
    "2015-16", "2016-17", "2017-18", "2018-19",
    "2019-20", "2020-21", "2021-22", "2022-23", "2023-24",
]

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


# ── Data fetching ─────────────────────────────────────────────────────────────

def fetch_team_averages(season: str) -> dict:
    """Returns {team_id (int): {'pts': float, 'reb': float, 'ast': float}}

    Uses LeagueDashPlayerStats grouped by TEAM_ID — the EXACT same computation
    as the live /teams/compare endpoint in main.py (AVG of player per-game
    stats per team).  This guarantees train-serve consistency: the scaler
    learned from the same feature scale the model sees at inference time.
    """
    print(f"  [team-avg]  {season} …", end=" ", flush=True)
    time.sleep(1.5)
    try:
        data = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
        )
        df = data.get_data_frames()[0]

        # Top ROTATION_SIZE scorers per team — same as _query_team_stats in main.py.
        # Averaging ALL players dilutes star-heavy rosters; top-8 approximates
        # the actual rotation and matches what the inference endpoint uses.
        df_sorted = df.sort_values(["TEAM_ID", "PTS"], ascending=[True, False])
        top_rot   = df_sorted.groupby("TEAM_ID", group_keys=False).head(ROTATION_SIZE)
        team_df   = top_rot.groupby("TEAM_ID")[["PTS", "REB", "AST"]].mean()

        result = {}
        for team_id, row in team_df.iterrows():
            result[int(team_id)] = {
                "pts": float(row["PTS"]),
                "reb": float(row["REB"]),
                "ast": float(row["AST"]),
            }
        print(f"✓ ({len(result)} teams)")
        return result
    except Exception as exc:
        print(f"✗ ERROR: {exc}")
        return {}


def fetch_game_results(season: str) -> pd.DataFrame:
    """Returns DataFrame with columns [GAME_ID, TEAM_ID, MATCHUP, WL]"""
    print(f"  [game-log]  {season} …", end=" ", flush=True)
    time.sleep(1.5)
    try:
        data = leaguegamelog.LeagueGameLog(season=season)
        df   = data.get_data_frames()[0]
        print(f"✓ ({len(df)} rows)")
        # Keep TEAM_ID (the reliable join key) plus MATCHUP and WL
        return df[["GAME_ID", "TEAM_ID", "MATCHUP", "WL"]].copy()
    except Exception as exc:
        print(f"✗ ERROR: {exc}")
        return pd.DataFrame()


# ── Feature engineering ───────────────────────────────────────────────────────

def build_dataset() -> pd.DataFrame:
    rows = []

    for season in TRAINING_SEASONS:
        print(f"\nSeason {season}")
        team_stats = fetch_team_averages(season)
        games_df   = fetch_game_results(season)

        if games_df.empty or not team_stats:
            print(f"  Skipping {season} — no data.")
            continue

        # Home games have "vs." in MATCHUP; away games have "@"
        home_df = games_df[games_df["MATCHUP"].str.contains(r"vs\.", regex=True)]
        away_df = games_df[games_df["MATCHUP"].str.contains(r"@",    regex=True)]

        # Index away rows by GAME_ID → TEAM_ID for O(1) lookup
        away_idx = away_df.set_index("GAME_ID")["TEAM_ID"].to_dict()

        season_rows = 0
        for _, h in home_df.iterrows():
            gid         = h["GAME_ID"]
            home_tid    = int(h["TEAM_ID"])
            home_win    = 1 if h["WL"] == "W" else 0

            away_tid = away_idx.get(gid)
            if away_tid is None:
                continue
            away_tid = int(away_tid)

            if home_tid not in team_stats or away_tid not in team_stats:
                continue

            hs  = team_stats[home_tid]
            aws = team_stats[away_tid]

            rows.append({
                "pts_diff": hs["pts"] - aws["pts"],
                "reb_diff": hs["reb"] - aws["reb"],
                "ast_diff": hs["ast"] - aws["ast"],
                "home_win": home_win,
            })
            season_rows += 1

        print(f"  → {season_rows} game samples added (total so far: {len(rows)})")

    return pd.DataFrame(rows)


# ── Training ──────────────────────────────────────────────────────────────────

def train():
    print("=" * 60)
    print("  StatStream ML Win-Probability Trainer")
    print("=" * 60)

    print("\nPhase 1 — Collecting training data …\n")
    df = build_dataset()

    if df.empty:
        print("\n[ERROR] No training data collected. Check API connectivity and try again.")
        sys.exit(1)

    print(f"\nPhase 2 — Training\n{'─'*40}")
    print(f"Total samples : {len(df)}")
    print(f"Home win rate : {df['home_win'].mean():.1%}  (historical NBA ≈ 60 %)")

    X = df[["pts_diff", "reb_diff", "ast_diff"]].values
    y = df["home_win"].values

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(max_iter=1000, C=0.5, random_state=42)),
    ])

    # Cross-validation
    cv     = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
    print(f"\nCross-val accuracy : {scores.mean():.3f} ± {scores.std():.3f}")
    print(f"Per-fold           : {[f'{s:.3f}' for s in scores]}")

    # Fit on all data
    model.fit(X, y)

    coefs = model.named_steps["clf"].coef_[0]
    inter = model.named_steps["clf"].intercept_[0]
    print(f"\nFeature coefficients (after scaling):")
    for name, c in zip(["PTS diff", "REB diff", "AST diff"], coefs):
        print(f"  {name:12s}: {c:+.4f}")
    print(f"  {'Intercept':12s}: {inter:+.4f}  ← encodes home-court advantage")

    joblib.dump(model, OUTPUT_PATH)
    print(f"\n✓ Model saved → {OUTPUT_PATH}")
    print("  Restart `uvicorn main:app --reload` to activate the ML predictor.")


if __name__ == "__main__":
    train()
