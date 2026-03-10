"""
Seed (or refresh) player stats for a given NBA season.

Usage:
    cd backend
    python seed_season.py 2025-26
    python seed_season.py 2024-25   # refresh existing season
"""
import sys
import time

from nba_api.stats.endpoints import leaguedashplayerstats, PlayerIndex
from sqlalchemy.orm import Session

from database import SessionLocal
import models


def seed_season(season: str) -> int:
    print(f"\n[1/3] Fetching player stats for {season} from NBA API …")
    time.sleep(1.0)
    raw = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed="PerGame",
    )
    df = raw.get_data_frames()[0]
    print(f"      {len(df)} player rows fetched.")

    print("[2/3] Fetching positions (historical PlayerIndex) …")
    time.sleep(1.0)
    pi = PlayerIndex(historical_nullable=1)
    pos_df  = pi.get_data_frames()[0][["PERSON_ID", "POSITION"]]
    pos_map = {
        int(r.PERSON_ID): r.POSITION
        for r in pos_df.itertuples()
        if r.POSITION
    }

    print("[3/3] Upserting into database …")
    db: Session = SessionLocal()
    try:
        count = 0
        for _, row in df.iterrows():
            pid = int(row["PLAYER_ID"])

            stat = (
                db.query(models.PlayerStat)
                .filter(
                    models.PlayerStat.player_id == pid,
                    models.PlayerStat.season    == season,
                )
                .first()
            )
            if stat is None:
                stat = models.PlayerStat(player_id=pid, season=season)
                db.add(stat)

            stat.player_name  = row["PLAYER_NAME"]
            stat.team         = row["TEAM_ABBREVIATION"]
            stat.pts_per_game = float(row["PTS"])
            stat.reb_per_game = float(row["REB"])
            stat.ast_per_game = float(row["AST"])
            stat.position     = pos_map.get(pid, "")
            count += 1

        db.commit()
        print(f"      Done — {count} records upserted for {season}.\n")
        return count
    finally:
        db.close()


if __name__ == "__main__":
    season = sys.argv[1] if len(sys.argv) > 1 else "2025-26"
    seed_season(season)
