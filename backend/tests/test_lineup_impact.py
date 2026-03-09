"""Tests for lineup_impact.py — filtering, sorting, and aggregation."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

FAKE_ROWS = [
    {"lineup_id": "l1", "players": ["A","B","C","D","E"], "minutes": 200.0, "points_for": 400, "points_against": 360, "plus_minus": 40, "off_rating": 120.0, "def_rating": 108.0, "net_rating": 12.0},
    {"lineup_id": "l2", "players": ["A","B","C","D","F"], "minutes": 80.0,  "points_for": 150, "points_against": 140, "plus_minus": 10, "off_rating": 110.0, "def_rating": 103.0, "net_rating": 7.0},
    {"lineup_id": "l3", "players": ["A","B","C","D","G"], "minutes": 10.0,  "points_for": 20,  "points_against": 25,  "plus_minus": -5, "off_rating": 95.0,  "def_rating": 115.0, "net_rating": -20.0},
]


@pytest.fixture(autouse=True)
def patch_fetch(monkeypatch):
    import lineup_impact
    monkeypatch.setattr(lineup_impact, "fetch_lineup_rows", lambda abbr, season: FAKE_ROWS)


class TestGetLineupSummaries:

    def test_returns_dict_with_expected_keys(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26")
        assert "team" in result
        assert "season" in result
        assert "lineups" in result

    def test_team_and_season_echoed(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("atl", "2025-26")
        assert result["team"] == "ATL"
        assert result["season"] == "2025-26"

    def test_min_minutes_filters_out_low_usage(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=50.0)
        ids = [r["lineup_id"] for r in result["lineups"]]
        assert "l3" not in ids   # 10 min — below threshold

    def test_no_filter_returns_all(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0)
        assert len(result["lineups"]) == 3

    def test_default_sort_is_net_rating_descending(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0)
        net_ratings = [r["net_rating"] for r in result["lineups"]]
        assert net_ratings == sorted(net_ratings, reverse=True)

    def test_sort_by_minutes(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, sort_by="minutes")
        minutes = [r["minutes"] for r in result["lineups"]]
        assert minutes == sorted(minutes, reverse=True)

    def test_limit_truncates_results(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, limit=2)
        assert len(result["lineups"]) == 2

    def test_invalid_sort_by_falls_back_to_net_rating(self):
        from lineup_impact import get_lineup_summaries
        result = get_lineup_summaries("ATL", "2025-26", min_minutes=0, sort_by="bananas")
        net_ratings = [r["net_rating"] for r in result["lineups"]]
        assert net_ratings == sorted(net_ratings, reverse=True)
