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
    print(f"\n[1/4] Fetching base player stats (PerGame) for {season} from NBA API …")
    time.sleep(1.0)
    raw = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed="PerGame",
    )
    df = raw.get_data_frames()[0]
    print(f"      {len(df)} player rows fetched.")

    print("[2/4] Fetching advanced stats for {season} …")
    time.sleep(1.0)
    try:
        adv_raw = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            per_mode_detailed="PerGame",
            measure_type_detailed_defense="Advanced",
        )
        adv_df = adv_raw.get_data_frames()[0][["PLAYER_ID", "TS_PCT", "NET_RATING"]]
        print(f"      {len(adv_df)} advanced stat rows fetched.")
    except Exception as e:
        print(f"      Advanced stats fetch failed ({e}); ts_pct/net_rating will be NULL.")
        adv_df = None

    if adv_df is not None:
        df = df.merge(adv_df, on="PLAYER_ID", how="left")

    print("[3/4] Fetching positions (historical PlayerIndex) …")
    time.sleep(1.0)
    pi = PlayerIndex(historical_nullable=1)
    pos_df  = pi.get_data_frames()[0][["PERSON_ID", "POSITION"]]
    pos_map = {
        int(r.PERSON_ID): r.POSITION
        for r in pos_df.itertuples()
        if r.POSITION
    }

    print("[4/4] Upserting into database …")
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
            stat.blk_per_game = float(row["BLK"]) if row["BLK"] is not None else None
            stat.stl_per_game = float(row["STL"]) if row["STL"] is not None else None
            stat.tov_per_game = float(row["TOV"]) if row["TOV"] is not None else None
            stat.fg_pct       = float(row["FG_PCT"]) if row["FG_PCT"] is not None else None
            stat.fg3_pct      = float(row["FG3_PCT"]) if row["FG3_PCT"] is not None else None
            stat.ft_pct       = float(row["FT_PCT"]) if row["FT_PCT"] is not None else None
            stat.plus_minus   = float(row["PLUS_MINUS"]) if row["PLUS_MINUS"] is not None else None
            stat.gp           = float(row["GP"]) if row["GP"] is not None else None
            stat.min_per_game = float(row["MIN"]) if row["MIN"] is not None else None
            stat.ts_pct       = float(row["TS_PCT"]) if adv_df is not None and row.get("TS_PCT") is not None else None
            stat.net_rating   = float(row["NET_RATING"]) if adv_df is not None and row.get("NET_RATING") is not None else None
            count += 1

        db.commit()
        print(f"      Done — {count} records upserted for {season}.\n")
        return count
    finally:
        db.close()


if __name__ == "__main__":
    season = sys.argv[1] if len(sys.argv) > 1 else "2025-26"
    seed_season(season)
