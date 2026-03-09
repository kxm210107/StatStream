# backend/lineup_impact.py
"""
Aggregates lineup data into sorted, filtered summaries.

All metric computation stays here; lineup_data.py owns the raw NBA API fetch.
"""

from lineup_data import fetch_lineup_rows

_SORTABLE = {"minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"}


def get_lineup_summaries(
    team_abbr: str,
    season:    str,
    min_minutes: float = 20.0,
    sort_by:     str   = "net_rating",
    limit:       int   = 20,
) -> dict:
    """
    Return filtered, sorted lineup summaries for a team/season.

    Args:
        team_abbr:   NBA team abbreviation, e.g. "ATL"
        season:      Season string, e.g. "2025-26"
        min_minutes: Minimum total minutes for a lineup to be included
        sort_by:     Field name to sort by (descending); falls back to net_rating
        limit:       Maximum number of lineups to return

    Returns:
        {"team": str, "season": str, "lineups": [LineupSummary dicts]}
    """
    if sort_by not in _SORTABLE:
        sort_by = "net_rating"

    rows = fetch_lineup_rows(team_abbr, season)
    filtered = [r for r in rows if r["minutes"] >= min_minutes]
    sorted_rows = sorted(filtered, key=lambda r: r[sort_by], reverse=True)

    return {
        "team":    team_abbr.upper(),
        "season":  season,
        "lineups": sorted_rows[:limit],
    }
