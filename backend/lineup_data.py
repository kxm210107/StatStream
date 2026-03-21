# backend/lineup_data.py
"""
Fetches and normalizes NBA lineup data using LeagueDashLineups.

Two API calls are made per request (Base + Advanced measure types) and merged
on GROUP_ID to assemble the full set of lineup metrics.
"""

import logging

from nba_api.stats.endpoints import leaguedashlineups as _ep
from nba_api.stats.static import teams as _nba_teams

LeagueDashLineups = _ep.LeagueDashLineups   # exposed for monkeypatching in tests

logger = logging.getLogger(__name__)

_TIMEOUT = 30  # seconds per NBA API call


def get_team_id(abbr: str) -> int:
    """Return the NBA team ID for a team abbreviation like 'ATL'."""
    team = _nba_teams.find_team_by_abbreviation(abbr.upper())
    if not team:
        raise ValueError(f"Unknown team abbreviation: {abbr!r}")
    return int(team["id"])


def fetch_lineup_rows(team_abbr: str, season: str) -> list[dict]:
    """
    Fetch all 5-man lineup rows for a team/season from the NBA API.

    Returns a list of dicts with keys:
        lineup_id, players, minutes, points_for, points_against,
        plus_minus, off_rating, def_rating, net_rating
    """
    team_id = get_team_id(team_abbr)

    logger.info("[lineups] fetching base stats for %s %s", team_abbr, season)
    base = LeagueDashLineups(
        season=season,
        team_id_nullable=team_id,
        measure_type_detailed_defense="Base",
        per_mode_detailed="Totals",
        timeout=_TIMEOUT,
    )
    base_df = base.get_data_frames()[0]
    logger.info("[lineups] base ok, %d rows", len(base_df))

    logger.info("[lineups] fetching advanced stats for %s %s", team_abbr, season)
    adv = LeagueDashLineups(
        season=season,
        team_id_nullable=team_id,
        measure_type_detailed_defense="Advanced",
        per_mode_detailed="Totals",
        timeout=_TIMEOUT,
    )
    adv_df = adv.get_data_frames()[0]
    logger.info("[lineups] advanced ok, %d rows", len(adv_df))

    abbr_upper = team_abbr.upper()
    base_df = base_df[base_df["TEAM_ABBREVIATION"] == abbr_upper]
    adv_df  = adv_df[adv_df["TEAM_ABBREVIATION"]  == abbr_upper]

    merged = base_df[["GROUP_ID", "GROUP_NAME", "MIN", "PTS", "PLUS_MINUS"]].merge(
        adv_df[["GROUP_ID", "OFF_RATING", "DEF_RATING", "NET_RATING"]],
        on="GROUP_ID",
        how="inner",
    )

    rows = []
    for _, row in merged.iterrows():
        pts = int(row["PTS"])
        pm  = int(row["PLUS_MINUS"])
        players = [p.strip() for p in str(row["GROUP_NAME"]).split(" - ")]
        rows.append({
            "lineup_id":      row["GROUP_ID"],
            "players":        players,
            "minutes":        float(row["MIN"]),
            "points_for":     pts,
            "points_against": pts - pm,
            "plus_minus":     pm,
            "off_rating":     float(row["OFF_RATING"]),
            "def_rating":     float(row["DEF_RATING"]),
            "net_rating":     float(row["NET_RATING"]),
        })
    return rows
