from nba_api.stats.endpoints import leaguedashplayerstats


def fetch_player_stats(season: str = "2024-25"):
    """Fetch per-game player stats for a given season from the NBA Stats API."""
    print(f"Fetching NBA Player Stats for {season}…")

    data = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed="PerGame",
    )

    df = data.get_data_frames()[0]
    print(f"  Got {len(df)} players for {season}!")
    return df
