"""
Populate the `position` column in player_stats using NBA PlayerIndex.

Run from the backend directory:
    python populate_positions.py
"""
from nba_api.stats.endpoints import PlayerIndex
from sqlalchemy import text
from database import engine

def main():
    print("Fetching PlayerIndex from NBA API (including historical)...")
    pi = PlayerIndex(historical_nullable=1)
    df = pi.get_data_frames()[0][['PERSON_ID', 'POSITION']]
    df = df[df['POSITION'].notna() & (df['POSITION'] != '')]

    pos_map = dict(zip(df['PERSON_ID'].astype(int), df['POSITION']))
    print(f"  Got positions for {len(pos_map)} players")

    with engine.connect() as conn:
        updated = 0
        for player_id, position in pos_map.items():
            result = conn.execute(
                text("UPDATE player_stats SET position = :pos WHERE player_id = :pid AND (position IS NULL OR position = '')"),
                {"pos": position, "pid": player_id}
            )
            updated += result.rowcount
        conn.commit()

    print(f"Updated {updated} rows with position data.")

if __name__ == "__main__":
    main()
