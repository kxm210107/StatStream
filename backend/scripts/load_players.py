"""
load_players.py  –  Populate the player_stats table from the NBA Stats API.

Usage examples
--------------
# Load a single season (upsert):
python load_players.py --seasons 2024-25

# Load multiple seasons at once:
python load_players.py --seasons 2024-25 2023-24 2022-23 2021-22 2020-21

# Drop & recreate the table first (required after the composite-PK migration):
python load_players.py --seasons 2024-25 --recreate-db

# Full historical backfill from scratch:
python load_players.py --seasons 2024-25 2023-24 2022-23 2021-22 2020-21 \
    2019-20 2018-19 2017-18 2016-17 2015-16 --recreate-db
"""

import argparse
import sys
import time

from sqlalchemy.orm import Session

# Make sure the backend package is importable when running from repo root
sys.path.insert(0, "backend")

from database import engine, Base          # noqa: E402  (after sys.path tweak)
from models    import PlayerStat           # noqa: E402
from fetch_players import fetch_player_stats  # noqa: E402


def load_season(session: Session, season: str) -> int:
    """Fetch one season and upsert every row.  Returns number of rows saved."""
    df = fetch_player_stats(season)

    base_cols = ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "PTS", "REB", "AST",
                 "BLK", "STL", "TOV", "FG_PCT", "FG3_PCT", "FT_PCT", "PLUS_MINUS", "GP", "MIN"]
    df = df[base_cols]

    for _, row in df.iterrows():
        stat = PlayerStat(
            player_id    = int(row["PLAYER_ID"]),
            season       = season,
            player_name  = row["PLAYER_NAME"],
            team         = row["TEAM_ABBREVIATION"],
            pts_per_game = float(row["PTS"] or 0),
            reb_per_game = float(row["REB"] or 0),
            ast_per_game = float(row["AST"] or 0),
            blk_per_game = float(row["BLK"] or 0),
            stl_per_game = float(row["STL"] or 0),
            tov_per_game = float(row["TOV"] or 0),
            fg_pct       = float(row["FG_PCT"] or 0),
            fg3_pct      = float(row["FG3_PCT"] or 0),
            ft_pct       = float(row["FT_PCT"] or 0),
            plus_minus   = float(row["PLUS_MINUS"] or 0),
            gp           = float(row["GP"] or 0),
            min_per_game = float(row["MIN"] or 0),
            # ts_pct and net_rating omitted here — seeded by seed_season.py
        )
        session.merge(stat)

    session.commit()
    return len(df)


def main():
    parser = argparse.ArgumentParser(description="Load NBA player stats into the DB.")
    parser.add_argument(
        "--seasons", nargs="+", required=True,
        metavar="SEASON",
        help="One or more seasons to load, e.g. 2024-25 2023-24",
    )
    parser.add_argument(
        "--recreate-db", action="store_true",
        help="Drop and recreate the player_stats table before loading (needed for schema changes).",
    )
    args = parser.parse_args()

    # ── Optionally wipe the table ──────────────────────────────────────────────
    if args.recreate_db:
        print("⚠️  Dropping and recreating player_stats table…")
        Base.metadata.drop_all(bind=engine, tables=[PlayerStat.__table__])
        Base.metadata.create_all(bind=engine, tables=[PlayerStat.__table__])
        print("   Table recreated.")

    # ── Load each season ───────────────────────────────────────────────────────
    with Session(engine) as session:
        for i, season in enumerate(args.seasons):
            if i > 0:
                # Be polite to the NBA Stats API between seasons
                time.sleep(2)
            count = load_season(session, season)
            print(f"✅  {season}: saved {count} players")

    print(f"\nDone! Loaded {len(args.seasons)} season(s): {', '.join(args.seasons)}")


if __name__ == "__main__":
    main()
